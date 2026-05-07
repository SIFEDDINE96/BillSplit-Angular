import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '../model/User';

@Injectable({ providedIn: 'root' })
export class UserService {
  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/user/all', { headers: this.headers });
  }

  getCurrentUser(): Observable<any> {
    return this.http.get('/api/user/me', { headers: this.headers, withCredentials: true });
  }
}
