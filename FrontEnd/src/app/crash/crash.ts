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
import { GameHeader } from '../game-header/game-header';

const CANVAS_W = 600;
const CANVAS_H = 400;
const ML = 52; // margin left (y-axis labels)
const MR = 15;
const MT = 20;
const MB = 35;
const GROWTH_RATE = 0.08; // mult = e^(0.08 * t) → ~2.2× at 10s, ~11× at 30s

export enum CrashPhase {
  BETTING = 'BETTING',
  FLYING = 'FLYING',
  CRASHED = 'CRASHED',
}

export interface CrashHistory {
  timestamp: Date;
  bet: number;
  cashedOut: boolean;
  cashOutMult: number | null;
  crashMult: number;
  profit: number;
  balance: number;
}

interface PathPoint {
  t: number;
  m: number;
}

@Component({
  selector: 'app-crash',
  standalone: true,
  imports: [CommonModule, GameHeader],
  templateUrl: './crash.html',
  styleUrls: ['./crash.css'],
})
export class Crash implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly CrashPhase = CrashPhase;
  readonly CHIP_VALUES = [1, 5, 10, 25, 50, 100];

  phase = signal<CrashPhase>(CrashPhase.BETTING);
  balance = signal(0);
  bet = signal(0);
  activeBet = signal(0);
  currentMult = signal(1.0);
  cashedOut = signal(false);
  cashOutMult = signal<number | null>(null);
  history = signal<CrashHistory[]>([]);
  recentCrashes = signal<number[]>([]);

  lastBet = 0; // public for template (replay label)

  private crashTarget = 1;
  private startTime = 0;
  private animFrame: number | null = null;
  private path: PathPoint[] = [];
  private stars: { x: number; y: number; r: number; o: number }[] = [];

  gamesPlayed = computed(() => this.history().length);
  gamesWon = computed(() => this.history().filter(h => h.cashedOut).length);
  gamesLost = computed(() => this.history().filter(h => !h.cashedOut).length);
  profitLoss = computed(
    () => Math.round(this.history().reduce((s, h) => s + h.profit, 0) * 100) / 100
  );

  // Live potential cashout during FLYING
  livePayout = computed(() => Math.round(this.activeBet() * this.currentMult() * 100) / 100);

  // Actual amount won after cashing out
  cashoutWinAmount = computed(() => {
    const co = this.cashOutMult();
    return co !== null ? Math.round(this.activeBet() * co * 100) / 100 : 0;
  });

  canReplay = computed(
    () =>
      this.lastBet > 0 &&
      this.balance() >= this.lastBet &&
      this.phase() !== CrashPhase.FLYING
  );

  constructor(private balanceService: BalanceService) {
    toObservable(balanceService.balance)
      .pipe(filter(b => b > 0), takeUntilDestroyed())
      .subscribe(b => this.balance.set(b));
  }

  ngAfterViewInit(): void {
    this.generateStars();
    this.drawIdle();
  }

  ngOnDestroy(): void {
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
  }

  // ── Bet controls ──────────────────────────────────────────────────────────

  addBet(amount: number): void {
    if (this.phase() !== CrashPhase.BETTING) return;
    const add = Math.min(amount, this.balance() - this.bet());
    if (add > 0) this.bet.update(b => b + add);
  }

  clearBet(): void {
    if (this.phase() !== CrashPhase.BETTING) return;
    this.bet.set(0);
  }

  allIn(): void {
    if (this.phase() !== CrashPhase.BETTING) return;
    this.bet.set(this.balance());
  }

  canFly(): boolean {
    return this.bet() > 0 && this.balance() >= this.bet() && this.phase() === CrashPhase.BETTING;
  }

  // ── Game flow ─────────────────────────────────────────────────────────────

  fly(): void {
    if (!this.canFly()) return;

    const bet = this.bet();
    this.lastBet = bet;
    this.activeBet.set(bet);
    this.balance.update(b => b - bet);
    this.crashTarget = this.generateCrashMult();
    this.cashedOut.set(false);
    this.cashOutMult.set(null);
    this.currentMult.set(1.0);
    this.path = [];
    this.startTime = performance.now();
    this.phase.set(CrashPhase.FLYING);

    this.animFrame = requestAnimationFrame(t => this.loop(t));
  }

  cashOut(): void {
    if (this.phase() !== CrashPhase.FLYING || this.cashedOut()) return;

    const mult = this.currentMult();
    this.cashedOut.set(true);
    this.cashOutMult.set(mult);

    const winAmount = Math.round(this.activeBet() * mult * 100) / 100;
    const newBalance = Math.round((this.balance() + winAmount) * 100) / 100;
    this.balance.set(newBalance);
    this.balanceService.save(newBalance);
  }

  playAgain(): void {
    this.phase.set(CrashPhase.BETTING);
    this.cashedOut.set(false);
    this.cashOutMult.set(null);
    this.currentMult.set(1.0);
    this.activeBet.set(0);
    this.drawIdle();
  }

  replayLast(): void {
    if (!this.canReplay()) return;
    this.bet.set(this.lastBet);
    if (this.phase() !== CrashPhase.BETTING) this.phase.set(CrashPhase.BETTING);
    this.fly();
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────

  private loop(now: number): void {
    const elapsed = (now - this.startTime) / 1000;
    const mult = Math.pow(Math.E, GROWTH_RATE * elapsed);
    const rounded = Math.round(mult * 100) / 100;

    this.currentMult.set(rounded);
    this.path.push({ t: elapsed, m: mult });

    if (mult >= this.crashTarget) {
      this.crash();
      return;
    }

    this.drawFlight(mult);
    this.animFrame = requestAnimationFrame(t => this.loop(t));
  }

  private crash(): void {
    const crashMult = Math.round(this.crashTarget * 100) / 100;
    this.currentMult.set(crashMult);
    this.phase.set(CrashPhase.CRASHED);
    this.animFrame = null;

    let profit: number;
    let balance: number;

    if (this.cashedOut()) {
      const co = this.cashOutMult()!;
      profit = Math.round((this.activeBet() * co - this.activeBet()) * 100) / 100;
      balance = this.balance();
    } else {
      profit = -this.activeBet();
      balance = this.balance();
      this.balanceService.save(balance);
    }

    this.recentCrashes.update(r => [crashMult, ...r].slice(0, 12));

    this.history.update(h =>
      [
        {
          timestamp: new Date(),
          bet: this.activeBet(),
          cashedOut: this.cashedOut(),
          cashOutMult: this.cashOutMult(),
          crashMult,
          profit,
          balance,
        },
        ...h,
      ].slice(0, 15)
    );

    this.drawCrashFrame();
  }

  // ── Crash multiplier generation ───────────────────────────────────────────

  private generateCrashMult(): number {
    // P(crash > x) = 0.99/x → 1% house edge
    if (Math.random() < 0.01) return 1.0; // 1% instant crash
    const r = Math.random();
    const raw = 0.99 / (1 - r);
    return Math.max(1.01, Math.min(Math.round(raw * 100) / 100, 10000));
  }

  // ── Canvas helpers ────────────────────────────────────────────────────────

  private generateStars(): void {
    this.stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      r: Math.random() * 1.4 + 0.3,
      o: Math.random() * 0.6 + 0.2,
    }));
  }

  private getScale(): { maxT: number; maxM: number } {
    const last = this.path[this.path.length - 1];
    if (!last) return { maxT: 5, maxM: 2 };
    return {
      maxT: Math.max(last.t * 1.35, 5),
      maxM: Math.max(last.m * 1.45, 2),
    };
  }

  private tx(t: number, maxT: number): number {
    return ML + (t / maxT) * (CANVAS_W - ML - MR);
  }

  private ty(m: number, maxM: number): number {
    const range = Math.max(maxM - 1, 1);
    return CANVAS_H - MB - ((m - 1) / range) * (CANVAS_H - MT - MB);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bg.addColorStop(0, '#06091a');
    bg.addColorStop(1, '#0d1b35');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const s of this.stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.o})`;
      ctx.fill();
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, maxT: number, maxM: number): void {
    const steps = [1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const m of steps) {
      if (m > maxM * 0.96) break;
      const y = this.ty(m, maxM);
      if (y < MT || y > CANVAS_H - MB) continue;

      ctx.setLineDash([3, 7]);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ML, y);
      ctx.lineTo(CANVAS_W - MR, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`${m}×`, ML - 5, y);
    }
  }

  private drawCurve(ctx: CanvasRenderingContext2D, maxT: number, maxM: number, crashed: boolean): void {
    if (this.path.length < 2) return;

    const endColor = crashed ? '#e74c3c' : '#f39c12';

    // Glow pass
    ctx.beginPath();
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = crashed ? 'rgba(231,76,60,0.18)' : 'rgba(46,204,113,0.14)';
    for (let i = 0; i < this.path.length; i++) {
      const { t, m } = this.path[i];
      if (i === 0) ctx.moveTo(this.tx(t, maxT), this.ty(m, maxM));
      else ctx.lineTo(this.tx(t, maxT), this.ty(m, maxM));
    }
    ctx.stroke();

    // Main curve with gradient
    const sx0 = this.tx(this.path[0].t, maxT);
    const sx1 = this.tx(this.path[this.path.length - 1].t, maxT);
    const grad = ctx.createLinearGradient(sx0, 0, sx1, 0);
    grad.addColorStop(0, '#2ecc71');
    grad.addColorStop(0.55, '#f1c40f');
    grad.addColorStop(1, endColor);

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = grad;
    for (let i = 0; i < this.path.length; i++) {
      const { t, m } = this.path[i];
      if (i === 0) ctx.moveTo(this.tx(t, maxT), this.ty(m, maxM));
      else ctx.lineTo(this.tx(t, maxT), this.ty(m, maxM));
    }
    ctx.stroke();
  }

  private getRocketPos(
    maxT: number,
    maxM: number
  ): { x: number; y: number; angle: number } {
    const last = this.path[this.path.length - 1];
    if (!last) return { x: ML, y: CANVAS_H - MB, angle: -Math.PI / 4 };

    const x = this.tx(last.t, maxT);
    const y = this.ty(last.m, maxM);
    let angle = -Math.PI / 4;

    if (this.path.length >= 2) {
      const prev = this.path[this.path.length - 2];
      const dx = this.tx(last.t, maxT) - this.tx(prev.t, maxT);
      const dy = this.ty(last.m, maxM) - this.ty(prev.m, maxM);
      angle = Math.atan2(dy, dx) - Math.PI / 2;
    }

    return { x, y, angle };
  }

  private drawFlight(mult: number): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const { maxT, maxM } = this.getScale();

    this.drawBackground(ctx);
    this.drawGrid(ctx, maxT, maxM);
    this.drawCurve(ctx, maxT, maxM, false);

    const { x, y, angle } = this.getRocketPos(maxT, maxM);

    // Rocket
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀', 0, 0);
    ctx.restore();

    // Big multiplier overlay
    const multStr = mult.toFixed(2) + '×';
    const col = this.cashedOut() ? '#2ecc71' : '#ffffff';
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.shadowBlur = 26;
    ctx.shadowColor = col;
    ctx.fillText(multStr, CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.shadowBlur = 0;

    if (this.cashedOut()) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#2ecc71';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#2ecc71';
      ctx.fillText(`✓ Encaissé à ${this.cashOutMult()?.toFixed(2)}×`, CANVAS_W / 2, CANVAS_H / 2 + 38);
      ctx.shadowBlur = 0;
    }
  }

  private drawCrashFrame(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const { maxT, maxM } = this.getScale();

    this.drawBackground(ctx);
    this.drawGrid(ctx, maxT, maxM);
    this.drawCurve(ctx, maxT, maxM, true);

    const { x, y } = this.getRocketPos(maxT, maxM);

    // Explosion radial glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 75);
    glow.addColorStop(0, 'rgba(255,210,60,0.9)');
    glow.addColorStop(0.35, 'rgba(231,76,60,0.65)');
    glow.addColorStop(1, 'rgba(231,76,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 75, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '34px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💥', x, y);

    // Crashed mult overlay
    const crashMult = Math.round(this.crashTarget * 100) / 100;
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e74c3c';
    ctx.shadowBlur = 26;
    ctx.shadowColor = '#e74c3c';
    ctx.fillText(`${crashMult.toFixed(2)}× 💥`, CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.shadowBlur = 0;

    if (this.cashedOut()) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#2ecc71';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#2ecc71';
      ctx.fillText(`✓ Encaissé à ${this.cashOutMult()?.toFixed(2)}×`, CANVAS_W / 2, CANVAS_H / 2 + 38);
      ctx.shadowBlur = 0;
    }
  }

  private drawIdle(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    this.drawBackground(ctx);

    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('Placez votre mise et décollez ! 🚀', CANVAS_W / 2, CANVAS_H / 2);
  }

  // Used by template for recent crash badge colors
  crashColor(mult: number): string {
    if (mult < 1.5) return '#e74c3c';
    if (mult < 2) return '#e67e22';
    if (mult < 5) return '#f1c40f';
    if (mult < 10) return '#2ecc71';
    return '#9b59b6';
  }

  crashTextColor(mult: number): string {
    return mult < 5 ? '#1a1f2e' : '#fff';
  }
}
