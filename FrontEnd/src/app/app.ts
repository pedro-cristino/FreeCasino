import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navigation } from './navigation/navigation';
import { Toast } from './toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navigation, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
}
