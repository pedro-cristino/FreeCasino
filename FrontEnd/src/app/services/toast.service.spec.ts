import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ToastService],
    });
    service = TestBed.inject(ToastService);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('show()', () => {
    it('adds a toast to the toasts signal', () => {
      expect(service.toasts().length).toBe(0);
      service.show('Achievement Unlocked', 'Win 10 games', 5);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0]['name']).toBe('Achievement Unlocked');
      expect(service.toasts()[0]['description']).toBe('Win 10 games');
      expect(service.toasts()[0]['type']).toBe('achievement');
    });

    it('assigns a unique id to each toast', () => {
      service.show('Toast 1', 'desc1', 0);
      service.show('Toast 2', 'desc2', 0);
      const ids = service.toasts().map(t => t.id);
      expect(new Set(ids).size).toBe(2);
    });
  });

  describe('auto-dismiss', () => {
    it('removes the toast after 5000ms', () => {
      service.show('Temp Toast', 'desc', 0);
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(5000);

      expect(service.toasts().length).toBe(0);
    });

    it('keeps the toast before 5000ms elapses', () => {
      service.show('Persistent Toast', 'desc', 0);
      vi.advanceTimersByTime(4999);
      expect(service.toasts().length).toBe(1);
    });
  });

  describe('dismiss()', () => {
    it('removes a toast by id', () => {
      service.show('Toast A', 'desc', 0);
      const id = service.toasts()[0].id;
      service.dismiss(id);
      expect(service.toasts().length).toBe(0);
    });

    it('only removes the toast with the matching id', () => {
      service.show('Toast A', 'desc', 0);
      service.show('Toast B', 'desc', 0);
      const id = service.toasts()[0].id;
      service.dismiss(id);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0]['name']).toBe('Toast B');
    });
  });
});
