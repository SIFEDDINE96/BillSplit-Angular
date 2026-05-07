import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(username: string, password: string): Observable<any> {
    return this.http.post(
      '/api/auth/login',
      { username, password },
      { withCredentials: true }, // ✅ critical for receiving & sending cookies
    );
  }

  isLoggedIn(): boolean {
    // Since JWT is in HttpOnly cookie, you can't read it from JS
    // Use a flag in localStorage or a /me endpoint instead
    return !!localStorage.getItem('user');
  }

  logout(): Observable<any> {
    return this.http.post('/api/auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.router.navigate(['/']);
      }),
    );
  }
}
