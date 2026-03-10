import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Achievement {
  key: string;
  game: string;
  tier: string;
  name: string;
  description: string;
  winsRequired: number;
  boostPercent: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export type GameBoosts = Record<string, number>;

@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private apiUrl = `${environment.apiUrl}/api/achievements`;

  constructor(private http: HttpClient) {}

  getAchievements() {
    return this.http.get<Achievement[]>(this.apiUrl);
  }

  getBoosts() {
    return this.http.get<GameBoosts>(`${this.apiUrl}/boosts`);
  }
}
