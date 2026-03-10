import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { BalanceService } from '../services/balance.service';
import { StatsService } from '../services/stats.service';
import { GameHeader } from '../game-header/game-header';

export enum BaccaratPhase {
  BETTING = 'BETTING',
  PLAYING = 'PLAYING',
  RESULT = 'RESULT'
}

export enum Suit {
  SPADES = '♠',
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣'
}

export enum Rank {
  ACE = 'A',
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K'
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface BaccaratHistory {
  timestamp: Date;
  result: 'player' | 'banker' | 'tie';
  bets: { player: number; banker: number; tie: number };
  profit: number;
  balance: number;
}

export interface BaccaratState {
  phase: BaccaratPhase;
  deck: Card[];
  playerCards: Card[];
  bankerCards: Card[];
  bets: { player: number; banker: number; tie: number };
  balance: number;
  message: string;
  result: 'player' | 'banker' | 'tie' | null;
  history: BaccaratHistory[];
}

@Component({
  selector: 'app-baccarat',
  standalone: true,
  imports: [CommonModule, GameHeader],
  templateUrl: './baccarat.html',
  styleUrls: ['./baccarat.css']
})
export class Baccarat implements OnInit {
  BaccaratPhase = BaccaratPhase;

  gameState = signal<BaccaratState>({
    phase: BaccaratPhase.BETTING,
    deck: [],
    playerCards: [],
    bankerCards: [],
    bets: { player: 0, banker: 0, tie: 0 },
    balance: 0,
    message: 'Placez vos mises',
    result: null,
    history: []
  });

  isResolving = false;
  betInputs = { player: 0, banker: 0, tie: 0 };
  lastBetInputs = { player: 0, banker: 0, tie: 0 };

  constructor(private balanceService: BalanceService, private statsService: StatsService) {
    toObservable(balanceService.balance).pipe(
      filter(b => b > 0),
      takeUntilDestroyed()
    ).subscribe(b => {
      this.gameState.update(s => ({ ...s, balance: b }));
    });
  }

  ngOnInit(): void {
    this.balanceService.load();
  }

  gamesPlayed = computed(() => this.gameState().history.length);
  gamesWon = computed(() => this.gameState().history.filter(h => h.profit > 0).length);
  gamesLost = computed(() => this.gameState().history.filter(h => h.profit < 0).length);
  profitLoss = computed(() => Math.round(this.gameState().history.reduce((sum, h) => sum + h.profit, 0) * 100) / 100);

  // ── Deck ────────────────────────────────────────────────────────────────────

  private createDeck(): Card[] {
    const suits = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
    const ranks = [
      Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX,
      Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING
    ];
    const deck: Card[] = [];
    for (let d = 0; d < 8; d++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({ suit, rank });
        }
      }
    }
    return this.shuffle(deck);
  }

  private shuffle(deck: Card[]): Card[] {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  private drawCard(deck: Card[]): Card {
    if (deck.length < 20) {
      const fresh = this.createDeck();
      deck.splice(0, deck.length, ...fresh);
    }
    return deck.pop()!;
  }

  // ── Card / hand value ────────────────────────────────────────────────────────

  private cardValue(card: Card): number {
    if (card.rank === Rank.ACE) return 1;
    if ([Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING].includes(card.rank)) return 0;
    return parseInt(card.rank);
  }

  handValue(cards: Card[]): number {
    return cards.reduce((sum, c) => sum + this.cardValue(c), 0) % 10;
  }

  // ── Betting ──────────────────────────────────────────────────────────────────

  addChip(target: 'player' | 'banker' | 'tie', amount: number): void {
    this.betInputs[target] += amount;
  }

  allIn(target: 'player' | 'banker' | 'tie'): void {
    const others = (['player', 'banker', 'tie'] as const)
      .filter(k => k !== target)
      .reduce((sum, k) => sum + this.betInputs[k], 0);
    const remaining = this.gameState().balance - others;
    if (remaining > 0) this.betInputs[target] = remaining;
  }

  clearBet(target: 'player' | 'banker' | 'tie'): void {
    this.betInputs[target] = 0;
  }

  totalBetInput(): number {
    return this.betInputs.player + this.betInputs.banker + this.betInputs.tie;
  }

  canDeal(): boolean {
    const hasAtLeastOneBet = this.betInputs.player > 0 || this.betInputs.banker > 0 || this.betInputs.tie > 0;
    return hasAtLeastOneBet && this.totalBetInput() <= this.gameState().balance;
  }

  // ── Game flow ────────────────────────────────────────────────────────────────

  deal(): void {
    if (!this.canDeal()) return;

    this.lastBetInputs = { ...this.betInputs };

    const state = this.gameState();
    const deck = state.deck.length === 0 ? this.createDeck() : [...state.deck];
    const bets = { ...this.betInputs };
    const balanceAfterBets = state.balance - this.totalBetInput();

    // Pre-calculate all cards upfront
    const p1 = this.drawCard(deck);
    const b1 = this.drawCard(deck);
    const p2 = this.drawCard(deck);
    const b2 = this.drawCard(deck);

    const playerBase = [p1, p2];
    const bankerBase = [b1, b2];
    const pv = this.handValue(playerBase);
    const bv = this.handValue(bankerBase);

    let playerThird: Card | null = null;
    let bankerThird: Card | null = null;

    if (pv < 8 && bv < 8) {
      // Player draws on 0–5
      if (pv <= 5) {
        playerThird = this.drawCard(deck);
      }

      // Banker third-card rules
      if (playerThird === null) {
        if (bv <= 5) bankerThird = this.drawCard(deck);
      } else {
        const pt = this.cardValue(playerThird);
        if (bv <= 2) {
          bankerThird = this.drawCard(deck);
        } else if (bv === 3 && pt !== 8) {
          bankerThird = this.drawCard(deck);
        } else if (bv === 4 && pt >= 2 && pt <= 7) {
          bankerThird = this.drawCard(deck);
        } else if (bv === 5 && pt >= 4 && pt <= 7) {
          bankerThird = this.drawCard(deck);
        } else if (bv === 6 && pt >= 6 && pt <= 7) {
          bankerThird = this.drawCard(deck);
        }
        // bv === 7 : stands
      }
    }

    const finalPlayerCards = playerThird ? [...playerBase, playerThird] : playerBase;
    const finalBankerCards = bankerThird ? [...bankerBase, bankerThird] : bankerBase;

    this.isResolving = true;
    this.gameState.set({
      ...state,
      deck,
      bets,
      balance: balanceAfterBets,
      phase: BaccaratPhase.PLAYING,
      playerCards: [],
      bankerCards: [],
      result: null,
      message: 'Distribution des cartes...'
    });

    // Reveal cards one by one
    let delay = 400;
    const after = (fn: () => void) => { setTimeout(fn, delay); delay += 500; };

    after(() => this.gameState.update(s => ({ ...s, playerCards: [p1] })));
    after(() => this.gameState.update(s => ({ ...s, bankerCards: [b1] })));
    after(() => this.gameState.update(s => ({ ...s, playerCards: [...s.playerCards, p2] })));
    after(() => this.gameState.update(s => ({ ...s, bankerCards: [...s.bankerCards, b2] })));
    if (playerThird) after(() => this.gameState.update(s => ({ ...s, playerCards: [...s.playerCards, playerThird!] })));
    if (bankerThird) after(() => this.gameState.update(s => ({ ...s, bankerCards: [...s.bankerCards, bankerThird!] })));

    after(() => this.resolveGame(finalPlayerCards, finalBankerCards, bets, balanceAfterBets));
  }

  private resolveGame(
    playerCards: Card[],
    bankerCards: Card[],
    bets: { player: number; banker: number; tie: number },
    balanceAfterBets: number
  ): void {
    const pv = this.handValue(playerCards);
    const bv = this.handValue(bankerCards);

    let result: 'player' | 'banker' | 'tie';
    if (pv > bv) result = 'player';
    else if (bv > pv) result = 'banker';
    else result = 'tie';

    let winnings = 0;
    if (result === 'player') {
      winnings = bets.player * 2; // bet returned + 1:1
    } else if (result === 'banker') {
      winnings = Math.round((bets.banker + bets.banker * 0.95) * 100) / 100; // 5% commission
    } else {
      // Tie: player & banker bets pushed (returned), tie pays 8:1
      winnings = bets.player + bets.banker + bets.tie * 9;
    }

    const totalBet = bets.player + bets.banker + bets.tie;
    const profit = Math.round((winnings - totalBet) * 100) / 100;
    const newBalance = Math.round((balanceAfterBets + winnings) * 100) / 100;

    let message: string;
    if (result === 'player') message = `Joueur gagne ! (${pv} contre ${bv})`;
    else if (result === 'banker') message = `Banquier gagne ! (${bv} contre ${pv})`;
    else message = `Égalité ! Les deux ont ${pv}`;

    const entry: BaccaratHistory = {
      timestamp: new Date(),
      result,
      bets: { ...bets },
      profit,
      balance: newBalance
    };

    this.isResolving = false;
    this.balanceService.save(newBalance);
    this.statsService.report({
      game: 'baccarat',
      won: profit > 0,
      amountWon: profit > 0 ? profit : 0,
      amountLost: profit < 0 ? Math.abs(profit) : 0,
      amountBet: totalBet,
      wasAllIn: false,
      currentBalance: newBalance,
    });
    this.gameState.update(s => ({
      ...s,
      phase: BaccaratPhase.RESULT,
      result,
      balance: newBalance,
      message,
      history: [entry, ...s.history].slice(0, 10)
    }));
  }

  canReplay(): boolean {
    const total = this.lastBetInputs.player + this.lastBetInputs.banker + this.lastBetInputs.tie;
    return total > 0 && total <= this.gameState().balance;
  }

  replayLastHand(): void {
    if (!this.canReplay()) return;
    this.gameState.update(s => ({
      ...s,
      phase: BaccaratPhase.BETTING,
      playerCards: [],
      bankerCards: [],
      result: null,
      message: 'Placez vos mises'
    }));
    this.betInputs = { ...this.lastBetInputs };
    this.deal();
  }

  newRound(): void {
    if (this.gameState().balance < 1) {
      this.gameState.update(s => ({ ...s, message: 'Solde insuffisant ! Partie terminée.' }));
      return;
    }
    this.betInputs = { player: 0, banker: 0, tie: 0 };
    this.gameState.update(s => ({
      ...s,
      phase: BaccaratPhase.BETTING,
      playerCards: [],
      bankerCards: [],
      result: null,
      message: 'Placez vos mises'
    }));
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────

  getCardColor(suit: Suit): string {
    return suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'red' : 'black';
  }

  getResultLabel(result: 'player' | 'banker' | 'tie'): string {
    if (result === 'player') return 'Joueur';
    if (result === 'banker') return 'Banquier';
    return 'Égalité';
  }
}
