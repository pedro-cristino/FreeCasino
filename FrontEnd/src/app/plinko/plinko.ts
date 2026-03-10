import {
  Component,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { BalanceService } from '../services/balance.service';
import { StatsService } from '../services/stats.service';
import { AchievementsService } from '../services/achievements.service';
import { GameHeader } from '../game-header/game-header';

const ROWS = 16;
const SLOTS = ROWS + 1; // 17 slots
const CANVAS_W = 560;
const CANVAS_H = 510;
const CX = CANVAS_W / 2;
const PEG_SPACING = 28;
const ROW_SPACING = 26;
const PEG_RADIUS = 5;
const BALL_RADIUS = 8;
const TOP_PAD = 40;
const SLOT_H = 32;
const FRAMES_PER_STEP = 6; // frames per peg-row → ~1.7s total at 60fps

const MULTIPLIERS = [100, 25, 10, 5, 3, 2, 1, 0.5, 0.1, 0.5, 1, 2, 3, 5, 10, 25, 100];

let nextId = 0;

interface Ball {
  id: number;
  keyframes: { x: number; y: number }[];
  frame: number;
  finalSlot: number;
  bet: number;
}

export interface PlinkoHistory {
  timestamp: Date;
  bet: number;
  slot: number;
  multiplier: number;
  profit: number;
  balance: number;
  won: boolean;
}

@Component({
  selector: 'app-plinko',
  standalone: true,
  imports: [CommonModule, GameHeader],
  templateUrl: './plinko.html',
  styleUrls: ['./plinko.css'],
})
export class Plinko implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly CHIP_VALUES = [1, 5, 10, 25, 50, 100];
  readonly MULTIPLIERS = MULTIPLIERS;

  balance = signal(0);
  bet = signal(10);
  history = signal<PlinkoHistory[]>([]);
  lastResult = signal<{ multiplier: number; winAmount: number; won: boolean } | null>(null);

  private balls: Ball[] = [];
  private animFrame: number | null = null;
  private resultTimer: ReturnType<typeof setTimeout> | null = null;

  gamesPlayed = computed(() => this.history().length);
  gamesWon = computed(() => this.history().filter(h => h.won).length);
  gamesLost = computed(() => this.history().filter(h => !h.won).length);
  profitLoss = computed(
    () => Math.round(this.history().reduce((s, h) => s + h.profit, 0) * 100) / 100
  );

  private gameBoost = 0;

  constructor(private balanceService: BalanceService, private statsService: StatsService, private achievementsService: AchievementsService) {
    toObservable(balanceService.balance)
      .pipe(filter(b => b > 0), takeUntilDestroyed())
      .subscribe(b => this.balance.set(b));
    achievementsService.getBoosts().subscribe(b => { this.gameBoost = b['plinko'] ?? 0; });
  }

  ngAfterViewInit(): void {
    this.drawBoard();
  }

  ngOnDestroy(): void {
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    if (this.resultTimer !== null) clearTimeout(this.resultTimer);
  }

  // ── Bet selection ─────────────────────────────────────────────────────────

  setBet(amount: number): void {
    this.bet.set(amount);
  }

  canDrop(): boolean {
    return this.bet() > 0 && this.balance() >= this.bet();
  }

  // ── Drop ──────────────────────────────────────────────────────────────────

  drop(): void {
    if (!this.canDrop()) return;

    const bet = this.bet();
    this.balance.update(b => b - bet);

    // Pre-determine the full path (+1 right / -1 left)
    const path = Array.from({ length: ROWS }, () => (Math.random() < 0.5 ? 1 : -1));
    const finalSlot = path.filter(p => p === 1).length; // 0‥16

    // Build keyframes
    const keyframes: { x: number; y: number }[] = [];
    let cumX = 0;
    keyframes.push({ x: CX, y: TOP_PAD - ROW_SPACING }); // above board
    for (let row = 0; row < ROWS; row++) {
      keyframes.push({ x: CX + cumX * (PEG_SPACING / 2), y: TOP_PAD + row * ROW_SPACING });
      cumX += path[row];
    }
    // Slot landing: cumX = 2*rightCount − ROWS → finalX = CX + (rightCount − ROWS/2)*PEG_SPACING
    keyframes.push({
      x: CX + cumX * (PEG_SPACING / 2),
      y: TOP_PAD + ROWS * ROW_SPACING + SLOT_H / 2,
    });

    this.balls.push({ id: nextId++, keyframes, frame: 0, finalSlot, bet });

    if (this.animFrame === null) this.runLoop();
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  private runLoop(): void {
    // Advance all balls
    for (const b of this.balls) b.frame++;

    // Split settled vs still-flying
    const settled = this.balls.filter(
      b => Math.floor(b.frame / FRAMES_PER_STEP) >= b.keyframes.length - 1
    );
    this.balls = this.balls.filter(
      b => Math.floor(b.frame / FRAMES_PER_STEP) < b.keyframes.length - 1
    );

    for (const b of settled) this.settleBall(b);

    this.drawBoard();

    if (this.balls.length > 0) {
      this.animFrame = requestAnimationFrame(() => this.runLoop());
    } else {
      this.animFrame = null;
    }
  }

  private settleBall(ball: Ball): void {
    const mult = MULTIPLIERS[ball.finalSlot];
    const boostedMult = this.gameBoost > 0 ? mult * (1 + this.gameBoost / 100) : mult;
    const winAmount = Math.round(ball.bet * boostedMult * 100) / 100;
    const profit = Math.round((winAmount - ball.bet) * 100) / 100;
    const newBalance = Math.round((this.balance() + winAmount) * 100) / 100;

    this.balance.set(newBalance);
    this.balanceService.save(newBalance);
    this.statsService.report({
      game: 'plinko',
      won: mult >= 1,
      amountWon: profit > 0 ? profit : 0,
      amountLost: profit < 0 ? Math.abs(profit) : 0,
      amountBet: ball.bet,
      wasAllIn: false,
      currentBalance: newBalance,
    });

    // Flash last result for 2s
    this.lastResult.set({ multiplier: mult, winAmount, won: mult >= 1 });
    if (this.resultTimer !== null) clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => this.lastResult.set(null), 2000);

    this.history.update(h =>
      [
        {
          timestamp: new Date(),
          bet: ball.bet,
          slot: ball.finalSlot,
          multiplier: mult,
          profit,
          balance: newBalance,
          won: mult >= 1,
        },
        ...h,
      ].slice(0, 20)
    );
  }

  // ── Canvas drawing ────────────────────────────────────────────────────────

  private drawBoard(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Pegs
    for (let row = 0; row < ROWS; row++) {
      const n = row + 3;
      for (let j = 0; j < n; j++) {
        const px = CX + (j - (n - 1) / 2) * PEG_SPACING;
        const py = TOP_PAD + row * ROW_SPACING;
        ctx.beginPath();
        ctx.arc(px, py, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#4a5568';
        ctx.fill();
        ctx.strokeStyle = '#718096';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Slots
    const slotY = TOP_PAD + ROWS * ROW_SPACING;
    for (let i = 0; i < SLOTS; i++) {
      const sx = CX + (i - ROWS / 2) * PEG_SPACING;
      const sw = PEG_SPACING - 2;
      const mult = MULTIPLIERS[i];
      const color = this.multColor(mult);

      ctx.fillStyle = color;
      this.rrect(ctx, sx - sw / 2, slotY, sw, SLOT_H, 4);
      ctx.fill();

      ctx.fillStyle = mult < 1 ? '#fff' : '#1a1f2e';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mult}x`, sx, slotY + SLOT_H / 2);
    }

    // Balls
    for (const ball of this.balls) {
      const step = Math.floor(ball.frame / FRAMES_PER_STEP);
      const t = (ball.frame % FRAMES_PER_STEP) / FRAMES_PER_STEP;
      const from = ball.keyframes[Math.min(step, ball.keyframes.length - 2)];
      const to = ball.keyframes[Math.min(step + 1, ball.keyframes.length - 1)];
      const et = this.ease(t);
      this.drawBall(ctx, from.x + (to.x - from.x) * et, from.y + (to.y - from.y) * et);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const grad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, BALL_RADIUS);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#667eea');
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#667eea';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private ease(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  private rrect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  multColor(mult: number): string {
    if (mult >= 50) return '#e53e3e';
    if (mult >= 10) return '#ed8936';
    if (mult >= 3) return '#ecc94b';
    if (mult >= 1) return '#48bb78';
    return '#9f7aea';
  }
}
