import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Expense } from '../model/Expense';
import { ExpenseAddDto } from '../model/ExpenseAddDto';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient) {}

  getExpenses(): Observable<Expense[]> {
    return this.http.get<Expense[]>('/api/expense/all', { headers: this.headers });
  }

  addExpense(expense: ExpenseAddDto): Observable<Expense> {
    return this.http.post<Expense>('/api/expense/save', expense, { headers: this.headers });
  }

  updateExpense(id: number, expense: ExpenseAddDto): Observable<Expense> {
    return this.http.put<Expense>(`/api/expense/update/${id}`, expense, { headers: this.headers });
  }

  getCategoryTotals(
    userId: number,
  ): Observable<{ category: string; totalAmountPerCategory: number }[]> {
    return this.http.get<{ category: string; totalAmountPerCategory: number }[]>(
      `api/expense/categories/${userId}`,
    );
  }
}
