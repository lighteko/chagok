export type { ExpenseGroup, Expense as ManualExpense, PaymentLink } from "@/shared/desktop/ledger";

export interface ExpenseNavigation {
  action: "link" | "receipts";
  expenseId: string;
}
