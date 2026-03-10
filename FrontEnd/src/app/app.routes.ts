import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Register } from './register/register';
import { Home } from './home/home';
import { Blackjack } from './blackjack/blackjack';
import { Baccarat } from './baccarat/baccarat';
import { Roulette } from './roulette/roulette';
import { Slots } from './slots/slots';
import { Mines } from './mines/mines';
import { Plinko } from './plinko/plinko';
import { Crash } from './crash/crash';
import { HiLo } from './hilo/hilo';
import { Leaderboard } from './leaderboard/leaderboard';
import { Achievements } from './achievements/achievements';
import { Stats } from './stats/stats';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'blackjack', component: Blackjack, canActivate: [authGuard] },
  { path: 'baccarat', component: Baccarat, canActivate: [authGuard] },
  { path: 'roulette', component: Roulette, canActivate: [authGuard] },
  { path: 'slots', component: Slots, canActivate: [authGuard] },
  { path: 'mines', component: Mines, canActivate: [authGuard] },
  { path: 'plinko', component: Plinko, canActivate: [authGuard] },
  { path: 'crash', component: Crash, canActivate: [authGuard] },
  { path: 'hilo', component: HiLo, canActivate: [authGuard] },
  { path: 'leaderboard', component: Leaderboard, canActivate: [authGuard] },
  { path: 'achievements', component: Achievements, canActivate: [authGuard] },
  { path: 'stats', component: Stats, canActivate: [authGuard] },
  { path: '**', redirectTo: '/home' }
];
