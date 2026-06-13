export interface Transaction {
  id: string;
  accountId: string;
  userId: string;
  amount: string;
  date: string;
  description: string;
  categoryId: string | null;
  isRecurring: boolean;
  createdAt: string;
  deletedAt: string | null;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash';
  currency: string;
  currentBalance: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  color: string;
  icon: string;
  parentCategoryId: string | null;
}

export interface TransactionListResponse {
  data: Transaction[];
  page: number;
  limit: number;
}
