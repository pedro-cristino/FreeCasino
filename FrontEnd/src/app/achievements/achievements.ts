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
    { game: 'global',    label: 'Global',    emoji: '🌐' },
    { game: 'blackjack', label: 'Blackjack', emoji: '🃏' },
    { game: 'baccarat',  label: 'Baccarat',  emoji: '🎴' },
    { game: 'roulette',  label: 'Roulette',  emoji: '🎡' },
    { game: 'slots',     label: 'Slots',     emoji: '🎰' },
    { game: 'mines',     label: 'Mines',     emoji: '💣' },
    { game: 'plinko',    label: 'Plinko',    emoji: '🔵' },
    { game: 'crash',     label: 'Crash',     emoji: '🚀' },
    { game: 'hilo',      label: 'Hi-Lo',     emoji: '🎲' },
  ];

  groups = signal<GameGroup[]>([]);

  constructor(private achievementsService: AchievementsService) {}

  ngOnInit(): void {
    this.achievementsService.getAchievements().subscribe(list => {
      this.achievements.set(list);
      this.groups.set(
        this.gameMeta.map(m => ({
          ...m,
          achievements: list.filter(a => a.game === m.game),
        })).filter(g => g.achievements.length > 0),
      );
    });
  }

  tierLabel(tier: string): string {
    const labels: Record<string, string> = {
      debutant:               'Débutant',
      intermediaire:          'Intermédiaire',
      confirme:               'Confirmé',
      degen:                  'Degen',
      debutant_pertes:        'Débutant',
      intermediaire_pertes:   'Intermédiaire',
      confirme_pertes:        'Confirmé',
      degen_pertes:           'Degen',
      bronze:                 'Bronze',
      argent:                 'Argent',
      or:                     'Or',
      platine:                'Platine',
      legende:                '💀 Légende',
    };
    return labels[tier] ?? tier;
  }

  totalUnlocked(): number {
    return this.achievements()?.filter(a => a.unlocked).length ?? 0;
  }

  totalCount(): number {
    return this.achievements()?.length ?? 0;
  }
}
