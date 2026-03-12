import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { DemonService } from '../services/demon.service';

@Component({
  selector: 'app-demon-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div class="demon-banner">
        <span class="skull-anim">💀</span>
        <span class="banner-text">
          DÉMON ACTIF — Joue maintenant pour <strong>×3</strong> sur ta prochaine victoire !
        </span>
        <span class="skull-anim">💀</span>
      </div>
    }
  `,
  styles: [`
    .demon-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 10px 20px;
      background: linear-gradient(90deg, #7f1d1d, #dc2626, #7f1d1d);
      border-bottom: 2px solid rgba(255, 100, 100, 0.4);
      box-shadow: 0 4px 20px rgba(220, 38, 38, 0.4);
      animation: banner-pulse 1.8s ease-in-out infinite;
      font-family: 'Segoe UI', sans-serif;
    }

    @keyframes banner-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(220, 38, 38, 0.4); }
      50%       { box-shadow: 0 4px 36px rgba(220, 38, 38, 0.75); }
    }

    .banner-text {
      font-size: 0.85rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      text-shadow: 0 0 10px rgba(255, 100, 100, 0.6);
    }

    .banner-text strong {
      color: #fbbf24;
      font-size: 1rem;
      text-shadow: 0 0 12px rgba(251, 191, 36, 0.8);
    }

    .skull-anim {
      font-size: 1.2rem;
      animation: skull-shake 0.5s ease-in-out infinite alternate;
    }

    @keyframes skull-shake {
      from { transform: rotate(-8deg) scale(1); }
      to   { transform: rotate(8deg)  scale(1.1); }
    }
  `],
})
export class DemonBanner {
  private readonly demonService = inject(DemonService);
  private readonly router       = inject(Router);

  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects.slice(1).split('?')[0]),
    ),
    { initialValue: this.router.url.slice(1).split('?')[0] },
  );

  readonly visible = computed(() =>
    this.demonService.isActiveFor(this.currentPath()),
  );
}
