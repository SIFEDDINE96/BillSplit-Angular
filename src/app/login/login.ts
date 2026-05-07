import { Component, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Footer } from '../shared/footer/footer';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule, FormsModule, Footer],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  constructor(
  private authService: AuthService,
  private router: Router
) {}

  email = '';
  username = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
  this.errorMessage = '';

  if (!this.username || !this.password) {
    this.errorMessage = 'Please fill in all fields.';
    return;
  }

  this.isLoading = true;

  this.authService.login(this.username, this.password).subscribe({
    next: (response) => {
      this.isLoading = false;
      // JWT is stored in HttpOnly cookie automatically by the browser
      // Optionally store non-sensitive user info for UI use
      localStorage.setItem('user', JSON.stringify(response)); // e.g. { username, role }
      this.router.navigate(['/home']);
    },
    error: (err) => {
      this.isLoading = false;
      this.errorMessage =
        err.status === 401
          ? 'Invalid username or password.'
          : 'Something went wrong. Please try again.';
    },
  });
  }

}
