import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly apiUrl = 'https://localhost:7118/api/user';

  balance = signal<number>(0);

  constructor(private http: HttpClient) {}

  load(): void {
    this.http.get<{ balance: number }>(`${this.apiUrl}/balance`).subscribe(r => {
      this.balance.set(r.balance);
    });
  }

  save(amount: number): void {
    this.balance.set(amount);
    this.http.post(`${this.apiUrl}/balance`, { balance: amount }).subscribe();
  }

  restart(): Observable<{ balance: number }> {
    return this.http.post<{ balance: number }>(`${this.apiUrl}/restart`, {}).pipe(
      tap(r => {
        // Force la mise à jour même si la valeur est identique
        this.balance.set(0);
        this.balance.set(r.balance);
      })
    );
  }
}
