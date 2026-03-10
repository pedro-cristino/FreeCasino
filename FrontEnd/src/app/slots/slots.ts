import { Component, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameHeader } from '../game-header/game-header';
import { BaseGame, CHIP_VALUES } from '../base-game';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
const SYMBOL_WEIGHTS = [30, 25, 20, 15, 6, 3, 1];

export const PAYOUTS: Record<string, number> = {
  '🍒': 2,
  '🍋': 3,
  '🍊': 4,
  '🍇': 6,
  '🔔': 10,
  '💎': 20,
  '7️⃣': 50,
};

export enum SlotsPhase {
  BETTING = 'BETTING',
  SPINNING = 'SPINNING',
  RESULT = 'RESULT',
}

export interface SlotsHistory {
  timestamp: Date;
  line: string[];
  bet: number;
  profit: number;
  balance: number;
}

function weightedRandom(): string {
  const total = SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= SYMBOL_WEIGHTS[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

function randomReel(): string[] {
  return Array.from({ length: 3 }, () => weightedRandom());
}

@Component({
  selector: 'app-slots',
  standalone: true,
  imports: [CommonModule, GameHeader],
  templateUrl: './slots.html',
  styleUrls: ['./slots.css'],
})
export class Slots extends BaseGame implements OnDestroy {
  protected readonly gameName = 'slots';

  readonly SlotsPhase = SlotsPhase;
  readonly PAYOUTS = PAYOUTS;
  readonly SYMBOLS = SYMBOLS;
  readonly CHIP_VALUES = CHIP_VALUES;

  phase = signal<SlotsPhase>(SlotsPhase.BETTING);
  balance = signal(0);
  message = signal('Placez votre mise et tournez !');
  displayReels = signal<string[][]>([randomReel(), randomReel(), randomReel()]);
  spinningReels = signal<boolean[]>([false, false, false]);
  history = signal<SlotsHistory[]>([]);
  bet = signal(0);

  gamesPlayed = computed(() => this.history().length);
  gamesWon = computed(() => this.history().filter(h => h.profit > 0).length);
  gamesLost = computed(() => this.history().filter(h => h.profit < 0).length);
  profitLoss = computed(() => Math.round(this.history().reduce((sum, h) => sum + h.profit, 0) * 100) / 100);

  private lastBetAmount = 0;
  private spinInterval: ReturnType<typeof setInterval> | null = null;
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  protected override onBalanceUpdate(b: number): void {
    this.balance.set(b);
  }

  override ngOnInit(): void {
    // Slots does not call balanceService.load()
    this.achievementsService.getBoosts().subscribe(boosts => {
      this.gameBoost = boosts[this.gameName] ?? 0;
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.spinInterval) {
      clearInterval(this.spinInterval);
      this.spinInterval = null;
    }
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];
  }

  addBet(chip: number): void {
    if (this.phase() !== SlotsPhase.BETTING) return;
    const maxAdd = this.balance() - this.bet();
    const add = Math.min(chip, maxAdd);
    if (add > 0) this.bet.update(b => b + add);
  }

  allIn(): void {
    if (this.phase() !== SlotsPhase.BETTING) return;
    this.bet.set(this.balance());
  }

  clearBet(): void {
    if (this.phase() !== SlotsPhase.BETTING) return;
    this.bet.set(0);
  }

  canSpin(): boolean {
    return this.bet() > 0 && this.phase() === SlotsPhase.BETTING;
  }

  canReplay(): boolean {
    return this.lastBetAmount > 0 && this.lastBetAmount <= this.balance();
  }

  replayLastHand(): void {
    if (!this.canReplay()) return;
    this.phase.set(SlotsPhase.BETTING);
    this.message.set('Placez votre mise et tournez !');
    this.bet.set(this.lastBetAmount);
    this.spin();
  }

  spin(): void {
    if (!this.canSpin()) return;

    const betAmount = this.bet();
    this.lastBetAmount = betAmount;
    this.balance.update(b => b - betAmount);
    this.phase.set(SlotsPhase.SPINNING);
    this.message.set('Bonne chance !');
    this.spinningReels.set([true, true, true]);

    const finalReels = [randomReel(), randomReel(), randomReel()];

    this.spinInterval = setInterval(() => {
      const spinning = this.spinningReels();
      this.displayReels.update(reels => reels.map((r, i) => (spinning[i] ? randomReel() : r)));
    }, 80);

    const stopReel = (index: number, delay: number): void => {
      const t = setTimeout(() => {
        this.spinningReels.update(s => s.map((v, i) => (i === index ? false : v)));
        this.displayReels.update(r => r.map((v, i) => (i === index ? finalReels[i] : v)));

        if (index === 2) {
          clearInterval(this.spinInterval!);
          this.spinInterval = null;
          this.resolveResult(betAmount, finalReels);
        }
      }, delay);
      this.timeouts.push(t);
    };

    stopReel(0, 800);
    stopReel(1, 1400);
    stopReel(2, 2000);
  }

  private resolveResult(betAmount: number, reels: string[][]): void {
    const line = reels.map(r => r[1]);
    const [s1, s2, s3] = line;

    let multiplier = 0;
    if (s1 === s2 && s2 === s3) {
      multiplier = PAYOUTS[s1] ?? 2;
    } else if (s1 === s2 || s2 === s3) {
      const sym = s1 === s2 ? s1 : s2;
      multiplier = Math.max(1, Math.floor((PAYOUTS[sym] ?? 2) / 3));
    }

    let winnings = Math.round(betAmount * multiplier * 100) / 100;
    const rawProfit = winnings - betAmount;
    if (rawProfit > 0 && this.gameBoost > 0) {
      winnings = Math.round((betAmount + rawProfit * (1 + this.gameBoost / 100)) * 100) / 100;
    }
    const profit = Math.round((winnings - betAmount) * 100) / 100;
    const newBalance = Math.round((this.balance() + winnings) * 100) / 100;

    let msg: string;
    if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
      msg = `🎰 JACKPOT ! 7️⃣7️⃣7️⃣ — +$${profit}`;
    } else if (multiplier === 0) {
      msg = `${line.join(' ')} — Perdu ! -$${betAmount}`;
    } else {
      msg = `${line.join(' ')} — Gagné ! +$${profit} (x${multiplier})`;
    }

    this.balance.set(newBalance);
    this.balanceService.save(newBalance);
    this.statsService.report({
      game: 'slots',
      won: profit > 0,
      amountWon: profit > 0 ? profit : 0,
      amountLost: profit < 0 ? Math.abs(profit) : 0,
      amountBet: betAmount,
      wasAllIn: false,
      currentBalance: newBalance,
    });
    this.message.set(msg);
    this.phase.set(SlotsPhase.RESULT);
    this.history.update(h =>
      [{ timestamp: new Date(), line, bet: betAmount, profit, balance: newBalance }, ...h].slice(
        0,
        10
      )
    );
  }

  newRound(): void {
    this.bet.set(0);
    this.phase.set(SlotsPhase.BETTING);
    this.message.set('Placez votre mise et tournez !');
  }
}
