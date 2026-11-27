import type { WorkspacePreferences } from "@/shared/desktop/preferences";
import type {
  LedgerWorkspace,
  Classification,
  Expense,
  PaymentLink,
  ClassificationRule,
  Category,
  BulkClassification,
  SettlementSettings,
  PeriodSnapshot,
  ReceiptInfo,
} from "@/shared/desktop/ledger";
import type {
  CommitTransactionImport,
  TransactionImportPreview,
  TransactionImportResult,
  TransactionQuery,
  TransactionList,
  TransactionDetail,
  TransactionExportResult,
} from "@/shared/desktop/transactions";

export const IPC_CHANNELS = {
  appInfo: "app:info",
  mcpStatus: "mcp:status",
  mcpSetEnabled: "mcp:set-enabled",
  mcpCopyToken: "mcp:copy-token",
  mcpLedgerChanged: "mcp:ledger-changed",
  preferencesGet: "preferences:get",
  preferencesSave: "preferences:save",
  transactionsPreview: "transactions:preview",
  transactionsCommit: "transactions:commit",
  transactionsCancel: "transactions:cancel",
  transactionsList: "transactions:list",
  transactionDetail: "transactions:detail",
  transactionsExport: "transactions:export",
  ledgerGet: "ledger:get",
  ledgerAudit: "ledger:audit",
  ledgerClassify: "ledger:classify",
  ledgerBulkClassify: "ledger:bulk-classify",
  ledgerExpenseSave: "ledger:expense-save",
  ledgerExpenseDelete: "ledger:expense-delete",
  ledgerLink: "ledger:link",
  ledgerCategory: "ledger:category",
  ledgerRuleSave: "ledger:rule-save",
  ledgerRuleDelete: "ledger:rule-delete",
  ledgerRuleSuggest: "ledger:rule-suggest",
  ledgerSettings: "ledger:settings",
  ledgerClose: "ledger:close",
  ledgerReopen: "ledger:reopen",
  receiptsList: "receipts:list",
  receiptsAdd: "receipts:add",
  receiptsOpen: "receipts:open",
  receiptsDelete: "receipts:delete",
  backupCreate: "backup:create",
  backupRestore: "backup:restore",
  settlementExport: "settlement:export",
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface McpStatus {
  url: string | null;
  canClassify: boolean;
}

export interface DesktopApi {
  getAppInfo: () => Promise<AppInfo>;
  getMcpStatus: () => Promise<McpStatus>;
  setMcpEnabled: (enabled: boolean, allowClassification?: boolean) => Promise<McpStatus>;
  copyMcpToken: () => Promise<void>;
  onMcpLedgerChanged: (listener: () => void) => () => void;
  getWorkspacePreferences: (legacy?: WorkspacePreferences) => Promise<WorkspacePreferences>;
  saveWorkspacePreferences: (preferences: WorkspacePreferences) => Promise<WorkspacePreferences>;
  previewTransactionImport: () => Promise<TransactionImportPreview | null>;
  commitTransactionImport: (request: CommitTransactionImport) => Promise<TransactionImportResult>;
  cancelTransactionImport: (token: string) => Promise<void>;
  listTransactions: (query: TransactionQuery) => Promise<TransactionList>;
  getTransaction: (id: string) => Promise<TransactionDetail>;
  exportTransactions: (month: string) => Promise<TransactionExportResult | null>;
  getLedger: (month: string) => Promise<LedgerWorkspace>;
  getLedgerAudit: (
    month: string,
    page: number,
  ) => Promise<{ rows: import("@/shared/desktop/ledger").AuditEvent[]; total: number }>;
  classifyTransaction: (value: Classification) => Promise<Classification>;
  bulkClassifyTransactions: (value: BulkClassification) => Promise<Classification[]>;
  saveExpense: (value: Expense) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  savePaymentLink: (value: PaymentLink) => Promise<void>;
  saveCategory: (value: Category) => Promise<void>;
  saveClassificationRule: (value: ClassificationRule) => Promise<ClassificationRule>;
  deleteClassificationRule: (id: string) => Promise<void>;
  suggestClassificationRules: (month: string) => Promise<number>;
  saveSettlementSettings: (month: string, value: SettlementSettings) => Promise<SettlementSettings>;
  closePeriod: (month: string) => Promise<PeriodSnapshot>;
  reopenPeriod: (month: string, reason: string) => Promise<void>;
  listReceipts: (expenseId: string) => Promise<ReceiptInfo[]>;
  addReceipt: (expenseId: string) => Promise<ReceiptInfo[] | null>;
  openReceipt: (id: string) => Promise<void>;
  deleteReceipt: (id: string) => Promise<void>;
  createBackup: () => Promise<{ fileName: string; createdAt: string; receipts: number } | null>;
  restoreBackup: () => Promise<{ createdAt: string; transactions: number; expenses: number; receipts: number } | null>;
  exportSettlement: (month: string, snapshotId?: string) => Promise<TransactionExportResult | null>;
}
