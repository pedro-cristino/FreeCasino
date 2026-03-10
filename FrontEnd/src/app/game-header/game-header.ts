import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-game-header',
  standalone: true,
  templateUrl: './game-header.html',
  styleUrl: './game-header.css',
})
export class GameHeader {
  @Input() title = '';
  @Input() balance = 0;
  @Input() gamesPlayed = 0;
  @Input() gamesWon = 0;
  @Input() gamesLost = 0;
  @Input() profitLoss = 0;
  @Input() winsLabel = 'Victoires';
  @Input() lossesLabel = 'Défaites';
  /** Pass a non-null string to show the message banner. */
  @Input() message: string | null = null;
  @Input() messageWin = false;
  @Input() messageLose = false;
}
