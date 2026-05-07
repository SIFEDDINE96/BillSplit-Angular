import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { User } from '../model/User';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';
import { ExpenseService } from '../service/expense.service';
import { UserService } from '../service/user.service';
import { ExpenseAddDto } from '../model/ExpenseAddDto';
import { Expense } from '../model/Expense';

@Component({
  selector: 'app-me',
  imports: [CommonModule, FormsModule],
  templateUrl: './me.html',
  styleUrl: './me.css',
})
export class Me implements OnInit {
  constructor(
    private expenseService: ExpenseService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
  ) {}

  currentUserId: number | undefined;
  currentUsername: string | undefined;
  users: User[] = [];
  expenses: Expense[] = [];
  isLoading = true;
  categoryTotals: { category: string; totalAmountPerCategory: number }[] = [];
  submitted = false;

  // ── Chart data ────────────────────────────────────────────────────────────
  monthlyData: { month: string; total: number }[] = [];
  currentMonthCategoryTotals: { category: string; totalAmountPerCategory: number }[] = [];

  // ── Hover state ───────────────────────────────────────────────────────────
  activeLineIdx = -1;
  activeColIdx = -1;

  // ── Line chart constants ──────────────────────────────────────────────────
  readonly lineW = 500;
  readonly lineH = 180; // was 180
  readonly linePadL = 46; // was 46
  readonly linePadR = 16; // was 16
  readonly linePadT = 22; // was 22
  readonly linePadB = 24; // was 24

  linePoints: { x: number; y: number; month: string; total: number }[] = [];
  lineCurvePath = '';
  lineAreaPath = '';
  lineYTicks: number[] = [];

  // ── Column chart constants ────────────────────────────────────────────────
  readonly colW = 500;
  readonly colH = 200; // was 200
  readonly colPadL = 46; // was 46
  readonly colPadR = 16; // was 16
  readonly colPadT = 32; // was 32
  readonly colPadB = 24; // was 24

  get colChartBottom(): number {
    return this.colH - this.colPadB;
  }

  colBarWidth = 40;
  colYTicks: number[] = [];

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.resetForm();
    this.userService.getCurrentUser().subscribe((user) => {
      this.currentUsername = user.username;
      this.currentUserId = user.id;
      if (this.currentUserId) {
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.isLoading = true;
    forkJoin({
      expenses: this.expenseService.getExpenses(),
      users: this.userService.getUsers(),
      categories: this.expenseService.getCategoryTotals(this.currentUserId!),
    }).subscribe({
      next: ({ expenses, users, categories }) => {
        const currentUserId = this.currentUserId ?? -1;
        this.expenses = expenses
          .map((e) => ({ ...e, ownerId: +e.ownerId }))
          .filter((e) => e.ownerId === currentUserId)
          .sort((a, b) => b.id - a.id);
        this.users = users;
        this.isLoading = false;
        this.categoryTotals = categories;
        this.buildCharts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading data', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Chart orchestrator ────────────────────────────────────────────────────
  buildCharts(): void {
    this.buildMonthlyData();
    this.buildCurrentMonthCategories();
    this.buildLineChart();
    this.buildColChart();
  }

  // ── Derive last-6-months totals from this.expenses ───────────────────────
  private buildMonthlyData(): void {
    const now = new Date();
    this.monthlyData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

      const total = this.expenses
        .filter((e) => {
          const ed = new Date(e.date);
          return ed.getFullYear() === yr && ed.getMonth() === mo && e.status !== 'Cancelled';
        })
        .reduce((sum, e) => sum + +e.amount, 0);

      this.monthlyData.push({ month: label, total });
    }
  }

  // ── Filter expenses to current month, group by category ──────────────────
  private buildCurrentMonthCategories(): void {
    // Derive the year/month from the selected monthlyData entry
    const now = new Date();
    const cursor = new Date(now.getFullYear(), now.getMonth() - (5 - this.selectedMonthIdx), 1);
    const yr = cursor.getFullYear();
    const mo = cursor.getMonth(); // 0-indexed

    const map = new Map<string, number>();
    this.expenses
      .filter((e) => {
        const ed = new Date(e.date);
        return ed.getFullYear() === yr && ed.getMonth() === mo && e.status !== 'Cancelled';
      })
      .forEach((e) => {
        map.set(e.category, (map.get(e.category) ?? 0) + +e.amount);
      });

    this.currentMonthCategoryTotals = Array.from(map.entries())
      .map(([category, totalAmountPerCategory]) => ({ category, totalAmountPerCategory }))
      .sort((a, b) => b.totalAmountPerCategory - a.totalAmountPerCategory);
  }

  // ── Build line chart geometry ─────────────────────────────────────────────
  private buildLineChart(): void {
    if (!this.monthlyData.length) return;

    const values = this.monthlyData.map((d) => d.total);
    const maxVal = Math.max(...values);
    const niceMax = this.niceNumber(maxVal * 1.15) || 100;

    this.lineYTicks = this.buildTicks(0, niceMax, 4);

    const chartW = this.lineW - this.linePadL - this.linePadR;
    const chartH = this.lineH - this.linePadT - this.linePadB;
    const n = this.monthlyData.length;
    const stepX = n > 1 ? chartW / (n - 1) : chartW;

    this.linePoints = this.monthlyData.map((d, i) => ({
      x: this.linePadL + i * stepX,
      y: this.linePadT + chartH - (niceMax > 0 ? (d.total / niceMax) * chartH : 0),
      month: d.month,
      total: d.total,
    }));

    this.lineCurvePath = this.smoothCurve(this.linePoints);
    this.lineAreaPath =
      this.lineCurvePath +
      ` L${this.linePoints.at(-1)!.x},${this.lineH - this.linePadB}` +
      ` L${this.linePoints[0].x},${this.lineH - this.linePadB} Z`;
  }

  lineYScale(val: number): number {
    const max = this.lineYTicks.at(-1) ?? 1;
    const chartH = this.lineH - this.linePadT - this.linePadB;
    return this.linePadT + chartH - (val / max) * chartH;
  }

  lineTooltipX(cx: number, w: number): number {
    return Math.min(Math.max(cx - w / 2, 0), this.lineW - w);
  }

  // ── Build column chart geometry ───────────────────────────────────────────
  private buildColChart(): void {
    if (!this.currentMonthCategoryTotals.length) return;

    const maxVal = Math.max(
      ...this.currentMonthCategoryTotals.map((c) => c.totalAmountPerCategory),
    );
    const niceMax = this.niceNumber(maxVal * 1.2) || 100;

    this.colYTicks = this.buildTicks(0, niceMax, 4);

    const chartW = this.colW - this.colPadL - this.colPadR;
    const n = this.currentMonthCategoryTotals.length;
    this.colBarWidth = Math.max(18, Math.min(64, (chartW / n) * 0.6));
  }

  colBarX(i: number): number {
    const chartW = this.colW - this.colPadL - this.colPadR;
    const n = this.currentMonthCategoryTotals.length;
    const slotW = chartW / n;
    return this.colPadL + i * slotW + (slotW - this.colBarWidth) / 2;
  }

  colYScale(val: number): number {
    const max = this.colYTicks.at(-1) ?? 1;
    const chartH = this.colChartBottom - this.colPadT;
    return this.colChartBottom - (val / max) * chartH;
  }

  colTooltipX(i: number, w: number): number {
    const cx = this.colBarX(i) + this.colBarWidth / 2;
    return Math.min(Math.max(cx - w / 2, 0), this.colW - w);
  }

  colShortLabel(cat: string): string {
    return cat.length > 7 ? cat.slice(0, 6) + '…' : cat;
  }

  // ── Dynamic current month label (e.g. "May 26") ───────────────────────────
  selectedMonthIdx = 5;
  get currentMonthLabel(): string {
    return this.monthlyData[this.selectedMonthIdx]?.month ?? '';
  }

  onMonthChange(idx: number): void {
    this.selectedMonthIdx = +idx;
    this.buildCurrentMonthCategories();
    this.buildColChart();
    this.cdr.detectChanges();
  }

  // ── Shared math helpers ───────────────────────────────────────────────────
  private smoothCurve(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return `M${pts[0].x},${pts[0].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const tension = 0.45;
      const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) * tension;
      const cp2x = pts[i + 1].x - (pts[i + 1].x - pts[i].x) * tension;
      d += ` C${cp1x},${pts[i].y} ${cp2x},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  }

  private niceNumber(val: number): number {
    if (val <= 0) return 100;
    const exp = Math.floor(Math.log10(val));
    const frac = val / Math.pow(10, exp);
    const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * Math.pow(10, exp);
  }

  private buildTicks(min: number, max: number, count: number): number[] {
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_, i) => Math.round(min + i * step));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Everything below is unchanged from the original
  // ─────────────────────────────────────────────────────────────────────────

  get lowestPayerUsername(): string {
    if (!this.users?.length) return '';
    return this.users.reduce((min, u) => (u.totalPaidAmount < min.totalPaidAmount ? u : min))
      .username;
  }

  // ── Modal ──
  showModal = false;
  isEditMode = false;
  editingExpenseId: number | null = null;
  newExpense: Partial<Expense> = {};

  // ── Pagination ──
  currentPage = 1;
  pageSize = 5;

  // ── Delete confirmation ──
  showDeleteConfirm = false;
  deletingExpenseId: number | null = null;

  get totalPages(): number {
    return Math.ceil(this.expenses.length / this.pageSize);
  }

  get paginatedExpenses(): Expense[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.expenses.slice(start, start + this.pageSize);
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

  openEditModal(expense: Expense): void {
    this.isEditMode = true;
    this.editingExpenseId = expense.id;
    this.newExpense = { ...expense };
    this.showModal = true;
  }

  closeModal(): void {
    this.submitted = false;
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

  saveExpense(): void {
    this.submitted = true;
    if (!this.newExpense.category) return;
    if (!this.newExpense.description || !this.newExpense.amount) return;
    if (!this.userService.getCurrentUser()) {
      console.error('User not loaded yet');
      return;
    }
    if (!this.newExpense.category) {
      alert('Please select a category.');
      return;
    }

    const expenseDto: ExpenseAddDto = {
      description: this.newExpense.description!,
      amount: this.newExpense.amount!,
      category: this.newExpense.category!,
      date: this.formatDate(new Date()),
      status: this.newExpense.status || 'Paid',
      ownerId: this.currentUserId!,
    };

    if (this.isEditMode && this.editingExpenseId !== null) {
      this.expenseService.updateExpense(this.editingExpenseId, expenseDto).subscribe({
        next: (updatedExpense) => {
          const idx = this.expenses.findIndex((e) => e.id === this.editingExpenseId);
          if (idx !== -1) {
            this.expenses[idx] = updatedExpense;
            this.expenses = [...this.expenses];
          }
          this.closeAndReset();
          this.loadData();
        },
        error: (err) => console.error('Failed to update expense', err),
      });
    } else {
      this.expenseService.addExpense(expenseDto).subscribe({
        next: (savedExpense) => {
          this.expenses = [savedExpense, ...this.expenses];
          this.currentPage = 1;
          this.closeAndReset();
          this.loadData();
        },
        error: (err) => console.error('Failed to save expense', err),
      });
    }
  }

  private closeAndReset(): void {
    this.resetForm();
    this.showModal = false;
    this.cdr.detectChanges();
  }

  confirmDelete(id: number): void {
    this.deletingExpenseId = id;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.deletingExpenseId = null;
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
    this.newExpense = {
      description: '',
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
      status: 'Paid',
      category: '',
    };
    this.editingExpenseId = null;
  }

  getOwnerName(ownerId: number): string {
    const owners: Record<number, string> = {
      1: 'Sifo',
      2: 'Abdo',
    };
    return owners[ownerId] || 'Unknown';
  }

  getHighestPaidAmount(): number {
    if (!this.users || this.users.length === 0) return 0;
    return Math.max(...this.users.map((u) => u.totalPaidAmount));
  }

  getAmountToReachEquilibrium(user: any): number {
    const highestAmount = this.getHighestPaidAmount();
    const difference = highestAmount - user.totalPaidAmount;
    if (difference <= 0) return 0;
    return difference;
  }

  getProgressPercentage(user: any): number {
    const highestAmount = this.getHighestPaidAmount();
    if (highestAmount === 0) return 100;
    const percentage = (user.totalPaidAmount / highestAmount) * 100;
    const roundedPercentage = Math.round(percentage * 100) / 100;
    return Math.min(Math.max(roundedPercentage, 0), 100);
  }

  getCategoryColor(index: number): string {
    const colors = [
      '#4f8ef7',
      '#7c5af7',
      '#34d399',
      '#f87171',
      '#fbbf24',
      '#60a5fa',
      '#a78bfa',
      '#f472b6',
      '#34d399',
    ];
    return colors[index % colors.length];
  }

  get totalSpent(): number {
    return this.categoryTotals.reduce((sum, c) => sum + c.totalAmountPerCategory, 0);
  }

  getDonutPath(index: number): string {
    const total = this.totalSpent;
    if (total === 0) return '';
    const cx = 60,
      cy = 60,
      r = 45;
    const circumference = 2 * Math.PI * r;

    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += this.categoryTotals[i].totalAmountPerCategory / total;
    }

    const fraction = this.categoryTotals[index].totalAmountPerCategory / total;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    const rotation = offset * 360 - 90;

    return `stroke-dasharray: ${dash} ${gap}; stroke-dashoffset: 0; transform: rotate(${rotation}deg); transform-origin: ${cx}px ${cy}px;`;
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
