import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsService, UserStats } from '../services/stats.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats implements OnInit {
  stats = signal<UserStats | null>(null);

  readonly games: {
    key: string;
    label: string;
    emoji: string;
    played: (s: UserStats) => number;
    wins: (s: UserStats) => number;
    extras: (s: UserStats) => { label: string; value: string }[];
  }[] = [
    {
      key: 'blackjack', label: 'Blackjack', emoji: '🃏',
      played: s => s.blackjackHandsPlayed,
      wins:   s => s.blackjackWins,
      extras: s => [
        { label: 'Blackjacks naturels', value: String(s.blackjackBlackjacks) },
        { label: 'Splits',              value: String(s.blackjackSplits) },
      ],
    },
    {
      key: 'baccarat', label: 'Baccarat', emoji: '🎴',
      played: s => s.baccaratGamesPlayed,
      wins:   s => s.baccaratWins,
      extras: () => [],
    },
    {
      key: 'roulette', label: 'Roulette', emoji: '🎡',
      played: s => s.rouletteGamesPlayed,
      wins:   s => s.rouletteWins,
      extras: () => [],
    },
    {
      key: 'slots', label: 'Slots', emoji: '🎰',
      played: s => s.slotsGamesPlayed,
      wins:   s => s.slotsWins,
      extras: () => [],
    },
    {
      key: 'mines', label: 'Mines', emoji: '💣',
      played: s => s.minesGamesPlayed,
      wins:   s => s.minesWins,
      extras: () => [],
    },
    {
      key: 'plinko', label: 'Plinko', emoji: '🔵',
      played: s => s.plinkoGamesPlayed,
      wins:   s => s.plinkoWins,
      extras: () => [],
    },
    {
      key: 'crash', label: 'Crash', emoji: '🚀',
      played: s => s.crashGamesPlayed,
      wins:   s => s.crashWins,
      extras: s => [
        { label: 'Meilleur cashout', value: s.crashMaxMultiplier > 0 ? `×${s.crashMaxMultiplier}` : '—' },
      ],
    },
    {
      key: 'hilo', label: 'Hi-Lo', emoji: '🎲',
      played: s => s.hiloGamesPlayed,
      wins:   s => s.hiloWins,
      extras: s => [
        { label: 'Meilleur streak', value: String(s.hiloMaxStreak) },
      ],
    },
  ];

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.statsService.getStats().subscribe(s => this.stats.set(s));
  }

  winRate(played: number, wins: number): number {
    if (played === 0) return 0;
    return Math.round((wins / played) * 100);
  }

  net(s: UserStats): number {
    return Math.round((s.totalAmountWon - s.totalAmountLost) * 100) / 100;
  }
}
