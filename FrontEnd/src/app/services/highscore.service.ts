import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LeaderboardEntry {
  username: string;
  score: number;
  gameType: string;
  savedAt: string;
}

@Injectable({ providedIn: 'root' })
export class HighScoreService {
  private readonly apiUrl = `${environment.apiUrl}/api/highscore`;

  myBest = signal<number>(0);
  myRank = signal<number | null>(null);

  constructor(private http: HttpClient) {}

  loadMyBest(): void {
    this.http.get<{ score: number; rank: number | null }>(`${this.apiUrl}/me`).subscribe(r => {
      this.myBest.set(r.score);
      this.myRank.set(r.rank);
    });
  }

  getLeaderboard(game?: string): Observable<LeaderboardEntry[]> {
    const url = game ? `${this.apiUrl}?game=${encodeURIComponent(game)}` : this.apiUrl;
    return this.http.get<LeaderboardEntry[]>(url);
  }

  saveScore(gameType: string): Observable<{ score: number; balance: number }> {
    return this.http.post<{ score: number; balance: number }>(this.apiUrl, { gameType }).pipe(
      tap(r => {
        if (r.score > this.myBest()) this.myBest.set(r.score);
      }),
    );
  }
}
