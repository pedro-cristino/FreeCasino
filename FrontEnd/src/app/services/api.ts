import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Api {
  private apiUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}
}
