export interface TransactionRecord {
  id: string;
  accountName: string;
  occurredAt: string;
  sourceRow: number;
  withdrawal: number | null;
  deposit: number | null;
  balance: number | null;
  description: string;
  memo: string;
  counterparty: string;
  bank: string;
  kind: string;
  issues: string[];
  amountComplete: boolean;
  fileName: string;
  sheetName: string;
}
export interface RawCell {
  column: string;
  value: string | number | boolean | null;
}
export interface ParsedTransaction extends Omit<TransactionRecord, "id" | "accountName" | "fileName" | "sheetName"> {
  rawCells: RawCell[];
}
export interface ParsedSheet {
  sheetId: string;
  sheetName: string;
  rows: ParsedTransaction[];
  rejected: { row: number; message: string }[];
  warnings: string[];
}
export interface ImportSheetPreview extends Omit<ParsedSheet, "rows"> {
  rows: ParsedTransaction[];
  total: number;
  rejectedCount: number;
  months: { month: string; count: number; needsReview: number }[];
}
export interface TransactionImportPreview {
  token: string;
  fileName: string;
  sheets: ImportSheetPreview[];
  skippedSheets: string[];
}
export interface CommitTransactionImport {
  token: string;
  sheetId: string;
  months: string[];
  accountName: string;
}
export interface TransactionImportResult {
  inserted: number;
  duplicates: number;
  months: string[];
}
export type TransactionFilter = "all" | "deposit" | "withdrawal" | "review";
export interface TransactionQuery {
  month: string;
  search: string;
  filter: TransactionFilter;
  page: number;
}
export interface TransactionList {
  rows: TransactionRecord[];
  total: number;
  pageSize: number;
  summary: {
    count: number;
    deposits: number | null;
    withdrawals: number | null;
    difference: number | null;
    needsReview: number;
    missingAmounts: number;
    importCount: number;
  };
}
export interface TransactionDetail extends TransactionRecord {
  rawCells: RawCell[];
}

export interface TransactionExportSnapshot {
  month: string;
  rows: TransactionRecord[];
  summary: TransactionList["summary"];
}

export interface TransactionExportResult {
  month: string;
  count: number;
  fileName: string;
}
