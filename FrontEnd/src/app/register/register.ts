import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register implements OnInit {
  username = signal('');
  password = signal('');
  confirmPassword = signal('');
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Si déjà connecté, rediriger vers blackjack
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/blackjack']);
    }
  }

  onSubmit(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    // Validation
    if (!this.username() || !this.password() || !this.confirmPassword()) {
      this.errorMessage.set('All fields are required');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Passwords do not match');
      return;
    }

    if (this.password().length < 6) {
      this.errorMessage.set('Password must be at least 6 characters');
      return;
    }

    this.loading.set(true);

    this.authService.register(this.username(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('Compte créé ! Redirection vers la connexion...');
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: err => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Erreur lors de la création du compte');
      },
    });
  }
}
