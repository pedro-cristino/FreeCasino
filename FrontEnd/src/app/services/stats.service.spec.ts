import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { StatsService } from './stats.service';
import { ToastService } from './toast.service';
import { LevelService } from './level.service';

describe('StatsService', () => {
  let service: StatsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        StatsService,
        ToastService,
        LevelService,
      ],
    });
    service = TestBed.inject(StatsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Flush in a loop: each stats response triggers a level refresh (GET /user/level),
    // and concatMap may still have queued POSTs — drain all chains before verify.
    for (let i = 0; i < 5; i++) {
      const pending = httpMock.match(() => true);
      if (pending.length === 0) break;
      pending.forEach(r => r.flush({ newAchievements: [], levelUp: null, xpGained: 0 }));
    }
    httpMock.verify();
  });

  describe('report()', () => {
    it('queues a game result and calls the API', () => {
      service.report({
        game: 'blackjack',
        won: true,
        amountWon: 50,
        amountLost: 0,
        amountBet: 50,
        wasAllIn: false,
        currentBalance: 1050,
      });

      const req = httpMock.expectOne(r => r.url.includes('/stats/game'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body['game']).toBe('blackjack');
      req.flush({ newAchievements: [], levelUp: null, xpGained: 10 });
    });
  });

  describe('getRunType()', () => {
    it('returns the game name when only one game type has been played', () => {
      service.clearRunGames();
      service.report({
        game: 'slots',
        won: false,
        amountWon: 0,
        amountLost: 10,
        amountBet: 10,
        wasAllIn: false,
        currentBalance: 90,
      });
      httpMock.expectOne(r => r.url.includes('/stats/game')).flush({
        newAchievements: [],
        levelUp: null,
        xpGained: 5,
      });

      expect(service.getRunType()).toBe('slots');
    });

    it('returns "multiple" when more than one game type has been played', () => {
      service.clearRunGames();
      service.report({
        game: 'blackjack', won: true, amountWon: 10, amountLost: 0,
        amountBet: 10, wasAllIn: false, currentBalance: 110,
      });
      service.report({
        game: 'roulette', won: false, amountWon: 0, amountLost: 5,
        amountBet: 5, wasAllIn: false, currentBalance: 105,
      });

      const reqs = httpMock.match(r => r.url.includes('/stats/game'));
      reqs.forEach(r => r.flush({ newAchievements: [], levelUp: null, xpGained: 5 }));

      expect(service.getRunType()).toBe('multiple');
    });
  });

  describe('clearRunGames()', () => {
    it('clears the tracked games so getRunType returns "multiple" (empty)', () => {
      service.clearRunGames();
      service.report({
        game: 'mines', won: true, amountWon: 20, amountLost: 0,
        amountBet: 10, wasAllIn: false, currentBalance: 120,
      });
      httpMock.expectOne(r => r.url.includes('/stats/game')).flush({
        newAchievements: [],
        levelUp: null,
        xpGained: 5,
      });

      expect(service.getRunType()).toBe('mines');

      service.clearRunGames();
      // With 0 games in the set, size !== 1 so it returns 'multiple'
      expect(service.getRunType()).toBe('multiple');
    });
  });
});
