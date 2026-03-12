import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navigation } from './navigation/navigation';
import { Toast } from './toast/toast';
import { DemonChallenge } from './demon/demon-challenge';
import { DemonBanner } from './demon/demon-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navigation, Toast, DemonChallenge, DemonBanner],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
}
