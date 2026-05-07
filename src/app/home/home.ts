import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { User } from '../model/User';
import { Bill } from '../model/Bill';
import { BillService } from '../service/bill.service';
import { BillAddDto } from '../model/BillAddDto';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';
import { UserService } from '../service/user.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  constructor(
    private billService: BillService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
  ) {}
  currentUserId: number | undefined;
  currentUsername: string | undefined;
  users: User[] = [];
  bills: Bill[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.userService.getCurrentUser().subscribe((user) => {
      this.currentUsername = user.username;
      this.currentUserId = user.id; // ← this was missing
    });
    this.resetForm();
    this.loadData();
  }

  // ── Load both in parallel, then trigger one detectChanges ──
  loadData(): void {
    this.isLoading = true;
    forkJoin({
      bills: this.billService.getBills(),
      users: this.userService.getUsers(),
    }).subscribe({
      next: ({ bills, users }) => {
        this.bills = bills.map((b) => ({ ...b, ownerId: +b.ownerId })).sort((a, b) => b.id - a.id);
        this.users = users;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading data', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get lowestPayerUsername(): string {
    if (!this.users?.length) return '';
    return this.users.reduce((min, u) => (u.totalPaidAmount < min.totalPaidAmount ? u : min))
      .username;
  }

  // ── Modal ──
  showModal = false;
  isEditMode = false;
  editingBillId: number | null = null;
  newBill: Partial<Bill> = {};

  // ── Pagination ──
  currentPage = 1;
  pageSize = 5;

  // ── Delete confirmation ──
  showDeleteConfirm = false;
  deletingBillId: number | null = null;

  get totalPages(): number {
    return Math.ceil(this.bills.length / this.pageSize);
  }

  get paginatedBills(): Bill[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.bills.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.resetForm();
    this.showModal = true;
  }

  openEditModal(bill: Bill): void {
    this.isEditMode = true;
    this.editingBillId = bill.id;
    this.newBill = { ...bill };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  private formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const HH = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
  }

  saveBill(): void {
    if (!this.newBill.description || !this.newBill.amount) return;
    if (!this.userService.getCurrentUser()) {
      console.error('User not loaded yet');
      return;
    }

    const billDto: BillAddDto = {
      description: this.newBill.description!,
      amount: this.newBill.amount!,
      date: this.formatDate(new Date()),
      status: this.newBill.status || 'Paid',
      ownerId: this.currentUserId!,
    };

    if (this.isEditMode && this.editingBillId !== null) {
      this.billService.updateBill(this.editingBillId, billDto).subscribe({
        next: (updatedBill) => {
          const idx = this.bills.findIndex((b) => b.id === this.editingBillId);
          if (idx !== -1) {
            this.bills[idx] = updatedBill;
            this.bills = [...this.bills];
          }
          this.closeAndReset();
          this.loadData();
        },
        error: (err) => console.error('Failed to update bill', err),
      });
    } else {
      this.billService.addBill(billDto).subscribe({
        next: (savedBill) => {
          this.bills = [savedBill, ...this.bills];
          this.currentPage = 1;
          this.closeAndReset();
          this.loadData();
        },
        error: (err) => console.error('Failed to save bill', err),
      });
    }
  }

  private closeAndReset(): void {
    this.resetForm();
    this.showModal = false;
    this.cdr.detectChanges();
  }

  confirmDelete(id: number): void {
    this.deletingBillId = id;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.deletingBillId = null;
  }

  handleLogout(): void {
    this.authService.logout().subscribe({
      next: () => {},
      error: () => {
        this.router.navigate(['/']);
      },
    });
  }

  resetForm(): void {
    this.newBill = {
      description: '',
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
      status: 'Paid',
    };
    this.editingBillId = null;
  }

  getOwnerName(ownerId: number): string {
    const owners: Record<number, string> = {
      1: 'Sifo',
      2: 'Abdo',
    };
    return owners[ownerId] || 'Unknown';
  }

  // Add these methods to your component class

  getHighestPaidAmount(): number {
    if (!this.users || this.users.length === 0) return 0;
    return Math.max(...this.users.map((u) => u.totalPaidAmount));
  }

  getAmountToReachEquilibrium(user: any): number {
    const highestAmount = this.getHighestPaidAmount();
    const difference = highestAmount - user.totalPaidAmount;

    if (difference <= 0) return 0;

    // Format based on your currency
    return difference;
  }

  getProgressPercentage(user: any): number {
    const highestAmount = this.getHighestPaidAmount();
    if (highestAmount === 0) return 100;

    const percentage = (user.totalPaidAmount / highestAmount) * 100;
    const roundedPercentage = Math.round(percentage * 100) / 100;
    return Math.min(Math.max(roundedPercentage, 0), 100); // Clamp between 0-100
  }

  showUserMenu = false;

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
    this.closeUserMenu();
  }
}
