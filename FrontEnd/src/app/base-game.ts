import { Directive, inject, OnInit } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { BalanceService } from './services/balance.service';
import { StatsService } from './services/stats.service';
import { AchievementsService } from './services/achievements.service';
import { DemonService } from './services/demon.service';

export const CHIP_VALUES = [1, 5, 10, 25, 50, 100];

@Directive()
export abstract class BaseGame implements OnInit {
  protected readonly balanceService      = inject(BalanceService);
  protected readonly statsService        = inject(StatsService);
  protected readonly achievementsService = inject(AchievementsService);
  protected readonly demonService        = inject(DemonService);

  private _gameBoost = 0;

  /** Achievement boost + demon boost (200% when demon active → profit ×3) */
  protected get gameBoost(): number {
    return this._gameBoost + this.demonService.getDemonBoost(this.gameName);
  }
  protected set gameBoost(v: number) {
    this._gameBoost = v;
  }

  protected abstract readonly gameName: string;

  constructor() {
    toObservable(this.balanceService.balance)
      .pipe(filter(b => b > 0), takeUntilDestroyed())
      .subscribe(b => this.onBalanceUpdate(b));
  }

  ngOnInit(): void {
    this.balanceService.load();
    this.achievementsService.getBoosts().subscribe(boosts => {
      this.gameBoost = boosts[this.gameName] ?? 0;
    });
  }

  protected abstract onBalanceUpdate(balance: number): void;
}
