import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BillAddDto } from '../model/BillAddDto';
import { Bill } from '../model/Bill';

@Injectable({ providedIn: 'root' })
export class BillService {
  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient) {}

  getBills(): Observable<Bill[]> {
    return this.http.get<Bill[]>('/api/bill/all', { headers: this.headers });
  }

  addBill(bill: BillAddDto): Observable<Bill> {
    return this.http.post<Bill>('/api/bill/save', bill, { headers: this.headers });
  }

  updateBill(id: number, bill: BillAddDto): Observable<Bill> {
    return this.http.put<Bill>(`/api/bill/update/${id}`, bill, { headers: this.headers });
  }
}
