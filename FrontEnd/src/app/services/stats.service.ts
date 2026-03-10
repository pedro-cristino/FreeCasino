import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, concatMap, catchError, EMPTY } from 'rxjs';

export interface GameResult {
  game: string;
  won: boolean;
  amountWon: number;
  amountLost: number;
  amountBet: number;
  wasAllIn: boolean;
  currentBalance: number;
  wasBlackjack?: boolean;
  wasSplit?: boolean;
  crashMultiplier?: number;
  hiloStreak?: number;
}

export interface UserStats {
  username: string;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalAmountWon: number;
  totalAmountLost: number;
  maxWinAmount: number;
  maxWinPercent: number;
  maxLossAmount: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentWinStreak: number;
  currentLossStreak: number;
  maxConsecutiveAllIns: number;
  totalAllIns: number;
  highestBalance: number;
  blackjackHandsPlayed: number;
  baccaratGamesPlayed: number;
  rouletteGamesPlayed: number;
  slotsGamesPlayed: number;
  minesGamesPlayed: number;
  plinkoGamesPlayed: number;
  crashGamesPlayed: number;
  hiloGamesPlayed: number;
  blackjackWins: number;
  baccaratWins: number;
  rouletteWins: number;
  slotsWins: number;
  minesWins: number;
  plinkoWins: number;
  crashWins: number;
  hiloWins: number;
  blackjackBlackjacks: number;
  blackjackSplits: number;
  crashMaxMultiplier: number;
  hiloMaxStreak: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private apiUrl = 'https://localhost:7118/api/stats';
  private queue$ = new Subject<GameResult>();

  constructor(private http: HttpClient) {
    // Process reports one at a time — prevents concurrent SQLite writes
    this.queue$.pipe(
      concatMap(result =>
        this.http.post(`${this.apiUrl}/game`, result).pipe(catchError(() => EMPTY))
      )
    ).subscribe();
  }

  report(result: GameResult): void {
    this.queue$.next(result);
  }

  getStats() {
    return this.http.get<UserStats>(this.apiUrl);
  }

  resetStats() {
    return this.http.delete(`${this.apiUrl}/reset`);
  }
}
