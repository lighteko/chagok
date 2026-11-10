import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  ParsedSheet,
  TransactionDetail,
  TransactionList,
  TransactionQuery,
  TransactionRecord,
} from "@/shared/desktop/transactions";
import { isValidMonth, shiftMonth } from "@/shared/utils/month";

export function migrateTransactions(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE transaction_imports (
        id TEXT PRIMARY KEY, file_name TEXT NOT NULL, file_hash TEXT NOT NULL, sheet_name TEXT NOT NULL,
        account_name TEXT NOT NULL, imported_at TEXT NOT NULL, requested_count INTEGER NOT NULL,
        inserted_count INTEGER NOT NULL, duplicate_count INTEGER NOT NULL, rejected_json TEXT NOT NULL, warnings_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE bank_transactions (
        id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES transaction_imports(id), source_row INTEGER NOT NULL,
        account_name TEXT NOT NULL, occurred_at TEXT NOT NULL,
        withdrawal INTEGER CHECK(withdrawal >= 0), deposit INTEGER CHECK(deposit >= 0), balance INTEGER,
        description TEXT NOT NULL, memo TEXT NOT NULL, counterparty TEXT NOT NULL, bank TEXT NOT NULL, kind TEXT NOT NULL,
        issues_json TEXT NOT NULL, raw_json TEXT NOT NULL, amount_complete INTEGER NOT NULL CHECK(amount_complete IN (0,1)),
        fingerprint TEXT NOT NULL, occurrence INTEGER NOT NULL,
        UNIQUE(account_name, fingerprint, occurrence)
      ) STRICT;
      CREATE INDEX bank_transactions_date ON bank_transactions(occurred_at);
      PRAGMA user_version = 2;
    `);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export class TransactionRepository {
  constructor(private readonly db: DatabaseSync) {}

  import(sheet: ParsedSheet, fileName: string, fileHash: string, accountName: string, months: string[]) {
    const rows = sheet.rows.filter(row => months.includes(row.occurredAt.slice(0, 7)));
    const importId = randomUUID();
    const occurrences = new Map<string, number>();
    let inserted = 0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(`INSERT INTO transaction_imports VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`)
        .run(
          importId,
          fileName,
          fileHash,
          sheet.sheetName,
          accountName,
          new Date().toISOString(),
          rows.length,
          JSON.stringify(sheet.rejected),
          JSON.stringify(sheet.warnings),
        );
      const insert = this.db.prepare(
        `INSERT INTO bank_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account_name, fingerprint, occurrence) DO NOTHING`,
      );
      for (const row of rows) {
        // 불완전한 거래는 같은 파일의 같은 원본 행일 때만 중복 제외합니다.
        const identity =
          row.amountComplete && row.balance !== null
            ? [
                row.occurredAt,
                row.withdrawal,
                row.deposit,
                row.balance,
                row.description,
                row.memo,
                row.counterparty,
                row.bank,
                row.kind,
              ]
            : [fileHash, sheet.sheetName, row.sourceRow];
        const fingerprint = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
        const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
        occurrences.set(fingerprint, occurrence);
        const result = insert.run(
          randomUUID(),
          importId,
          row.sourceRow,
          accountName,
          row.occurredAt,
          row.withdrawal,
          row.deposit,
          row.balance,
          row.description,
          row.memo,
          row.counterparty,
          row.bank,
          row.kind,
          JSON.stringify(row.issues),
          JSON.stringify(row.rawCells),
          Number(row.amountComplete),
          fingerprint,
          occurrence,
        );
        inserted += Number(result.changes);
      }
      this.db
        .prepare("UPDATE transaction_imports SET inserted_count = ?, duplicate_count = ? WHERE id = ?")
        .run(inserted, rows.length - inserted, importId);
      this.db.exec("COMMIT");
      return { inserted, duplicates: rows.length - inserted, months };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  list(value: unknown): TransactionList {
    if (!value || typeof value !== "object") throw new Error("거래 조회 조건을 확인해 주세요.");
    const query = value as TransactionQuery;
    if (
      !isValidMonth(query.month) ||
      typeof query.search !== "string" ||
      query.search.length > 120 ||
      !["all", "deposit", "withdrawal", "review"].includes(query.filter) ||
      !Number.isInteger(query.page) ||
      query.page < 0 ||
      query.page > 100000
    )
      throw new Error("거래 조회 조건을 확인해 주세요.");
    const bounds = [`${query.month}-01 00:00:00`, `${shiftMonth(query.month, 1)}-01 00:00:00`];
    const dateWhere = "t.occurred_at >= ? AND t.occurred_at < ?";
    const summary = this.db
      .prepare(
        `SELECT COUNT(*) AS count, SUM(deposit) AS deposits, SUM(withdrawal) AS withdrawals, SUM(1-amount_complete) AS missingAmounts, SUM(issues_json <> '[]') AS needsReview, COUNT(DISTINCT import_id) AS importCount FROM bank_transactions t WHERE ${dateWhere}`,
      )
      .get(...bounds)!;
    const count = Number(summary.count);
    const missingAmounts = Number(summary.missingAmounts ?? 0);
    const deposits = count
      ? summary.deposits === null && missingAmounts
        ? null
        : Number(summary.deposits ?? 0)
      : null;
    const withdrawals = count
      ? summary.withdrawals === null && missingAmounts
        ? null
        : Number(summary.withdrawals ?? 0)
      : null;
    const difference = count && !missingAmounts ? (deposits ?? 0) - (withdrawals ?? 0) : null;
    if ([deposits, withdrawals, difference].some(amount => amount !== null && !Number.isSafeInteger(amount)))
      throw new Error("금액 합계가 안전하게 계산할 수 있는 범위를 넘었습니다.");
    const filters = {
      all: "1=1",
      deposit: "t.deposit > 0",
      withdrawal: "t.withdrawal > 0",
      review: "t.issues_json <> '[]'",
    };
    const where = `${dateWhere} AND instr(lower(t.description || ' ' || t.memo || ' ' || t.counterparty || ' ' || t.account_name), lower(?)) > 0 AND ${filters[query.filter]}`;
    const parameters = [...bounds, query.search.trim()];
    const total = Number(
      this.db.prepare(`SELECT COUNT(*) AS count FROM bank_transactions t WHERE ${where}`).get(...parameters)!.count,
    );
    const rows = this.db
      .prepare(
        `SELECT t.*, i.file_name, i.sheet_name FROM bank_transactions t JOIN transaction_imports i ON i.id = t.import_id WHERE ${where} ORDER BY t.occurred_at DESC, t.source_row ASC, t.id LIMIT 50 OFFSET ?`,
      )
      .all(...parameters, query.page * 50)
      .map(row => this.record(row));
    return {
      rows,
      total,
      pageSize: 50,
      summary: {
        count,
        deposits,
        withdrawals,
        difference,
        missingAmounts,
        needsReview: Number(summary.needsReview ?? 0),
        importCount: Number(summary.importCount),
      },
    };
  }

  detail(id: unknown): TransactionDetail {
    if (typeof id !== "string" || id.length > 64) throw new Error("거래를 확인해 주세요.");
    const row = this.db
      .prepare(
        "SELECT t.*, i.file_name, i.sheet_name FROM bank_transactions t JOIN transaction_imports i ON i.id = t.import_id WHERE t.id = ?",
      )
      .get(id);
    if (!row) throw new Error("거래를 찾을 수 없습니다.");
    return { ...this.record(row), rawCells: JSON.parse(String(row.raw_json)) };
  }

  private record(row: Record<string, unknown>): TransactionRecord {
    return {
      id: String(row.id),
      accountName: String(row.account_name),
      sourceRow: Number(row.source_row),
      occurredAt: String(row.occurred_at),
      withdrawal: row.withdrawal as number | null,
      deposit: row.deposit as number | null,
      balance: row.balance as number | null,
      description: String(row.description),
      memo: String(row.memo),
      counterparty: String(row.counterparty),
      bank: String(row.bank),
      kind: String(row.kind),
      issues: JSON.parse(String(row.issues_json)),
      amountComplete: row.amount_complete === 1,
      fileName: String(row.file_name),
      sheetName: String(row.sheet_name),
    };
  }
}
