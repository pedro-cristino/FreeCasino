import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';

export interface LeaderboardEntry {
  username: string;
  score: number;
  savedAt: string;
}

@Injectable({ providedIn: 'root' })
export class HighScoreService {
  private readonly apiUrl = 'https://localhost:7118/api/highscore';

  myBest = signal<number>(0);
  myRank = signal<number | null>(null);

  constructor(private http: HttpClient) {}

  loadMyBest(): void {
    this.http.get<{ score: number; rank: number | null }>(`${this.apiUrl}/me`).subscribe(r => {
      this.myBest.set(r.score);
      this.myRank.set(r.rank);
    });
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(this.apiUrl);
  }

  saveScore(): Observable<{ score: number; balance: number }> {
    return this.http.post<{ score: number; balance: number }>(this.apiUrl, {}).pipe(
      tap(r => {
        if (r.score > this.myBest()) this.myBest.set(r.score);
      })
    );
  }
}
