import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BalanceService } from '../services/balance.service';
import { HighScoreService } from '../services/highscore.service';

@Component({
  selector: 'app-navigation',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navigation.html',
  styleUrl: './navigation.css',
})
export class Navigation implements OnInit {
  showRestartConfirm = false;
  showSaveConfirm = false;
  gamesOpen = false;

  constructor(
    public authService: AuthService,
    public balanceService: BalanceService,
    public highScoreService: HighScoreService
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.balanceService.load();
      this.highScoreService.loadMyBest();
    }
  }

  restartRun(): void {
    this.balanceService.restart().subscribe();
    this.showRestartConfirm = false;
  }

  saveScore(): void {
    this.highScoreService.saveScore().subscribe(r => {
      this.balanceService.balance.set(0);
      this.balanceService.balance.set(r.balance);
      this.showSaveConfirm = false;
    });
  }
}
