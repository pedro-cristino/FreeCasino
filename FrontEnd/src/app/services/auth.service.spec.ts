import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('isAuthenticated', () => {
    it('returns false when no token in localStorage', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns true when a token is already in localStorage', () => {
      localStorage.setItem('blackjack_auth_token', 'existing-token');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          AuthService,
        ],
      });
      const freshService = TestBed.inject(AuthService);
      expect(freshService.isAuthenticated()).toBe(true);
      TestBed.inject(HttpTestingController).verify();
    });
  });

  describe('login()', () => {
    it('sets isAuthenticated to true and stores token on successful login', () => {
      let resolved = false;
      service.login('user', 'password').subscribe(() => { resolved = true; });

      const req = httpMock.expectOne(r => r.url.includes('/auth/login'));
      req.flush({ success: true, token: 'test-token-123', username: 'user' });

      expect(resolved).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(localStorage.getItem('blackjack_auth_token')).toBe('test-token-123');
      expect(localStorage.getItem('blackjack_username')).toBe('user');
    });

    it('does not set isAuthenticated when login fails', () => {
      service.login('user', 'wrong').subscribe();

      const req = httpMock.expectOne(r => r.url.includes('/auth/login'));
      req.flush({ success: false, message: 'Invalid credentials' });

      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('blackjack_auth_token')).toBeNull();
    });
  });

  describe('logout()', () => {
    it('clears localStorage and sets isAuthenticated to false', () => {
      localStorage.setItem('blackjack_auth_token', 'some-token');
      localStorage.setItem('blackjack_username', 'user');
      service.isAuthenticated.set(true);

      service.logout();

      httpMock.expectOne(r => r.url.includes('/auth/logout')).flush({});

      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('blackjack_auth_token')).toBeNull();
      expect(localStorage.getItem('blackjack_username')).toBeNull();
    });
  });
});
