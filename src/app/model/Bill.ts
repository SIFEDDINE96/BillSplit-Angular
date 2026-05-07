import { User } from "./User";

export interface Bill {
  user: any;
  id: number;
  description: string;
  amount: number;
  date: string;
  ownerId: number; 
  status: 'Paid' | 'Cancelled';
}
