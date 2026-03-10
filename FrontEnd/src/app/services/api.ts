import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Api {
  private apiUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  getHelloWorld(): Observable<string> {
    return this.http.get(`${this.apiUrl}/helloworld`, { responseType: 'text' });
  }
}
