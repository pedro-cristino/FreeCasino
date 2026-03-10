import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AchievementsService, Achievement } from '../services/achievements.service';

interface GameGroup {
  game: string;
  label: string;
  emoji: string;
  achievements: Achievement[];
}

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './achievements.html',
  styleUrl: './achievements.css',
})
export class Achievements implements OnInit {
  achievements = signal<Achievement[] | null>(null);

  private readonly gameMeta: { game: string; label: string; emoji: string }[] = [
    { game: 'blackjack', label: 'Blackjack', emoji: '🃏' },
    { game: 'baccarat',  label: 'Baccarat',  emoji: '🎴' },
    { game: 'roulette',  label: 'Roulette',  emoji: '🎡' },
    { game: 'slots',     label: 'Slots',     emoji: '🎰' },
    { game: 'mines',     label: 'Mines',     emoji: '💣' },
    { game: 'plinko',    label: 'Plinko',    emoji: '🔵' },
    { game: 'crash',     label: 'Crash',     emoji: '🚀' },
    { game: 'hilo',      label: 'Hi-Lo',     emoji: '🎲' },
  ];

  readonly tierOrder = ['debutant', 'intermediaire', 'confirme', 'degen'];

  groups = signal<GameGroup[]>([]);

  constructor(private achievementsService: AchievementsService) {}

  ngOnInit(): void {
    this.achievementsService.getAchievements().subscribe(list => {
      this.achievements.set(list);
      this.groups.set(
        this.gameMeta.map(m => ({
          ...m,
          achievements: this.tierOrder
            .map(tier => list.find(a => a.game === m.game && a.tier === tier)!)
            .filter(Boolean),
        })),
      );
    });
  }

  tierLabel(tier: string): string {
    return { debutant: 'Débutant', intermediaire: 'Intermédiaire', confirme: 'Confirmé', degen: 'Degen' }[tier] ?? tier;
  }

  totalUnlocked(): number {
    return this.achievements()?.filter(a => a.unlocked).length ?? 0;
  }
}
