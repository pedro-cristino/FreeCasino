import { Component } from '@angular/core';

@Component({
  selector: 'app-achievements',
  standalone: true,
  templateUrl: './achievements.html',
  styleUrl: './achievements.css',
})
export class Achievements {
  readonly slots = Array.from({ length: 100 }, (_, i) => i);
}
