import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { BalanceService } from '../services/balance.service';
import { StatsService } from '../services/stats.service';
import { GameHeader } from '../game-header/game-header';

const GRID = 5;
const N = GRID * GRID; // 25 tiles

export enum MinesPhase {
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  EXPLODED = 'EXPLODED',
  CASHOUT = 'CASHOUT',
}

export interface Tile {
  index: number;
  isMine: boolean;
  revealed: boolean;
  isHit: boolean;
}

export interface MinesHistory {
  timestamp: Date;
  bet: number;
  mines: number;
  revealed: number;
  multiplier: number;
  profit: number;
  balance: number;
  won: boolean;
}

// Multiplier formula (same as Stake): 0.99 × ∏(i=0..r-1) (N-i)/(N-mines-i)
function calcMult(revealed: number, mines: number): number {
  if (revealed <= 0) return 0;
  let mult = 0.99;
  for (let i = 0; i < revealed; i++) {
    mult *= (N - i) / (N - mines - i);
  }
  return Math.round(mult * 100) / 100;
}

@Component({
  selector: 'app-mines',
  standalone: true,
  imports: [CommonModule, GameHeader],
  templateUrl: './mines.html',
  styleUrls: ['./mines.css'],
})
export class Mines {
  readonly MinesPhase = MinesPhase;
  readonly GRID = GRID;
  readonly CHIP_VALUES = [1, 5, 10, 25, 50, 100];
  readonly MINE_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24];

  phase = signal<MinesPhase>(MinesPhase.SETUP);
  balance = signal(0);
  bet = signal(10);
  mineCount = signal(3);
  activeBet = signal(0);
  tiles = signal<Tile[]>([]);
  revealedCount = signal(0);
  history = signal<MinesHistory[]>([]);

  private lastBet = 0;
  private lastMines = 3;

  multiplier = computed(() => calcMult(this.revealedCount(), this.mineCount()));
  nextMultiplier = computed(() => calcMult(this.revealedCount() + 1, this.mineCount()));
  currentWin = computed(() => {
    const m = this.multiplier();
    return m === 0 ? 0 : Math.round(this.activeBet() * m * 100) / 100;
  });
  nextWin = computed(() => Math.round(this.activeBet() * this.nextMultiplier() * 100) / 100);
  safeTiles = computed(() => N - this.mineCount());
  mineProbability = computed(() => {
    const remaining = N - this.revealedCount();
    return Math.round((this.mineCount() / remaining) * 1000) / 10;
  });

  // Preview table shown during setup
  previewTable = computed(() => {
    const mines = this.mineCount();
    const safe = N - mines;
    return [1, 2, 3, 5, 8, 12, 15, 20]
      .filter(r => r <= safe)
      .map(r => ({ reveals: r, mult: calcMult(r, mines) }));
  });

  gamesPlayed = computed(() => this.history().length);
  gamesWon = computed(() => this.history().filter(h => h.won).length);
  gamesLost = computed(() => this.history().filter(h => !h.won).length);
  profitLoss = computed(() => Math.round(this.history().reduce((s, h) => s + h.profit, 0) * 100) / 100);

  constructor(private balanceService: BalanceService, private statsService: StatsService) {
    toObservable(balanceService.balance)
      .pipe(filter(b => b > 0), takeUntilDestroyed())
      .subscribe(b => this.balance.set(b));
  }

  // ── Bet controls ────────────────────────────────────────────────────────────

  addBet(chip: number): void {
    if (this.phase() !== MinesPhase.SETUP) return;
    const add = Math.min(chip, this.balance() - this.bet());
    if (add > 0) this.bet.update(b => b + add);
  }

  allIn(): void {
    if (this.phase() !== MinesPhase.SETUP) return;
    this.bet.set(this.balance());
  }

  clearBet(): void {
    if (this.phase() !== MinesPhase.SETUP) return;
    this.bet.set(0);
  }

  setMineCount(m: number): void {
    if (this.phase() !== MinesPhase.SETUP) return;
    this.mineCount.set(m);
  }

  canStart(): boolean {
    return this.bet() > 0 && this.balance() >= this.bet() && this.phase() === MinesPhase.SETUP;
  }

  // ── Game flow ────────────────────────────────────────────────────────────────

  start(): void {
    if (!this.canStart()) return;

    const bet = this.bet();
    const mines = this.mineCount();
    this.lastBet = bet;
    this.lastMines = mines;
    this.activeBet.set(bet);
    this.balance.update(b => b - bet);

    // Place mines randomly via Fisher-Yates shuffle
    const idx = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const mineSet = new Set(idx.slice(0, mines));

    this.tiles.set(
      Array.from({ length: N }, (_, i) => ({
        index: i,
        isMine: mineSet.has(i),
        revealed: false,
        isHit: false,
      }))
    );
    this.revealedCount.set(0);
    this.phase.set(MinesPhase.PLAYING);
  }

  reveal(tile: Tile): void {
    if (this.phase() !== MinesPhase.PLAYING || tile.revealed) return;

    if (tile.isMine) {
      this.tiles.update(ts =>
        ts.map(t => ({ ...t, revealed: true, isHit: t.index === tile.index }))
      );
      this.phase.set(MinesPhase.EXPLODED);
      this.balanceService.save(this.balance());
      this.statsService.report({
        game: 'mines',
        won: false,
        amountWon: 0,
        amountLost: this.lastBet,
        amountBet: this.lastBet,
        wasAllIn: false,
        currentBalance: this.balance(),
      });
      this.history.update(h =>
        [
          {
            timestamp: new Date(),
            bet: this.lastBet,
            mines: this.lastMines,
            revealed: this.revealedCount(),
            multiplier: this.multiplier(),
            profit: -this.lastBet,
            balance: this.balance(),
            won: false,
          },
          ...h,
        ].slice(0, 10)
      );
    } else {
      this.tiles.update(ts =>
        ts.map(t => (t.index === tile.index ? { ...t, revealed: true } : t))
      );
      this.revealedCount.update(r => r + 1);
      // Auto cashout when all safe tiles found
      if (this.revealedCount() === this.safeTiles()) {
        setTimeout(() => this.cashOut(), 300);
      }
    }
  }

  cashOut(): void {
    if (this.phase() !== MinesPhase.PLAYING || this.revealedCount() === 0) return;

    const mult = this.multiplier();
    const winAmount = Math.round(this.activeBet() * mult * 100) / 100;
    const profit = Math.round((winAmount - this.lastBet) * 100) / 100;
    const newBalance = Math.round((this.balance() + winAmount) * 100) / 100;

    this.tiles.update(ts => ts.map(t => ({ ...t, revealed: true })));
    this.balance.set(newBalance);
    this.balanceService.save(newBalance);
    this.phase.set(MinesPhase.CASHOUT);
    this.statsService.report({
      game: 'mines',
      won: true,
      amountWon: profit,
      amountLost: 0,
      amountBet: this.lastBet,
      wasAllIn: false,
      currentBalance: newBalance,
    });

    this.history.update(h =>
      [
        {
          timestamp: new Date(),
          bet: this.lastBet,
          mines: this.lastMines,
          revealed: this.revealedCount(),
          multiplier: mult,
          profit,
          balance: newBalance,
          won: true,
        },
        ...h,
      ].slice(0, 10)
    );
  }

  newGame(): void {
    this.phase.set(MinesPhase.SETUP);
    this.tiles.set([]);
    this.revealedCount.set(0);
  }

  canReplay(): boolean {
    return this.lastBet > 0 && this.balance() >= this.lastBet;
  }

  replayLastHand(): void {
    if (!this.canReplay()) return;
    this.bet.set(this.lastBet);
    this.mineCount.set(this.lastMines);
    this.phase.set(MinesPhase.SETUP);
    this.tiles.set([]);
    this.revealedCount.set(0);
    this.start();
  }

  trackTile(_: number, tile: Tile): number {
    return tile.index;
  }
}
