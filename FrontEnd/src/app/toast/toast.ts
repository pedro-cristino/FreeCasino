import { Component } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class Toast {
  constructor(readonly toastService: ToastService) {}
}
