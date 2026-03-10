import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameHeader } from '../game-header/game-header';
import { BaseGame, CHIP_VALUES } from '../base-game';

export enum HiLoPhase {
  BETTING = 'BETTING',
  PLAYING = 'PLAYING',
  REVEALED = 'REVEALED',
}

export enum Suit {
  SPADES = '♠',
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣',
}

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export interface Card {
  suit: Suit;
  rank: string;
  value: number;
}

export interface HiLoHistory {
  timestamp: Date;
  bet: number;
  streak: number;
  multiplier: number;
  profit: number;
  balance: number;
  cashedOut: boolean;
}

export interface HiLoState {
  phase: HiLoPhase;
  balance: number;
  currentCard: Card | null;
  nextCard: Card | null;
  bet: number;
  streak: number;
  multiplier: number;
  lastGuess: 'higher' | 'lower' | null;
  guessResult: 'win' | 'lose' | 'tie' | null;
  message: string;
  history: HiLoHistory[];
  deck: Card[];
}

@Component({
  selector: 'app-hilo',
  standalone: true,
  imports: [CommonModule, GameHeader],
  templateUrl: './hilo.html',
  styleUrl: './hilo.css',
})
export class HiLo extends BaseGame implements OnInit {
  protected readonly gameName = 'hilo';

  readonly HiLoPhase = HiLoPhase;
  readonly CHIP_VALUES = CHIP_VALUES;

  gameState = signal<HiLoState>({
    phase: HiLoPhase.BETTING,
    balance: 0,
    currentCard: null,
    nextCard: null,
    bet: 0,
    streak: 0,
    multiplier: 1,
    lastGuess: null,
    guessResult: null,
    message: 'Placez votre mise pour commencer',
    history: [],
    deck: [],
  });

  gamesPlayed = computed(() => this.gameState().history.length);
  gamesWon = computed(() => this.gameState().history.filter(h => h.cashedOut).length);
  gamesLost = computed(() => this.gameState().history.filter(h => !h.cashedOut).length);
  profitLoss = computed(() =>
    Math.round(this.gameState().history.reduce((s, h) => s + h.profit, 0) * 100) / 100,
  );

  pendingCashout = computed(() => {
    const s = this.gameState();
    return Math.round(s.bet * s.multiplier * 100) / 100;
  });

  higherMultiplier = computed(() => {
    const card = this.gameState().currentCard;
    return card ? this.calcMultiplier(card.value, 'higher') : 0;
  });

  lowerMultiplier = computed(() => {
    const card = this.gameState().currentCard;
    return card ? this.calcMultiplier(card.value, 'lower') : 0;
  });

  protected override onBalanceUpdate(balance: number): void {
    this.gameState.update(s => ({ ...s, balance }));
  }

  // ── Betting ──────────────────────────────────────────────────────────────

  addChip(amount: number): void {
    const s = this.gameState();
    if (s.phase !== HiLoPhase.BETTING) return;
    this.gameState.update(gs => ({ ...gs, bet: Math.min(gs.bet + amount, gs.balance) }));
  }

  allIn(): void {
    const s = this.gameState();
    if (s.phase !== HiLoPhase.BETTING) return;
    this.gameState.update(gs => ({ ...gs, bet: gs.balance }));
  }

  clearBet(): void {
    if (this.gameState().phase !== HiLoPhase.BETTING) return;
    this.gameState.update(gs => ({ ...gs, bet: 0 }));
  }

  canDeal(): boolean {
    const s = this.gameState();
    return s.phase === HiLoPhase.BETTING && s.bet > 0 && s.bet <= s.balance;
  }

  deal(): void {
    if (!this.canDeal()) return;
    const s = this.gameState();
    const deck = s.deck.length < 5 ? this.createDeck() : s.deck;
    const [card, newDeck] = this.drawFrom(deck);

    this.gameState.set({
      ...s,
      phase: HiLoPhase.PLAYING,
      balance: s.balance - s.bet,
      currentCard: card,
      nextCard: null,
      streak: 0,
      multiplier: 1,
      lastGuess: null,
      guessResult: null,
      deck: newDeck,
      message: `Carte : ${card.rank}${card.suit} — Plus haut ou plus bas ?`,
    });
  }

  // ── Guessing ─────────────────────────────────────────────────────────────

  canGuessHigher(): boolean {
    const card = this.gameState().currentCard;
    return card !== null && card.value < 14;
  }

  canGuessLower(): boolean {
    const card = this.gameState().currentCard;
    return card !== null && card.value > 2;
  }

  guess(direction: 'higher' | 'lower'): void {
    const s = this.gameState();
    if (s.phase !== HiLoPhase.PLAYING || !s.currentCard) return;

    const deck = s.deck.length < 5 ? this.createDeck() : s.deck;
    const [nextCard, newDeck] = this.drawFrom(deck);

    const result = this.resolveGuess(s.currentCard.value, nextCard.value, direction);

    let newMultiplier = s.multiplier;
    let newStreak = s.streak;

    if (result === 'win') {
      newMultiplier = Math.round(s.multiplier * this.calcMultiplier(s.currentCard.value, direction) * 100) / 100;
      newStreak++;
    }

    const cashoutAmount = Math.round(s.bet * newMultiplier * 100) / 100;

    const message =
      result === 'win'
        ? `✓ ${nextCard.rank}${nextCard.suit} ! Streak ×${newStreak} — Cashout : $${cashoutAmount}`
        : result === 'lose'
          ? `✗ ${nextCard.rank}${nextCard.suit} — Perdu ! Mise de $${s.bet} perdue.`
          : `= ${nextCard.rank}${nextCard.suit} — Égalité, la mise continue !`;

    const updatedState: HiLoState = {
      ...s,
      phase: HiLoPhase.REVEALED,
      nextCard,
      deck: newDeck,
      multiplier: newMultiplier,
      streak: newStreak,
      lastGuess: direction,
      guessResult: result,
      message,
    };

    if (result === 'lose') {
      const entry = this.buildHistory(s, false);
      updatedState.history = [entry, ...s.history].slice(0, 10);
      this.gameState.set(updatedState);
      this.balanceService.save(s.balance);
      this.statsService.report({
        game: 'hilo',
        won: false,
        amountWon: 0,
        amountLost: s.bet,
        amountBet: s.bet,
        wasAllIn: false,
        currentBalance: s.balance,
      });
    } else {
      this.gameState.set(updatedState);
    }
  }

  // ── Post-reveal actions ───────────────────────────────────────────────────

  continueStreak(): void {
    const s = this.gameState();
    if (s.phase !== HiLoPhase.REVEALED || !s.nextCard || s.guessResult === 'lose') return;

    this.gameState.set({
      ...s,
      phase: HiLoPhase.PLAYING,
      currentCard: s.nextCard,
      nextCard: null,
      lastGuess: null,
      guessResult: null,
      message: `Streak ×${s.streak} — Carte : ${s.nextCard.rank}${s.nextCard.suit} — Plus haut ou plus bas ?`,
    });
  }

  cashOut(): void {
    const s = this.gameState();
    const canCashout =
      (s.phase === HiLoPhase.REVEALED && s.guessResult === 'win') ||
      (s.phase === HiLoPhase.PLAYING && s.streak > 0);
    if (!canCashout) return;

    let winnings = Math.round(s.bet * s.multiplier * 100) / 100;
    const rawProfit = winnings - s.bet;
    if (rawProfit > 0 && this.gameBoost > 0) {
      winnings = Math.round((s.bet + rawProfit * (1 + this.gameBoost / 100)) * 100) / 100;
    }
    const newBalance = s.balance + winnings;
    const entry = this.buildHistory({ ...s, balance: newBalance }, true);

    this.gameState.set({
      ...s,
      phase: HiLoPhase.BETTING,
      balance: newBalance,
      currentCard: null,
      nextCard: null,
      bet: 0,
      streak: 0,
      multiplier: 1,
      lastGuess: null,
      guessResult: null,
      history: [entry, ...s.history].slice(0, 10),
      message: `Cashout ! +$${winnings - s.bet} encaissé${winnings - s.bet === 0 ? '' : ''}`,
    });

    this.balanceService.save(newBalance);
    this.statsService.report({
      game: 'hilo',
      won: true,
      amountWon: winnings - s.bet,
      amountLost: 0,
      amountBet: s.bet,
      wasAllIn: false,
      currentBalance: newBalance,
      hiloStreak: s.streak,
    });
  }

  newRound(): void {
    this.gameState.update(s => ({
      ...s,
      phase: HiLoPhase.BETTING,
      currentCard: null,
      nextCard: null,
      bet: 0,
      streak: 0,
      multiplier: 1,
      lastGuess: null,
      guessResult: null,
      message: 'Placez votre mise pour commencer',
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  calcMultiplier(currentValue: number, direction: 'higher' | 'lower'): number {
    const favorable = direction === 'higher' ? (14 - currentValue) * 4 : (currentValue - 2) * 4;
    if (favorable === 0) return 0;
    return Math.round((51 / favorable) * 0.97 * 100) / 100;
  }

  getCardColor(suit: Suit): string {
    return suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'red' : 'black';
  }

  private resolveGuess(
    current: number,
    next: number,
    direction: 'higher' | 'lower',
  ): 'win' | 'lose' | 'tie' {
    if (next === current) return 'tie';
    if (direction === 'higher') return next > current ? 'win' : 'lose';
    return next < current ? 'win' : 'lose';
  }

  private buildHistory(s: HiLoState, cashedOut: boolean): HiLoHistory {
    const winnings = cashedOut ? Math.round(s.bet * s.multiplier * 100) / 100 : 0;
    return {
      timestamp: new Date(),
      bet: s.bet,
      streak: s.streak,
      multiplier: cashedOut ? s.multiplier : 0,
      profit: cashedOut ? winnings - s.bet : -s.bet,
      balance: s.balance,
      cashedOut,
    };
  }

  private createDeck(): Card[] {
    const suits = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank, value: RANK_VALUE[rank] });
      }
    }
    return this.shuffle(deck);
  }

  private drawFrom(deck: Card[]): [Card, Card[]] {
    const card = deck[deck.length - 1];
    return [card, deck.slice(0, -1)];
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
