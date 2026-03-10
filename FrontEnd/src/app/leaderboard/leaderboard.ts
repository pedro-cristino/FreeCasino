import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HighScoreService, LeaderboardEntry } from '../services/highscore.service';
import { LevelService, LevelLeaderboardEntry } from '../services/level.service';

const GAME_FILTERS: { key: string; label: string; emoji: string }[] = [
  { key: 'all',        label: 'Tous',      emoji: '🌐' },
  { key: 'blackjack',  label: 'Blackjack', emoji: '🃏' },
  { key: 'baccarat',   label: 'Baccarat',  emoji: '🎴' },
  { key: 'roulette',   label: 'Roulette',  emoji: '🎡' },
  { key: 'slots',      label: 'Slots',     emoji: '🎰' },
  { key: 'mines',      label: 'Mines',     emoji: '💣' },
  { key: 'plinko',     label: 'Plinko',    emoji: '🔵' },
  { key: 'crash',      label: 'Crash',     emoji: '🚀' },
  { key: 'hilo',       label: 'Hi-Lo',     emoji: '🎲' },
  { key: 'multiple',   label: 'Multiple',  emoji: '🎮' },
];

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.html',
  styleUrls: ['./leaderboard.css'],
})
export class Leaderboard implements OnInit {
  readonly filters = GAME_FILTERS;
  activeFilter = signal('all');

  entries = signal<LeaderboardEntry[]>([]);
  levelEntries = signal<LevelLeaderboardEntry[]>([]);
  loading = signal(true);
  levelLoading = signal(true);

  constructor(
    private highScoreService: HighScoreService,
    private levelService: LevelService,
  ) {}

  ngOnInit(): void {
    this.loadScores();
    this.levelService.getLevelLeaderboard().subscribe(data => {
      this.levelEntries.set(data);
      this.levelLoading.set(false);
    });
  }

  setFilter(key: string): void {
    this.activeFilter.set(key);
    this.loadScores();
  }

  private loadScores(): void {
    this.loading.set(true);
    const f = this.activeFilter();
    this.highScoreService.getLeaderboard(f === 'all' ? undefined : f).subscribe(data => {
      // Safety sort client-side in case DB returns wrong order (SQLite type affinity issue)
      this.entries.set([...data].sort((a, b) => b.score - a.score));
      this.loading.set(false);
    });
  }

  gameLabel(gameType: string): { label: string; emoji: string } {
    const found = GAME_FILTERS.find(f => f.key === gameType);
    return found ?? { label: gameType, emoji: '🎮' };
  }
}
