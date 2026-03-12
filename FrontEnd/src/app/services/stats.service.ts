import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, concatMap, catchError, EMPTY, tap } from 'rxjs';
import { ToastService } from './toast.service';
import { LevelService } from './level.service';
import { environment } from '../../environments/environment';
import type { Observable } from 'rxjs';

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
  wasDouble?: boolean;
  crashMultiplier?: number;
  hiloStreak?: number;
  minesMultiplier?: number;
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
  blackjackDoubles: number;
  crashMaxMultiplier: number;
  hiloMaxStreak: number;
  minesMaxMultiplier: number;
  allInWins: number;
}

interface GameResponse {
  newAchievements: { key: string; name: string; description: string; boostPercent: number }[];
  levelUp: { level: number; name: string } | null;
  xpGained: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private apiUrl = `${environment.apiUrl}/api/stats`;
  private queue$ = new Subject<GameResult>();
  private resultSubject = new Subject<GameResult>();
  readonly gameResult$: Observable<GameResult> = this.resultSubject.asObservable();

  constructor(private http: HttpClient, private toastService: ToastService, private levelService: LevelService) {
    // Process reports one at a time — prevents concurrent SQLite writes
    this.queue$.pipe(
      concatMap(result =>
        this.http.post<GameResponse>(`${this.apiUrl}/game`, result).pipe(
          tap(res => {
            for (const a of res.newAchievements ?? []) {
              this.toastService.show(a.name, a.description, a.boostPercent);
            }
            if (res.levelUp) {
              this.toastService.showLevelUp(res.levelUp.level, res.levelUp.name);
            }
            this.levelService.refresh();
          }),
          catchError(() => EMPTY),
        ),
      ),
    ).subscribe();
  }

  private currentRunGames = new Set<string>();

  report(result: GameResult): void {
    this.currentRunGames.add(result.game);
    this.resultSubject.next(result);
    this.queue$.next(result);
  }

  getRunType(): string {
    if (this.currentRunGames.size === 1) return [...this.currentRunGames][0];
    return 'multiple';
  }

  clearRunGames(): void {
    this.currentRunGames.clear();
  }

  getStats() {
    return this.http.get<UserStats>(this.apiUrl);
  }

  resetStats() {
    return this.http.delete(`${this.apiUrl}/reset`);
  }
}
