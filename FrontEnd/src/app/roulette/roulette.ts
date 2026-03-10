import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { BalanceService } from '../services/balance.service';
import { StatsService } from '../services/stats.service';
import { GameHeader } from '../game-header/game-header';

export enum RoulettePhase {
  BETTING = 'BETTING',
  SPINNING = 'SPINNING',
  RESULT = 'RESULT',
}

export interface RouletteHistory {
  timestamp: Date;
  result: number;
  color: 'red' | 'black' | 'green';
  totalBet: number;
  profit: number;
  balance: number;
}

export interface RouletteState {
  phase: RoulettePhase;
  bets: Record<string, number>;
  result: number | null;
  balance: number;
  message: string;
  history: RouletteHistory[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Fine grid column mapping (grid-template-columns: 56px repeat(12, 36px 12px) 50px):
//   col 1 = zero,  col C*2 = numC,  col C*2+1 = gapC,  col 26 = col-bet
// Fine grid row mapping (grid-template-rows: 44px 12px 44px 12px 44px 6px 28px):
//   row (r-1)*2+1 = number row r (r=1..3),  row r*2 = gap row,  row 7 = street/line row

function numGridCol(c: number): number { return c * 2; }
function numGridRow(r: number): number { return (r - 1) * 2 + 1; }
function getRow(n: number): number {
  const mod = n % 3;
  return mod === 0 ? 1 : mod === 2 ? 2 : 3;
}
function getCol(n: number): number { return Math.ceil(n / 3); }

interface BetZone {
  key: string;
  label: string;
  gridCol: number;
  gridRow: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-roulette',
  standalone: true,
  imports: [CommonModule, GameHeader],
  templateUrl: './roulette.html',
  styleUrls: ['./roulette.css'],
})
export class Roulette implements OnInit {
  readonly RoulettePhase = RoulettePhase;
  readonly CHIP_VALUES = [1, 5, 10, 25, 50, 100];

  selectedChip = 10;
  allInSelected = false;
  isSpinning = false;
  hoveredKey = '';
  private _hoveredNums = new Set<number>();
  private lastBets: Record<string, number> = {};

  // ── Pre-computed cell arrays ────────────────────────────────────────────────

  readonly numberCells = Array.from({ length: 36 }, (_, i) => {
    const n = i + 1;
    const c = getCol(n);
    const r = getRow(n);
    return { num: n, gridCol: numGridCol(c), gridRow: numGridRow(r) };
  });

  // Horizontal splits: between adjacent columns, same number row
  readonly hSplitZones: BetZone[] = (() => {
    const zones: BetZone[] = [];
    for (let c = 1; c <= 11; c++) {
      for (let r = 1; r <= 3; r++) {
        const n1 = 3 * c - (r - 1);
        const n2 = n1 + 3;
        zones.push({
          key: `sp-${n1}-${n2}`,
          label: `Cheval ${n1}–${n2} (17:1)`,
          gridCol: c * 2 + 1,
          gridRow: numGridRow(r),
        });
      }
    }
    return zones;
  })();

  // Vertical splits: between adjacent rows, same column
  readonly vSplitZones: BetZone[] = (() => {
    const zones: BetZone[] = [];
    for (let c = 1; c <= 12; c++) {
      // Between row 1 (top=3c) and row 2 (mid=3c-1)
      zones.push({
        key: `sp-${3 * c - 1}-${3 * c}`,
        label: `Cheval ${3 * c - 1}–${3 * c} (17:1)`,
        gridCol: numGridCol(c),
        gridRow: 2,
      });
      // Between row 2 (mid=3c-1) and row 3 (bot=3c-2)
      zones.push({
        key: `sp-${3 * c - 2}-${3 * c - 1}`,
        label: `Cheval ${3 * c - 2}–${3 * c - 1} (17:1)`,
        gridCol: numGridCol(c),
        gridRow: 4,
      });
    }
    return zones;
  })();

  // Corners: 4 numbers at intersection of gap row & gap col
  readonly cornerZones: BetZone[] = (() => {
    const zones: BetZone[] = [];
    for (let c = 1; c <= 11; c++) {
      // Row gap 1-2 (gridRow=2): covers 3c, 3c-1, 3c+3, 3c+2 → min=3c-1
      const minTop = 3 * c - 1;
      zones.push({
        key: `co-${minTop}`,
        label: `Carré ${minTop}–${minTop + 1}–${minTop + 3}–${minTop + 4} (8:1)`,
        gridCol: c * 2 + 1,
        gridRow: 2,
      });
      // Row gap 2-3 (gridRow=4): covers 3c-1, 3c-2, 3c+2, 3c+1 → min=3c-2
      const minBot = 3 * c - 2;
      zones.push({
        key: `co-${minBot}`,
        label: `Carré ${minBot}–${minBot + 1}–${minBot + 3}–${minBot + 4} (8:1)`,
        gridCol: c * 2 + 1,
        gridRow: 4,
      });
    }
    return zones;
  })();

  // Streets (3 numbers = one column of numbers) — placed in row 7
  readonly streetZones: BetZone[] = Array.from({ length: 12 }, (_, i) => {
    const c = i + 1;
    const base = 3 * c - 2;
    return {
      key: `st-${base}`,
      label: `Transversale ${base}–${base + 2} (11:1)`,
      gridCol: numGridCol(c),
      gridRow: 7,
    };
  });

  // Lines (6 numbers = 2 adjacent streets) — placed in row 7, gap columns
  readonly lineZones: BetZone[] = Array.from({ length: 11 }, (_, i) => {
    const c = i + 1;
    const base = 3 * c - 2;
    return {
      key: `ln-${base}`,
      label: `Sixain ${base}–${base + 5} (5:1)`,
      gridCol: c * 2 + 1,
      gridRow: 7,
    };
  });

  // ── State ───────────────────────────────────────────────────────────────────

  gameState = signal<RouletteState>({
    phase: RoulettePhase.BETTING,
    bets: {},
    result: null,
    balance: 0,
    message: 'Placez vos mises',
    history: [],
  });

  totalBet = computed(() => Object.values(this.gameState().bets).reduce((s, v) => s + v, 0));
  gamesPlayed = computed(() => this.gameState().history.length);
  gamesWon = computed(() => this.gameState().history.filter(h => h.profit > 0).length);
  gamesLost = computed(() => this.gameState().history.filter(h => h.profit < 0).length);
  profitLoss = computed(() => Math.round(this.gameState().history.reduce((sum, h) => sum + h.profit, 0) * 100) / 100);

  constructor(private balanceService: BalanceService, private statsService: StatsService) {
    toObservable(balanceService.balance)
      .pipe(filter(b => b > 0), takeUntilDestroyed())
      .subscribe(b => this.gameState.update(s => ({ ...s, balance: b })));
  }

  ngOnInit(): void {}

  // ── Color / helpers ─────────────────────────────────────────────────────────

  getColor(n: number): 'red' | 'black' | 'green' {
    if (n === 0) return 'green';
    return RED_NUMBERS.has(n) ? 'red' : 'black';
  }

  getBetAmount(key: string): number {
    return this.gameState().bets[key] ?? 0;
  }

  isWinningBet(key: string, result: number): boolean {
    if (key === 'n-0') return result === 0;
    if (key.startsWith('n-')) return parseInt(key.slice(2)) === result;
    if (result === 0) return false;
    if (key.startsWith('sp-')) {
      const [, a, b] = key.split('-');
      return result === +a || result === +b;
    }
    if (key.startsWith('co-')) {
      const min = +key.slice(3);
      return result === min || result === min + 1 || result === min + 3 || result === min + 4;
    }
    if (key.startsWith('st-')) {
      const base = +key.slice(3);
      return result >= base && result <= base + 2;
    }
    if (key.startsWith('ln-')) {
      const base = +key.slice(3);
      return result >= base && result <= base + 5;
    }
    if (key === 'red') return RED_NUMBERS.has(result);
    if (key === 'black') return !RED_NUMBERS.has(result);
    if (key === 'odd') return result % 2 !== 0;
    if (key === 'even') return result % 2 === 0;
    if (key === 'low') return result <= 18;
    if (key === 'high') return result >= 19;
    if (key === 'dozen-1') return result <= 12;
    if (key === 'dozen-2') return result >= 13 && result <= 24;
    if (key === 'dozen-3') return result >= 25;
    if (key === 'col-1') return result % 3 === 1;
    if (key === 'col-2') return result % 3 === 2;
    if (key === 'col-3') return result % 3 === 0;
    return false;
  }

  getPayout(key: string): number {
    if (key.startsWith('n-')) return 36;   // 35:1
    if (key.startsWith('sp-')) return 18;  // 17:1
    if (key.startsWith('st-')) return 12;  // 11:1
    if (key.startsWith('co-')) return 9;   //  8:1
    if (key.startsWith('ln-')) return 6;   //  5:1
    if (key.startsWith('dozen-') || key.startsWith('col-')) return 3; // 2:1
    return 2; // 1:1
  }

  // ── Hover highlight ─────────────────────────────────────────────────────────

  setHovered(key: string): void {
    this.hoveredKey = key;
    this._hoveredNums = this._computeHighlight(key);
  }

  clearHovered(): void {
    this.hoveredKey = '';
    this._hoveredNums = new Set();
  }

  isHighlighted(n: number): boolean {
    return this._hoveredNums.has(n);
  }

  private _computeHighlight(key: string): Set<number> {
    if (!key) return new Set();
    if (key === 'n-0') return new Set([0]);
    if (key.startsWith('n-')) return new Set([+key.slice(2)]);
    if (key.startsWith('sp-')) {
      const [, a, b] = key.split('-');
      return new Set([+a, +b]);
    }
    if (key.startsWith('co-')) {
      const m = +key.slice(3);
      return new Set([m, m + 1, m + 3, m + 4]);
    }
    if (key.startsWith('st-')) {
      const b = +key.slice(3);
      return new Set([b, b + 1, b + 2]);
    }
    if (key.startsWith('ln-')) {
      const b = +key.slice(3);
      return new Set([b, b + 1, b + 2, b + 3, b + 4, b + 5]);
    }
    if (key === 'red') return RED_NUMBERS;
    if (key === 'black') {
      const s = new Set<number>();
      for (let i = 1; i <= 36; i++) if (!RED_NUMBERS.has(i)) s.add(i);
      return s;
    }
    if (key === 'odd') {
      const s = new Set<number>();
      for (let i = 1; i <= 36; i += 2) s.add(i);
      return s;
    }
    if (key === 'even') {
      const s = new Set<number>();
      for (let i = 2; i <= 36; i += 2) s.add(i);
      return s;
    }
    if (key === 'low') {
      const s = new Set<number>();
      for (let i = 1; i <= 18; i++) s.add(i);
      return s;
    }
    if (key === 'high') {
      const s = new Set<number>();
      for (let i = 19; i <= 36; i++) s.add(i);
      return s;
    }
    if (key === 'dozen-1') return new Set(Array.from({ length: 12 }, (_, i) => i + 1));
    if (key === 'dozen-2') return new Set(Array.from({ length: 12 }, (_, i) => i + 13));
    if (key === 'dozen-3') return new Set(Array.from({ length: 12 }, (_, i) => i + 25));
    if (key === 'col-1') {
      const s = new Set<number>();
      for (let i = 1; i <= 36; i++) if (i % 3 === 1) s.add(i);
      return s;
    }
    if (key === 'col-2') {
      const s = new Set<number>();
      for (let i = 1; i <= 36; i++) if (i % 3 === 2) s.add(i);
      return s;
    }
    if (key === 'col-3') {
      const s = new Set<number>();
      for (let i = 1; i <= 36; i++) if (i % 3 === 0) s.add(i);
      return s;
    }
    return new Set();
  }

  // ── Betting ─────────────────────────────────────────────────────────────────

  selectChip(val: number): void {
    this.selectedChip = val;
    this.allInSelected = false;
  }

  selectAllIn(): void {
    const remaining = this.gameState().balance - this.totalBet();
    if (remaining > 0) {
      this.selectedChip = remaining;
      this.allInSelected = true;
    }
  }

  placeBet(key: string): void {
    if (this.gameState().phase !== RoulettePhase.BETTING) return;
    const state = this.gameState();
    if (this.totalBet() + this.selectedChip > state.balance) return;
    this.allInSelected = false;
    this.gameState.update(s => ({
      ...s,
      bets: { ...s.bets, [key]: (s.bets[key] ?? 0) + this.selectedChip },
    }));
  }

  removeBet(key: string, event: MouseEvent): void {
    event.preventDefault();
    if (this.gameState().phase !== RoulettePhase.BETTING) return;
    const current = this.gameState().bets[key] ?? 0;
    if (current <= 0) return;
    const next = Math.max(0, current - this.selectedChip);
    this.gameState.update(s => {
      const bets = { ...s.bets };
      if (next === 0) delete bets[key];
      else bets[key] = next;
      return { ...s, bets };
    });
  }

  clearBets(): void {
    this.gameState.update(s => ({ ...s, bets: {} }));
  }

  canSpin(): boolean {
    return this.totalBet() > 0 && this.gameState().phase === RoulettePhase.BETTING;
  }

  canReplay(): boolean {
    const total = Object.values(this.lastBets).reduce((a, b) => a + b, 0);
    return total > 0 && total <= this.gameState().balance;
  }

  replayLastHand(): void {
    if (!this.canReplay()) return;
    this.gameState.update(s => ({
      ...s,
      phase: RoulettePhase.BETTING,
      bets: { ...this.lastBets },
      result: null,
      message: 'Placez vos mises',
    }));
    this.spin();
  }

  // ── Spin ────────────────────────────────────────────────────────────────────

  spin(): void {
    if (!this.canSpin()) return;
    this.lastBets = { ...this.gameState().bets };
    const total = this.totalBet();
    this.isSpinning = true;
    this.gameState.update(s => ({
      ...s,
      phase: RoulettePhase.SPINNING,
      balance: s.balance - total,
      message: 'La bille tourne…',
    }));
    const result = Math.floor(Math.random() * 37);
    setTimeout(() => this.resolveRound(result, total), 3000);
  }

  private resolveRound(result: number, totalBet: number): void {
    const state = this.gameState();
    let winnings = 0;
    for (const [key, amount] of Object.entries(state.bets)) {
      if (this.isWinningBet(key, result)) winnings += amount * this.getPayout(key);
    }
    const profit = Math.round((winnings - totalBet) * 100) / 100;
    const newBalance = Math.round((state.balance + winnings) * 100) / 100;
    const color = this.getColor(result);
    const icon = color === 'green' ? '🟢' : color === 'red' ? '🔴' : '⚫';
    const outcome = profit > 0 ? `+$${profit}` : profit < 0 ? `-$${Math.abs(profit)}` : 'Égalité';
    const message = `${icon} ${result} — ${outcome}`;

    this.isSpinning = false;
    this.balanceService.save(newBalance);
    this.statsService.report({
      game: 'roulette',
      won: profit > 0,
      amountWon: profit > 0 ? profit : 0,
      amountLost: profit < 0 ? Math.abs(profit) : 0,
      amountBet: totalBet,
      wasAllIn: false,
      currentBalance: newBalance,
    });
    this.gameState.update(s => ({
      ...s,
      phase: RoulettePhase.RESULT,
      result,
      balance: newBalance,
      message,
      history: [
        { timestamp: new Date(), result, color, totalBet, profit, balance: newBalance },
        ...s.history,
      ].slice(0, 10),
    }));
  }

  newRound(): void {
    this.gameState.update(s => ({
      ...s,
      phase: RoulettePhase.BETTING,
      bets: {},
      result: null,
      message: 'Placez vos mises',
    }));
  }

  // ── Result helpers ──────────────────────────────────────────────────────────

  isWinningZone(key: string): boolean {
    const r = this.gameState().result;
    return r !== null && this.gameState().phase === RoulettePhase.RESULT && this.isWinningBet(key, r);
  }
}
