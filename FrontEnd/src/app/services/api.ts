import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Api {
  private apiUrl = 'https://localhost:7118/api';

  constructor(private http: HttpClient) {}

  getHelloWorld(): Observable<string> {
    return this.http.get(`${this.apiUrl}/helloworld`, { responseType: 'text' });
  }
}
