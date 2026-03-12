import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StatsService } from './stats.service';

export interface DemonOffer {
  game: string;
  label: string;
  emoji: string;
}

const GAMES: DemonOffer[] = [
  { game: 'blackjack', label: 'Blackjack', emoji: '🃏' },
  { game: 'baccarat',  label: 'Baccarat',  emoji: '🎴' },
  { game: 'roulette',  label: 'Roulette',  emoji: '🎡' },
  { game: 'slots',     label: 'Slots',     emoji: '🎰' },
  { game: 'mines',     label: 'Mines',     emoji: '💣' },
  { game: 'plinko',    label: 'Plinko',    emoji: '🔵' },
  { game: 'crash',     label: 'Crash',     emoji: '🚀' },
  { game: 'hilo',      label: 'Hi-Lo',     emoji: '🎲' },
];

const COUNTDOWN_SECONDS = 10;

@Injectable({ providedIn: 'root' })
export class DemonService {
  private readonly router   = inject(Router);
  private readonly stats    = inject(StatsService);

  /** Current pending offer (null = no offer showing) */
  readonly offer       = signal<DemonOffer | null>(null);
  /** Countdown (10 → 0) */
  readonly countdown   = signal(COUNTDOWN_SECONDS);
  /** Game that accepted the demon bet (null = no active demon) */
  readonly activeGame  = signal<string | null>(null);

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private scheduleTimer:     ReturnType<typeof setTimeout>  | null = null;
  private expireTimer:       ReturnType<typeof setTimeout>  | null = null;

  constructor() {
    // First trigger after 2–4 min so the user can see it quickly
    this.scheduleNext(2 * 60_000, 4 * 60_000);

    // Auto-consume demon when any game result arrives
    this.stats.gameResult$.subscribe(result => {
      if (this.activeGame() === result.game) {
        this.consume();
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  accept(): void {
    const o = this.offer();
    if (!o) return;
    this.clearCountdown();
    this.offer.set(null);
    this.activeGame.set(o.game);
    this.router.navigate([`/${o.game}`]);
    // Auto-expire demon if player never plays (2-minute safety)
    this.expireTimer = setTimeout(() => this.consume(), 2 * 60_000);
  }

  dismiss(): void {
    this.clearCountdown();
    this.offer.set(null);
    // Next offer in 5–12 min after declining
    this.scheduleNext(5 * 60_000, 12 * 60_000);
  }

  /** % boost to add on top of achievements boost when demon active for this game */
  getDemonBoost(game: string): number {
    return this.activeGame() === game ? 200 : 0;
  }

  isActiveFor(game: string): boolean {
    return this.activeGame() === game;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private consume(): void {
    this.activeGame.set(null);
    if (this.expireTimer) { clearTimeout(this.expireTimer); this.expireTimer = null; }
    // Next offer in 8–15 min after being used (win or lose)
    this.scheduleNext(8 * 60_000, 15 * 60_000);
  }

  private scheduleNext(minMs: number, maxMs: number): void {
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    const delay = minMs + Math.random() * (maxMs - minMs);
    this.scheduleTimer = setTimeout(() => this.triggerOffer(), delay);
  }

  private triggerOffer(): void {
    // Don't show if already active
    if (this.offer() || this.activeGame()) return;
    const target = GAMES[Math.floor(Math.random() * GAMES.length)];
    this.offer.set(target);
    this.countdown.set(COUNTDOWN_SECONDS);
    this.countdownInterval = setInterval(() => {
      const next = this.countdown() - 1;
      if (next <= 0) {
        this.dismiss();
      } else {
        this.countdown.set(next);
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
