import { User } from './User';

export interface Expense {
  user: any;
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  ownerId: number;
  status: 'Paid' | 'Cancelled';
}
