import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DemonService } from '../services/demon.service';

@Component({
  selector: 'app-demon-challenge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demon-challenge.html',
  styleUrl: './demon-challenge.css',
})
export class DemonChallenge {
  readonly demonService = inject(DemonService);

  accept(): void  { this.demonService.accept(); }
  dismiss(): void { this.demonService.dismiss(); }

  countdownPct(): number {
    return (this.demonService.countdown() / 10) * 100;
  }
}
