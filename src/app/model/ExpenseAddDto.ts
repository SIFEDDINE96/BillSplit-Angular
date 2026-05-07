export interface ExpenseAddDto {
  description: string;
  amount: number;
  category: string;
  date: string;
  status: string;
  ownerId: number;
}
