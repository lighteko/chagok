export type LedgerDirection = "income" | "expense" | "transfer" | "excluded";
export type ExpenseGroup = "cash" | "card" | "other";
export interface Category {
  id: string;
  name: string;
}
export interface Classification {
  transactionId: string;
  direction: LedgerDirection;
  categoryId: string | null;
  group: ExpenseGroup;
  settlementMonth: string;
  withdrawal: number | null;
  deposit: number | null;
  description: string;
  note: string;
  confirmed: boolean;
  ruleId: string | null;
}
export interface Expense {
  id: string;
  occurredOn: string;
  settlementMonth: string;
  amount: number;
  description: string;
  group: ExpenseGroup;
  categoryId: string;
  paidBy: string;
  paymentMethod: string;
  note: string;
}
export interface PaymentLink {
  expenseId: string;
  transactionId: string;
  amount: number;
}
export interface ClassificationRule {
  id: string;
  name: string;
  field: "description" | "memo" | "counterparty";
  contains: string;
  direction: LedgerDirection;
  categoryId: string | null;
  group: ExpenseGroup;
  enabled: boolean;
}
export interface Allocation {
  id: string;
  recipient: string;
  basisPoints: number;
}
export interface SettlementSettings {
  allocations: Allocation[];
  rounding: "largest-remainder" | "last-recipient";
}
export interface LedgerEntry {
  id: string;
  source: "bank" | "expense";
  occurredOn: string;
  settlementMonth: string;
  description: string;
  direction: LedgerDirection | "unclassified";
  categoryId: string | null;
  categoryName: string;
  group: ExpenseGroup;
  amount: number | null;
  linkedAmount: number;
  confirmed: boolean;
  note: string;
  paidBy: string;
}
export interface SettlementReport {
  month: string;
  entries: LedgerEntry[];
  income: number;
  expenses: Record<ExpenseGroup, number>;
  totalExpenses: number;
  net: number;
  pending: number;
  settings: SettlementSettings;
  allocations: (Allocation & { amount: number })[];
}
export interface PeriodSnapshot {
  id: string;
  month: string;
  closedAt: string;
  reopenedAt: string | null;
  reopenReason: string | null;
  report: SettlementReport;
}
export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  entityId: string;
  before: unknown;
  after: unknown;
}
export interface LedgerWorkspace {
  categories: Category[];
  classifications: Classification[];
  expenses: Expense[];
  links: PaymentLink[];
  rules: ClassificationRule[];
  report: SettlementReport;
  snapshots: PeriodSnapshot[];
  closed: boolean;
  audit: AuditEvent[];
}
export interface BulkClassification {
  ids: string[];
  direction: LedgerDirection;
  categoryId: string | null;
  group: ExpenseGroup;
  settlementMonth: string;
  note: string;
  confirmed: boolean;
}
export interface ReceiptInfo {
  id: string;
  expenseId: string;
  fileName: string;
  size: number;
}
