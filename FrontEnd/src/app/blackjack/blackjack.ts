import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BalanceService } from '../services/balance.service';
import { StatsService } from '../services/stats.service';
import { AchievementsService } from '../services/achievements.service';
import { GameHeader } from '../game-header/game-header';

// Enums
export enum GamePhase {
  SEAT_SELECTION = 'SEAT_SELECTION',
  BETTING = 'BETTING',
  DEALING = 'DEALING',
  PLAYER_TURN = 'PLAYER_TURN',
  DEALER_TURN = 'DEALER_TURN',
  RESULTS = 'RESULTS'
}

export enum HandStatus {
  ACTIVE = 'ACTIVE',
  STAND = 'STAND',
  BUST = 'BUST',
  BLACKJACK = 'BLACKJACK',
  WIN = 'WIN',
  LOSS = 'LOSS',
  PUSH = 'PUSH'
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

// Interfaces
export interface Card {
  suit: Suit;
  rank: Rank;
  faceDown?: boolean;
}

export interface Hand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  value?: number;
  isSoft?: boolean;
}

export interface Seat {
  index: number;
  active: boolean;
  mainHand: Hand;
  splitHand?: Hand;
}

export interface GameHistory {
  timestamp: Date;
  seats: number;
  totalBet: number;
  result: number;
  balance: number;
}

export interface GameState {
  phase: GamePhase;
  deck: Card[];
  dealerHand: Hand;
  seats: Seat[];
  activeSeatIndex: number;
  activeHandIndex: number;
  playerBalance: number;
  history: GameHistory[];
  selectedSeatsCount: number;
  message: string;
}

@Component({
  selector: 'app-blackjack',
  standalone: true,
  imports: [CommonModule, FormsModule, GameHeader],
  templateUrl: './blackjack.html',
  styleUrls: ['./blackjack.css']
})
export class Blackjack implements OnInit {
  // Expose enums to template
  GamePhase = GamePhase;
  HandStatus = HandStatus;

  // State
  gameState = signal<GameState>({
    phase: GamePhase.SEAT_SELECTION,
    deck: [],
    dealerHand: { cards: [], bet: 0, status: HandStatus.ACTIVE },
    seats: [],
    activeSeatIndex: -1,
    activeHandIndex: 0,
    playerBalance: 0,
    history: [],
    selectedSeatsCount: 1,
    message: 'Select number of seats to play'
  });

  // Computed values
  totalBet = computed(() => {
    const state = this.gameState();
    return state.seats.reduce((sum, seat) => {
      if (!seat.active) return sum;
      let total = seat.mainHand.bet;
      if (seat.splitHand) total += seat.splitHand.bet;
      return sum + total;
    }, 0);
  });

  gamesPlayed = computed(() => this.gameState().history.length);

  gamesWon = computed(() =>
    this.gameState().history.filter(h => h.result > 0).length
  );

  gamesLost = computed(() =>
    this.gameState().history.filter(h => h.result < 0).length
  );

  profitLoss = computed(() => {
    const history = this.gameState().history;
    return Math.round(history.reduce((sum, h) => sum + h.result, 0) * 100) / 100;
  });

  // Betting inputs
  betInputs: { [key: number]: number } = {};
  lastBetInputs: { [key: number]: number } = {};
  lastSeatsCount = 1;

  isResolving = false;
  private gameBoost = 0;

  constructor(
    public authService: AuthService,
    private balanceService: BalanceService,
    private statsService: StatsService,
    private achievementsService: AchievementsService,
  ) {
    toObservable(balanceService.balance).pipe(
      filter(b => b > 0),
      takeUntilDestroyed()
    ).subscribe(b => {
      this.gameState.update(s => ({ ...s, playerBalance: b }));
    });
  }

  ngOnInit(): void {
    this.balanceService.load();
    this.achievementsService.getBoosts().subscribe(b => {
      this.gameBoost = b['blackjack'] ?? 0;
    });
  }

  logout(): void {
    this.authService.logout();
  }

  // Initialize deck with 6 decks
  private createDeck(): Card[] {
    const deck: Card[] = [];
    const suits = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
    const ranks = [
      Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX,
      Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING
    ];

    // 6 decks
    for (let d = 0; d < 6; d++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({ suit, rank });
        }
      }
    }

    return this.shuffleDeck(deck);
  }

  private shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private dealCard(faceDown = false): Card {
    const state = this.gameState();

    // Reshuffle if deck is low
    if (state.deck.length < 20) {
      state.deck = this.createDeck();
    }

    const card = state.deck.pop()!;
    card.faceDown = faceDown;
    return card;
  }

  // Hand evaluation
  private evaluateHand(hand: Hand): void {
    let value = 0;
    let aces = 0;

    for (const card of hand.cards) {
      if (card.faceDown) continue;

      if (card.rank === Rank.ACE) {
        aces++;
        value += 11;
      } else if ([Rank.JACK, Rank.QUEEN, Rank.KING].includes(card.rank)) {
        value += 10;
      } else {
        value += parseInt(card.rank);
      }
    }

    // Adjust for aces
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    hand.value = value;
    hand.isSoft = aces > 0;

    // Update status
    if (hand.cards.length === 2 && value === 21) {
      hand.status = HandStatus.BLACKJACK;
    } else if (value > 21) {
      hand.status = HandStatus.BUST;
    }
  }

  // Seat selection
  selectSeats(count: number): void {
    const state = this.gameState();

    this.gameState.set({
      ...state,
      selectedSeatsCount: count,
      seats: Array.from({ length: count }, (_, i) => ({
        index: i,
        active: true,
        mainHand: { cards: [], bet: 0, status: HandStatus.ACTIVE }
      })),
      phase: GamePhase.BETTING,
      message: `Place your bets (minimum $10 per seat)`
    });

    // Initialize bet inputs
    for (let i = 0; i < count; i++) {
      this.betInputs[i] = 10;
    }
  }

  // Betting
  totalBetInput(): number {
    return Object.values(this.betInputs).reduce((sum, bet) => sum + bet, 0);
  }

  addChipToBet(seatIndex: number, amount: number): void {
    const current = this.betInputs[seatIndex] || 0;
    this.betInputs[seatIndex] = current + amount;
  }

  canPlaceBets(): boolean {
    const state = this.gameState();

    // Check all seats have bets >= 10
    for (let i = 0; i < state.selectedSeatsCount; i++) {
      const bet = this.betInputs[i] || 0;
      if (bet < 10) return false;
    }

    // Check total bet doesn't exceed balance
    const totalBet = Object.values(this.betInputs).reduce((sum, bet) => sum + bet, 0);
    return totalBet <= state.playerBalance;
  }

  allInSeat(seatIndex: number): void {
    const state = this.gameState();
    const otherBets = Object.entries(this.betInputs)
      .filter(([k]) => parseInt(k) !== seatIndex)
      .reduce((sum, [, v]) => sum + v, 0);
    const remaining = state.playerBalance - otherBets;
    if (remaining > 0) this.betInputs[seatIndex] = remaining;
  }

  placeBets(): void {
    const state = this.gameState();

    if (!this.canPlaceBets()) return;

    // Save for replay
    this.lastBetInputs = { ...this.betInputs };
    this.lastSeatsCount = state.selectedSeatsCount;

    // Deduct bets from balance
    const totalBet = Object.values(this.betInputs).reduce((sum, bet) => sum + bet, 0);
    const newBalance = state.playerBalance - totalBet;

    // Update seats with bets
    const updatedSeats = state.seats.map(seat => ({
      ...seat,
      mainHand: { ...seat.mainHand, bet: this.betInputs[seat.index] }
    }));

    this.gameState.set({
      ...state,
      seats: updatedSeats,
      playerBalance: newBalance,
      phase: GamePhase.DEALING,
      message: 'Dealing cards...'
    });

    // Deal cards after a short delay
    setTimeout(() => this.dealInitialCards(), 500);
  }

  // Dealing
  private dealInitialCards(): void {
    const state = this.gameState();

    // Reset deck if needed
    if (state.deck.length === 0) {
      state.deck = this.createDeck();
    }

    // Deal first card to each seat
    for (const seat of state.seats) {
      if (seat.active) {
        seat.mainHand.cards.push(this.dealCard());
      }
    }

    // Deal first card to dealer (face up)
    state.dealerHand.cards.push(this.dealCard());

    // Deal second card to each seat
    for (const seat of state.seats) {
      if (seat.active) {
        seat.mainHand.cards.push(this.dealCard());
        this.evaluateHand(seat.mainHand);
      }
    }

    // Deal second card to dealer (face down)
    state.dealerHand.cards.push(this.dealCard(true));

    this.gameState.set({
      ...state,
      phase: GamePhase.PLAYER_TURN,
      activeSeatIndex: 0,
      activeHandIndex: 0
    });

    this.updateMessage();
    this.checkForBlackjacks();
  }

  private checkForBlackjacks(): void {
    const state = this.gameState();
    let allBlackjacksOrBusts = true;

    for (const seat of state.seats) {
      if (seat.active && seat.mainHand.status === HandStatus.ACTIVE) {
        allBlackjacksOrBusts = false;
        break;
      }
    }

    if (allBlackjacksOrBusts) {
      this.moveToNextPhase();
    } else {
      // If the current active seat already has a blackjack, advance past it
      const currentSeat = state.seats[state.activeSeatIndex];
      if (currentSeat && currentSeat.mainHand.status !== HandStatus.ACTIVE) {
        this.moveToNextHand();
      }
    }
  }

  // Player actions
  hit(): void {
    const state = this.gameState();
    const seat = state.seats[state.activeSeatIndex];
    const hand = state.activeHandIndex === 0 ? seat.mainHand : seat.splitHand!;

    hand.cards.push(this.dealCard());
    this.evaluateHand(hand);

    if (hand.status === HandStatus.BUST) {
      this.moveToNextHand();
    } else {
      this.gameState.set({ ...state });
      this.updateMessage();
    }
  }

  stand(): void {
    const state = this.gameState();
    const seat = state.seats[state.activeSeatIndex];
    const hand = state.activeHandIndex === 0 ? seat.mainHand : seat.splitHand!;

    hand.status = HandStatus.STAND;
    this.moveToNextHand();
  }

  doubleDown(): void {
    const state = this.gameState();
    const seat = state.seats[state.activeSeatIndex];
    const hand = state.activeHandIndex === 0 ? seat.mainHand : seat.splitHand!;

    // Check if player has enough balance
    if (state.playerBalance < hand.bet) {
      return;
    }

    // Double the bet
    state.playerBalance -= hand.bet;
    hand.bet *= 2;

    // Deal one card
    hand.cards.push(this.dealCard());
    this.evaluateHand(hand);

    // Automatically stand
    if (hand.status === HandStatus.ACTIVE) {
      hand.status = HandStatus.STAND;
    }

    this.moveToNextHand();
  }

  split(): void {
    const state = this.gameState();
    const seat = state.seats[state.activeSeatIndex];
    const mainHand = seat.mainHand;

    // Check if player has enough balance
    if (state.playerBalance < mainHand.bet) {
      return;
    }

    // Deduct bet for split hand
    state.playerBalance -= mainHand.bet;

    // Create split hand with second card
    const splitCard = mainHand.cards.pop()!;
    seat.splitHand = {
      cards: [splitCard],
      bet: mainHand.bet,
      status: HandStatus.ACTIVE
    };

    // Deal new cards to both hands
    mainHand.cards.push(this.dealCard());
    seat.splitHand.cards.push(this.dealCard());

    // Evaluate both hands
    this.evaluateHand(mainHand);
    this.evaluateHand(seat.splitHand);

    this.gameState.set({ ...state });
    this.updateMessage();
  }

  private moveToNextHand(): void {
    const state = this.gameState();
    const seat = state.seats[state.activeSeatIndex];

    // If on main hand and there's a split hand, move to split hand
    if (state.activeHandIndex === 0 && seat.splitHand) {
      state.activeHandIndex = 1;
      this.gameState.set({ ...state });
      this.updateMessage();
      return;
    }

    // Move to next seat
    let nextSeatIndex = state.activeSeatIndex + 1;

    // Find next active seat with active hands
    while (nextSeatIndex < state.seats.length) {
      const nextSeat = state.seats[nextSeatIndex];
      if (nextSeat.active &&
          (nextSeat.mainHand.status === HandStatus.ACTIVE ||
           (nextSeat.splitHand && nextSeat.splitHand.status === HandStatus.ACTIVE))) {
        state.activeSeatIndex = nextSeatIndex;
        state.activeHandIndex = 0;
        this.gameState.set({ ...state });
        this.updateMessage();
        return;
      }
      nextSeatIndex++;
    }

    // No more hands to play, move to dealer turn
    this.moveToNextPhase();
  }

  private moveToNextPhase(): void {
    const state = this.gameState();

    if (state.phase === GamePhase.PLAYER_TURN) {
      // Check if all hands are bust
      const allBust = state.seats.every(seat =>
        !seat.active ||
        (seat.mainHand.status === HandStatus.BUST &&
         (!seat.splitHand || seat.splitHand.status === HandStatus.BUST))
      );

      if (allBust) {
        // Skip dealer turn if all hands bust
        this.isResolving = true;
        this.gameState.set({
          ...state,
          phase: GamePhase.RESULTS,
          message: 'All hands bust! Dealer wins.'
        });
        setTimeout(() => this.resolveResults(), 1500);
      } else {
        this.isResolving = true;
        this.gameState.set({
          ...state,
          phase: GamePhase.DEALER_TURN,
          message: 'Dealer turn...'
        });
        setTimeout(() => this.playDealerTurn(), 1000);
      }
    }
  }

  private playDealerTurn(): void {
    const state = this.gameState();

    // Reveal face-down card
    state.dealerHand.cards.forEach(card => card.faceDown = false);
    this.evaluateHand(state.dealerHand);

    this.gameState.set({ ...state });

    // Dealer hits on 16 or less
    const dealerPlay = () => {
      const dealerValue = state.dealerHand.value!;

      if (dealerValue < 17) {
        setTimeout(() => {
          state.dealerHand.cards.push(this.dealCard());
          this.evaluateHand(state.dealerHand);
          this.gameState.set({ ...state });
          dealerPlay();
        }, 1000);
      } else {
        if (state.dealerHand.status === HandStatus.BUST) {
          state.message = `Dealer busts with ${dealerValue}!`;
        } else {
          state.message = `Dealer stands with ${dealerValue}`;
        }

        this.gameState.set({
          ...state,
          phase: GamePhase.RESULTS
        });

        setTimeout(() => this.resolveResults(), 1500);
      }
    };

    dealerPlay();
  }

  private resolveResults(): void {
    const state = this.gameState();
    const dealerValue = state.dealerHand.value!;
    const dealerBust = state.dealerHand.status === HandStatus.BUST;
    let totalWinnings = 0;

    type HandStat = { hand: Hand; wasBlackjack: boolean; wasSplit: boolean };
    const handStats: HandStat[] = [];

    for (const seat of state.seats) {
      if (!seat.active) continue;

      // Capture blackjack status before resolveHand() changes it
      const mainWasBlackjack = seat.mainHand.status === HandStatus.BLACKJACK;
      const hasSplit = !!seat.splitHand;

      totalWinnings += this.resolveHand(seat.mainHand, dealerValue, dealerBust, this.gameBoost);
      handStats.push({ hand: seat.mainHand, wasBlackjack: mainWasBlackjack, wasSplit: hasSplit });

      if (seat.splitHand) {
        totalWinnings += this.resolveHand(seat.splitHand, dealerValue, dealerBust, this.gameBoost);
        handStats.push({ hand: seat.splitHand, wasBlackjack: false, wasSplit: true });
      }
    }

    // Update balance
    state.playerBalance = Math.round((state.playerBalance + totalWinnings) * 100) / 100;

    // Add to history
    const historyEntry: GameHistory = {
      timestamp: new Date(),
      seats: state.selectedSeatsCount,
      totalBet: this.totalBet(),
      result: Math.round((totalWinnings - this.totalBet()) * 100) / 100,
      balance: state.playerBalance
    };
    state.history.unshift(historyEntry);
    if (state.history.length > 10) {
      state.history.pop();
    }

    state.message = `Round complete! ${totalWinnings > 0 ? `Won $${totalWinnings}` : totalWinnings < 0 ? `Lost $${Math.abs(totalWinnings - this.totalBet())}` : 'Push'}`;

    this.isResolving = false;
    this.gameState.set({ ...state });
    this.balanceService.save(state.playerBalance);

    for (const { hand, wasBlackjack, wasSplit } of handStats) {
      if (hand.status === HandStatus.PUSH) continue;
      const won = hand.status === HandStatus.WIN;
      const amountWon = won ? (wasBlackjack ? Math.round(hand.bet * 1.5 * 100) / 100 : hand.bet) : 0;
      this.statsService.report({
        game: 'blackjack',
        won,
        amountWon,
        amountLost: won ? 0 : hand.bet,
        amountBet: hand.bet,
        wasAllIn: false,
        currentBalance: state.playerBalance,
        wasBlackjack,
        wasSplit,
      });
    }
  }

  private resolveHand(hand: Hand, dealerValue: number, dealerBust: boolean, boostPct = 0): number {
    if (hand.status === HandStatus.BUST) {
      hand.status = HandStatus.LOSS;
      return 0;
    }

    const handValue = hand.value!;
    const m = 1 + boostPct / 100;

    if (hand.status === HandStatus.BLACKJACK) {
      if (dealerValue === 21 && this.gameState().dealerHand.cards.length === 2) {
        hand.status = HandStatus.PUSH;
        return hand.bet;
      } else {
        hand.status = HandStatus.WIN;
        // mise récupérée + profit BJ (×1.5) boosté
        return Math.round((hand.bet + hand.bet * 1.5 * m) * 100) / 100;
      }
    }

    if (dealerBust || handValue > dealerValue) {
      hand.status = HandStatus.WIN;
      // mise récupérée + profit (×1) boosté
      return Math.round((hand.bet + hand.bet * m) * 100) / 100;
    } else if (handValue === dealerValue) {
      hand.status = HandStatus.PUSH;
      return hand.bet;
    } else {
      hand.status = HandStatus.LOSS;
      return 0;
    }
  }

  canReplay(): boolean {
    if (Object.keys(this.lastBetInputs).length === 0) return false;
    const total = Object.values(this.lastBetInputs).reduce((a, b) => a + b, 0);
    return total > 0 && total <= this.gameState().playerBalance;
  }

  replayLastHand(): void {
    if (!this.canReplay()) return;
    const state = this.gameState();
    this.gameState.set({
      ...state,
      selectedSeatsCount: this.lastSeatsCount,
      seats: Array.from({ length: this.lastSeatsCount }, (_, i) => ({
        index: i,
        active: true,
        mainHand: { cards: [], bet: 0, status: HandStatus.ACTIVE }
      })),
      dealerHand: { cards: [], bet: 0, status: HandStatus.ACTIVE },
      phase: GamePhase.BETTING,
      activeSeatIndex: -1,
      activeHandIndex: 0,
      message: 'Place your bets (minimum $10 per seat)'
    });
    this.betInputs = { ...this.lastBetInputs };
    this.placeBets();
  }

  newRound(): void {
    const state = this.gameState();

    if (state.playerBalance < 10) {
      state.message = 'Insufficient balance! Game over.';
      this.gameState.set({ ...state });
      return;
    }

    this.gameState.set({
      ...state,
      phase: GamePhase.SEAT_SELECTION,
      deck: state.deck,
      dealerHand: { cards: [], bet: 0, status: HandStatus.ACTIVE },
      seats: [],
      activeSeatIndex: -1,
      activeHandIndex: 0,
      message: 'Select number of seats to play'
    });

    this.betInputs = {};
  }

  private updateMessage(): void {
    const state = this.gameState();

    if (state.phase === GamePhase.PLAYER_TURN) {
      const seat = state.seats[state.activeSeatIndex];
      const handType = state.activeHandIndex === 0 ? 'main' : 'split';
      const hand = state.activeHandIndex === 0 ? seat.mainHand : seat.splitHand!;

      state.message = `Seat ${seat.index + 1} (${handType} hand) - Value: ${hand.value}${hand.isSoft ? ' (soft)' : ''} - Choose action`;
      this.gameState.set({ ...state });
    }
  }

  // UI helpers
  canHit(): boolean {
    const state = this.gameState();
    if (state.phase !== GamePhase.PLAYER_TURN) return false;

    const seat = state.seats[state.activeSeatIndex];
    const hand = state.activeHandIndex === 0 ? seat.mainHand : seat.splitHand!;
    return hand.status === HandStatus.ACTIVE;
  }

  canStand(): boolean {
    return this.canHit();
  }

  canDouble(): boolean {
    const state = this.gameState();
    if (state.phase !== GamePhase.PLAYER_TURN) return false;

    const seat = state.seats[state.activeSeatIndex];
    const hand = state.activeHandIndex === 0 ? seat.mainHand : seat.splitHand!;

    return hand.cards.length === 2 &&
           hand.status === HandStatus.ACTIVE &&
           state.playerBalance >= hand.bet;
  }

  canSplit(): boolean {
    const state = this.gameState();
    if (state.phase !== GamePhase.PLAYER_TURN || state.activeHandIndex !== 0) return false;

    const seat = state.seats[state.activeSeatIndex];
    const hand = seat.mainHand;

    return !seat.splitHand &&
           hand.cards.length === 2 &&
           hand.cards[0].rank === hand.cards[1].rank &&
           hand.status === HandStatus.ACTIVE &&
           state.playerBalance >= hand.bet;
  }

  isActiveSeat(seatIndex: number): boolean {
    const state = this.gameState();
    return state.phase === GamePhase.PLAYER_TURN &&
           state.activeSeatIndex === seatIndex;
  }

  isActiveHand(seatIndex: number, handIndex: number): boolean {
    const state = this.gameState();
    return state.phase === GamePhase.PLAYER_TURN &&
           state.activeSeatIndex === seatIndex &&
           state.activeHandIndex === handIndex;
  }

  getCardColor(suit: Suit): string {
    return suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'red' : 'black';
  }

  getHandStatusLabel(status: HandStatus): string {
    switch (status) {
      case HandStatus.BLACKJACK: return 'BLACKJACK!';
      case HandStatus.BUST: return 'BUST';
      case HandStatus.WIN: return 'WIN';
      case HandStatus.LOSS: return 'LOSS';
      case HandStatus.PUSH: return 'PUSH';
      default: return '';
    }
  }
}
