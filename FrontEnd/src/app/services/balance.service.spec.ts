import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BalanceService } from './balance.service';

describe('BalanceService', () => {
  let service: BalanceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        BalanceService,
      ],
    });
    service = TestBed.inject(BalanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('save()', () => {
    it('updates the balance signal immediately', () => {
      expect(service.balance()).toBe(0);
      service.save(500);
      httpMock.expectOne(r => r.url.includes('/user/balance') && r.method === 'POST').flush({});
      expect(service.balance()).toBe(500);
    });

    it('sends a POST request with the new balance', () => {
      service.save(250);
      const req = httpMock.expectOne(r => r.url.includes('/user/balance') && r.method === 'POST');
      expect(req.request.body).toEqual({ balance: 250 });
      req.flush({});
    });
  });

  describe('load()', () => {
    it('updates the balance signal when API returns a value', () => {
      service.load();
      const req = httpMock.expectOne(r => r.url.includes('/user/balance') && r.method === 'GET');
      req.flush({ balance: 1000 });
      expect(service.balance()).toBe(1000);
    });

    it('makes a GET request to the balance endpoint', () => {
      service.load();
      const req = httpMock.expectOne(r => r.method === 'GET' && r.url.includes('/user/balance'));
      expect(req).toBeTruthy();
      req.flush({ balance: 0 });
    });
  });
});
