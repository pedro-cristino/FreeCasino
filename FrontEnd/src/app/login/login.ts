import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  username = signal('');
  password = signal('');
  errorMessage = signal('');
  loading = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Si déjà connecté, rediriger vers blackjack
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
  }

  onSubmit(): void {
    this.errorMessage.set('');
    this.loading.set(true);

    this.authService.login(this.username(), this.password()).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          this.router.navigate(['/home']);
        } else {
          this.errorMessage.set(response.message || 'Login failed');
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set('Invalid username or password');
      }
    });
  }
}
