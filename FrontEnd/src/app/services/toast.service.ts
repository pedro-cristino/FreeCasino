import { Injectable, signal } from '@angular/core';

export interface AchievementToast {
  id: number;
  type: 'achievement' | 'levelup';
  name: string;
  description: string;
  boostPercent?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<AchievementToast[]>([]);

  show(name: string, description: string, boostPercent: number): void {
    this.add({ type: 'achievement', name, description, boostPercent });
  }

  showLevelUp(level: number, levelName: string): void {
    this.add({ type: 'levelup', name: `Niveau ${level} !`, description: levelName });
  }

  dismiss(id: number): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }

  private add(toast: Omit<AchievementToast, 'id'>): void {
    const id = this.nextId++;
    this.toasts.update(t => [...t, { id, ...toast }]);
    setTimeout(() => this.dismiss(id), 5000);
  }
}
