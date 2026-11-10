export type ExpenseGroup = "cash" | "card" | "other";

export interface ManualExpense {
  id: string;
  occurredOn: string;
  settlementMonth: string;
  amount: number;
  description: string;
  group: ExpenseGroup;
  categoryId: string | null;
  paidBy: string;
  linkedTransactionId: string | null;
}
