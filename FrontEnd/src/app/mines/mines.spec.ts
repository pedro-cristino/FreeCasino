import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Mines, MinesPhase, calcMult } from './mines';

describe('calcMult()', () => {
  it('returns 0 when revealed is 0', () => {
    expect(calcMult(0, 3)).toBe(0);
  });

  it('increases with each additional safe reveal (same mine count)', () => {
    const m1 = calcMult(1, 3);
    const m2 = calcMult(2, 3);
    const m3 = calcMult(3, 3);
    expect(m2).toBeGreaterThan(m1);
    expect(m3).toBeGreaterThan(m2);
  });

  it('is higher with more mines given the same number of reveals', () => {
    const lowMines = calcMult(3, 3);
    const highMines = calcMult(3, 10);
    expect(highMines).toBeGreaterThan(lowMines);
  });

  it('starts above 0.99 for 1 reveal with 1 mine', () => {
    // 0.99 × (25/24) ≈ 1.03
    const m = calcMult(1, 1);
    expect(m).toBeGreaterThan(0.99);
  });
});

describe('Mines component', () => {
  let component: Mines;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mines],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Mines);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // Flush any initial HTTP calls (achievements boosts from ngOnInit)
    httpMock.match(() => true).forEach(r => r.flush({}));
  });

  afterEach(() => {
    // Flush any remaining open requests (e.g. balance save) before verifying
    httpMock.match(() => true).forEach(r => r.flush({}));
    httpMock.verify();
  });

  it('starts in SETUP phase', () => {
    expect(component.phase()).toBe(MinesPhase.SETUP);
  });

  it('multiplier is 0 before any reveals', () => {
    expect(component.multiplier()).toBe(0);
  });

  it('starts a game and moves to PLAYING phase', () => {
    component.balance.set(100);
    component.bet.set(10);
    component.start();

    expect(component.phase()).toBe(MinesPhase.PLAYING);
    expect(component.tiles().length).toBe(25);
  });

  it('deducts the bet from balance when a game starts', () => {
    component.balance.set(100);
    component.bet.set(10);
    component.start();
    expect(component.balance()).toBe(90);
  });

  it('places exactly mineCount mines on the board', () => {
    component.balance.set(100);
    component.bet.set(10);
    component.mineCount.set(5);
    component.start();
    const mines = component.tiles().filter(t => t.isMine).length;
    expect(mines).toBe(5);
  });

  it('moves to EXPLODED phase and adds a history entry when a mine is hit', () => {
    component.balance.set(100);
    component.bet.set(10);
    component.start();

    const mineTile = component.tiles().find(t => t.isMine)!;
    component.reveal(mineTile);

    // Flush the stats API call
    httpMock.match(() => true).forEach(r =>
      r.flush({ newAchievements: [], levelUp: null, xpGained: 5 })
    );

    expect(component.phase()).toBe(MinesPhase.EXPLODED);
    expect(component.history().length).toBe(1);
    expect(component.history()[0]['won']).toBe(false);
    expect(component.history()[0]['profit']).toBeLessThan(0);
  });

  it('increments revealedCount when a safe tile is revealed', () => {
    component.balance.set(100);
    component.bet.set(10);
    component.start();

    const safeTile = component.tiles().find(t => !t.isMine)!;
    component.reveal(safeTile);

    expect(component.revealedCount()).toBe(1);
  });

  it('allows cashout after revealing at least one safe tile', () => {
    component.balance.set(100);
    component.bet.set(10);
    component.start();

    const safeTile = component.tiles().find(t => !t.isMine)!;
    component.reveal(safeTile);

    component.cashOut();
    httpMock.match(() => true).forEach(r =>
      r.flush({ newAchievements: [], levelUp: null, xpGained: 5 })
    );

    expect(component.phase()).toBe(MinesPhase.CASHOUT);
    expect(component.history().length).toBe(1);
    expect(component.history()[0]['won']).toBe(true);
    expect(component.balance()).toBeGreaterThan(90); // won something
  });

  it('multiplier increases after each safe reveal', () => {
    component.balance.set(100);
    component.bet.set(10);
    component.mineCount.set(3);
    component.start();

    const safeTiles = component.tiles().filter(t => !t.isMine);
    component.reveal(safeTiles[0]);
    const mult1 = component.multiplier();

    component.reveal(safeTiles[1]);
    const mult2 = component.multiplier();

    expect(mult2).toBeGreaterThan(mult1);
  });
});
