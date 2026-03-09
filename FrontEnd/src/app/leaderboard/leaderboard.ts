import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HighScoreService, LeaderboardEntry } from '../services/highscore.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.html',
  styleUrls: ['./leaderboard.css']
})
export class Leaderboard implements OnInit {
  entries = signal<LeaderboardEntry[]>([]);
  loading = signal(true);

  constructor(private highScoreService: HighScoreService) {}

  ngOnInit(): void {
    this.highScoreService.getLeaderboard().subscribe(data => {
      this.entries.set(data);
      this.loading.set(false);
    });
  }
}
