import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HighScoreService } from '../services/highscore.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit {
  readonly games = [
    {
      name: 'Blackjack',
      emoji: '🃏',
      path: '/blackjack',
      desc: 'Battez le croupier à 21',
      accent: '#667eea',
    },
    {
      name: 'Baccarat',
      emoji: '🎴',
      path: '/baccarat',
      desc: 'Joueur ou banquier ?',
      accent: '#e74c3c',
    },
    {
      name: 'Roulette',
      emoji: '🎡',
      path: '/roulette',
      desc: 'Rouge, noir ou vert ?',
      accent: '#e74c3c',
    },
    {
      name: 'Slots',
      emoji: '🎰',
      path: '/slots',
      desc: '3 symboles pour gagner',
      accent: '#f1c40f',
    },
    {
      name: 'Mines',
      emoji: '💣',
      path: '/mines',
      desc: 'Évitez les bombes',
      accent: '#2ecc71',
    },
    {
      name: 'Plinko',
      emoji: '🔵',
      path: '/plinko',
      desc: '0.1× à 100×',
      accent: '#667eea',
    },
    {
      name: 'Crash',
      emoji: '🚀',
      path: '/crash',
      desc: 'Encaissez avant le crash !',
      accent: '#e67e22',
    },
  ];

  constructor(public highScoreService: HighScoreService) {}

  ngOnInit(): void {
    this.highScoreService.loadMyBest();
  }
}
