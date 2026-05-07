export interface BillAddDto {
  description: string;
  amount: number;
  date: string; // ← must be string, not Date
  status: string;
  ownerId: number;
}
