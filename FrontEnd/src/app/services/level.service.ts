import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface LevelInfo {
  level: number;
  levelName: string;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progress: number;
}

export interface LevelLeaderboardEntry {
  username: string;
  level: number;
  levelName: string;
  xp: number;
}

@Injectable({ providedIn: 'root' })
export class LevelService {
  readonly levelInfo = signal<LevelInfo | null>(null);
  private apiUrl = `${environment.apiUrl}/api/user/level`;

  constructor(private http: HttpClient) {}

  refresh(): void {
    this.http.get<LevelInfo>(this.apiUrl).subscribe(info => this.levelInfo.set(info));
  }

  getLevelLeaderboard() {
    return this.http.get<LevelLeaderboardEntry[]>(`${environment.apiUrl}/api/highscore/levels`);
  }
}
