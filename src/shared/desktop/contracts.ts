import type { WorkspacePreferences } from "@/shared/desktop/preferences";
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
  preferencesGet: "preferences:get",
  preferencesSave: "preferences:save",
  transactionsPreview: "transactions:preview",
  transactionsCommit: "transactions:commit",
  transactionsCancel: "transactions:cancel",
  transactionsList: "transactions:list",
  transactionDetail: "transactions:detail",
  transactionsExport: "transactions:export",
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface DesktopApi {
  getAppInfo: () => Promise<AppInfo>;
  getWorkspacePreferences: (legacy?: WorkspacePreferences) => Promise<WorkspacePreferences>;
  saveWorkspacePreferences: (preferences: WorkspacePreferences) => Promise<WorkspacePreferences>;
  previewTransactionImport: () => Promise<TransactionImportPreview | null>;
  commitTransactionImport: (request: CommitTransactionImport) => Promise<TransactionImportResult>;
  cancelTransactionImport: (token: string) => Promise<void>;
  listTransactions: (query: TransactionQuery) => Promise<TransactionList>;
  getTransaction: (id: string) => Promise<TransactionDetail>;
  exportTransactions: (month: string) => Promise<TransactionExportResult | null>;
}
