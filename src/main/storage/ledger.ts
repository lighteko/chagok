import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  Classification,
  ClassificationRule,
  Expense,
  LedgerEntry,
  LedgerWorkspace,
  PaymentLink,
  PeriodSnapshot,
  SettlementSettings,
  AuditEvent,
  BulkClassification,
} from "@/shared/desktop/ledger";
import { calculateSettlement } from "@/domains/settlement/calculation/calculateSettlement";
import * as valid from "./ledgerValidation";

const DEFAULT_SETTINGS: SettlementSettings = {
  allocations: [
    { id: "recipient-1", recipient: "남주원장님", basisPoints: 8000 },
    { id: "recipient-2", recipient: "엄마론", basisPoints: 2000 },
  ],
  rounding: "largest-remainder",
};
const CATEGORIES = ["수업료", "기타수입", "재료비", "임차료", "인건비", "수수료", "식비", "기타지출"];

export function migrateLedger(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE ledger_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
      CREATE TABLE classifications (transaction_id TEXT PRIMARY KEY REFERENCES bank_transactions(id), month TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
      CREATE INDEX classifications_month ON classifications(month);
      CREATE TABLE expenses (id TEXT PRIMARY KEY, month TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
      CREATE INDEX expenses_month ON expenses(month);
      CREATE TABLE payment_links (expense_id TEXT NOT NULL REFERENCES expenses(id), transaction_id TEXT NOT NULL REFERENCES bank_transactions(id), amount INTEGER NOT NULL CHECK(amount > 0), PRIMARY KEY(expense_id,transaction_id)) STRICT;
      CREATE TABLE classification_rules (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
      CREATE TABLE settlement_settings (month TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
      CREATE TABLE settlement_snapshots (id TEXT PRIMARY KEY, month TEXT NOT NULL, closed_at TEXT NOT NULL, reopened_at TEXT, reopen_reason TEXT, report TEXT NOT NULL CHECK(json_valid(report))) STRICT;
      CREATE UNIQUE INDEX one_closed_snapshot ON settlement_snapshots(month) WHERE reopened_at IS NULL;
      CREATE TABLE ledger_audit (id TEXT PRIMARY KEY, at TEXT NOT NULL, month TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL) STRICT;
      CREATE INDEX ledger_audit_month ON ledger_audit(month,at);
      CREATE TABLE receipts (id TEXT PRIMARY KEY, expense_id TEXT NOT NULL REFERENCES expenses(id), file_name TEXT NOT NULL, stored_name TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, sha256 TEXT NOT NULL) STRICT;
      PRAGMA user_version = 3;
    `);
    const insert = db.prepare("INSERT INTO ledger_categories VALUES (?, ?)");
    CATEGORIES.forEach((name, index) => insert.run(`category-${index + 1}`, name));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export class LedgerRepository {
  constructor(private readonly db: DatabaseSync) {}

  private atomic<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private all<T>(table: "classifications" | "expenses" | "classification_rules"): T[] {
    return this.db
      .prepare(`SELECT data FROM ${table} ORDER BY rowid`)
      .all()
      .map(row => JSON.parse(String(row.data)) as T);
  }
  private category(id: string | null) {
    if (id !== null && !this.db.prepare("SELECT 1 FROM ledger_categories WHERE id=?").get(id))
      throw new Error("정산 항목을 찾을 수 없습니다.");
  }
  assertOpen(month: string) {
    if (this.db.prepare("SELECT 1 FROM settlement_snapshots WHERE month=? AND reopened_at IS NULL").get(month))
      throw new Error(`${month}은 마감되었습니다. 사유를 기록하고 재개방한 뒤 수정해 주세요.`);
  }
  private audit(month: string, action: string, entityId: string, before: unknown, after: unknown) {
    this.db
      .prepare("INSERT INTO ledger_audit VALUES (?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        new Date().toISOString(),
        month,
        action,
        entityId,
        JSON.stringify(before ?? null),
        JSON.stringify(after ?? null),
      );
  }
  private getClassification(id: string): Classification | null {
    const row = this.db.prepare("SELECT data FROM classifications WHERE transaction_id=?").get(id);
    return row ? JSON.parse(String(row.data)) : null;
  }
  private getExpense(id: string): Expense {
    const row = this.db.prepare("SELECT data FROM expenses WHERE id=?").get(id);
    if (!row) throw new Error("지출을 찾을 수 없습니다.");
    return JSON.parse(String(row.data));
  }
  private bank(id: string) {
    const row = this.db.prepare("SELECT * FROM bank_transactions WHERE id=?").get(id);
    if (!row) throw new Error("거래를 찾을 수 없습니다.");
    return row;
  }
  links(): PaymentLink[] {
    return this.db
      .prepare("SELECT * FROM payment_links ORDER BY expense_id,transaction_id")
      .all()
      .map(row => ({
        expenseId: String(row.expense_id),
        transactionId: String(row.transaction_id),
        amount: Number(row.amount),
      }));
  }
  private assertLinkedOpen(transactionId?: string, expenseId?: string) {
    for (const link of this.links()) {
      if (link.transactionId === transactionId || link.expenseId === expenseId) {
        this.assertOpen(this.getExpense(link.expenseId).settlementMonth);
        this.assertOpen(
          this.getClassification(link.transactionId)?.settlementMonth ??
            String(this.bank(link.transactionId).occurred_at).slice(0, 7),
        );
      }
    }
  }
  private saveClassification(value: Classification) {
    const before = this.getClassification(value.transactionId);
    const bank = this.bank(value.transactionId);
    this.assertOpen(before?.settlementMonth ?? String(bank.occurred_at).slice(0, 7));
    this.assertOpen(value.settlementMonth);
    this.assertLinkedOpen(value.transactionId);
    this.category(value.categoryId);
    const linked = this.links()
      .filter(row => row.transactionId === value.transactionId)
      .reduce((sum, row) => sum + row.amount, 0);
    if (
      linked &&
      (value.direction !== "expense" || value.withdrawal === null || value.withdrawal < linked || value.deposit !== 0)
    )
      throw new Error("연결된 지출보다 출금을 줄이거나 다른 분류로 변경할 수 없습니다. 연결부터 수정해 주세요.");
    if (
      value.confirmed &&
      value.direction !== "excluded" &&
      JSON.parse(String(bank.issues_json)).length &&
      !value.note.trim()
    )
      throw new Error("원본의 확인 필요 사항을 검토한 사유를 입력해 주세요.");
    this.db
      .prepare(
        "INSERT INTO classifications VALUES (?,?,?) ON CONFLICT(transaction_id) DO UPDATE SET month=excluded.month,data=excluded.data",
      )
      .run(value.transactionId, value.settlementMonth, JSON.stringify(value));
    this.audit(value.settlementMonth, "거래 분류·보정", value.transactionId, before, value);
    if (before && before.settlementMonth !== value.settlementMonth)
      this.audit(before.settlementMonth, "정산월 이동", value.transactionId, before, value);
    return value;
  }
  classify(input: unknown) {
    const value = valid.classification(input);
    return this.atomic(() => this.saveClassification(value));
  }
  bulkClassify(input: unknown) {
    const value = valid.object(input) as unknown as BulkClassification;
    if (
      !Array.isArray(value.ids) ||
      !value.ids.length ||
      value.ids.length > 1000 ||
      new Set(value.ids).size !== value.ids.length
    )
      throw new Error("한 번에 1~1,000건의 거래를 선택해 주세요.");
    return this.atomic(() =>
      value.ids.map(identifier => {
        const id = valid.id(identifier),
          bank = this.bank(id),
          previous = this.getClassification(id);
        return this.saveClassification(
          valid.classification({
            ...value,
            transactionId: id,
            description: previous?.description ?? bank.description,
            withdrawal: previous ? previous.withdrawal : bank.withdrawal,
            deposit: previous ? previous.deposit : bank.deposit,
          }),
        );
      }),
    );
  }
  saveExpense(input: unknown) {
    const value = valid.expense(input);
    return this.atomic(() => {
      const row = this.db.prepare("SELECT data FROM expenses WHERE id=?").get(value.id);
      const before: Expense | null = row ? JSON.parse(String(row.data)) : null;
      this.assertOpen(value.settlementMonth);
      if (before) this.assertOpen(before.settlementMonth);
      this.assertLinkedOpen(undefined, value.id);
      this.category(value.categoryId);
      const linked = this.links()
        .filter(row => row.expenseId === value.id)
        .reduce((sum, row) => sum + row.amount, 0);
      if (linked > value.amount) throw new Error("연결 금액보다 지출 금액을 줄일 수 없습니다.");
      this.db
        .prepare(
          "INSERT INTO expenses VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET month=excluded.month,data=excluded.data",
        )
        .run(value.id, value.settlementMonth, JSON.stringify(value));
      this.audit(value.settlementMonth, "별도 지출 저장", value.id, before, value);
      if (before && before.settlementMonth !== value.settlementMonth)
        this.audit(before.settlementMonth, "정산월 이동", value.id, before, value);
      return value;
    });
  }
  deleteExpense(input: unknown) {
    const id = valid.id(input);
    return this.atomic(() => {
      const before = this.getExpense(id);
      this.assertOpen(before.settlementMonth);
      this.assertLinkedOpen(undefined, id);
      this.db.prepare("DELETE FROM payment_links WHERE expense_id=?").run(id);
      // 영수증 파일은 보존하되 메타데이터는 제거합니다. 백업은 참조 중인 영수증만 포함합니다.
      this.db.prepare("DELETE FROM receipts WHERE expense_id=?").run(id);
      this.db.prepare("DELETE FROM expenses WHERE id=?").run(id);
      this.audit(before.settlementMonth, "별도 지출 삭제", id, before, null);
    });
  }
  saveLink(input: unknown) {
    const value = valid.object(input);
    const expenseId = valid.id(value.expenseId),
      transactionId = valid.id(value.transactionId),
      amount = valid.amount(value.amount)!;
    return this.atomic(() => {
      const expense = this.getExpense(expenseId),
        classification = this.getClassification(transactionId);
      this.assertOpen(expense.settlementMonth);
      if (
        !classification ||
        classification.direction !== "expense" ||
        classification.withdrawal === null ||
        classification.deposit !== 0
      )
        throw new Error("먼저 통장 출금을 지출로 분류하고 금액을 보정해 주세요.");
      this.assertOpen(classification.settlementMonth);
      const links = this.links(),
        before = links.find(row => row.expenseId === expenseId && row.transactionId === transactionId) ?? null;
      const rest = links.filter(row => !(row.expenseId === expenseId && row.transactionId === transactionId));
      if (
        rest.filter(row => row.expenseId === expenseId).reduce((sum, row) => sum + row.amount, 0) + amount >
          expense.amount ||
        rest.filter(row => row.transactionId === transactionId).reduce((sum, row) => sum + row.amount, 0) + amount >
          classification.withdrawal
      )
        throw new Error("연결 합계가 별도 지출 또는 통장 출금 금액을 초과합니다.");
      if (amount === 0)
        this.db
          .prepare("DELETE FROM payment_links WHERE expense_id=? AND transaction_id=?")
          .run(expenseId, transactionId);
      else
        this.db
          .prepare(
            "INSERT INTO payment_links VALUES (?,?,?) ON CONFLICT(expense_id,transaction_id) DO UPDATE SET amount=excluded.amount",
          )
          .run(expenseId, transactionId, amount);
      this.audit(expense.settlementMonth, amount ? "통장 출금 연결" : "통장 출금 연결 해제", expenseId, before, {
        expenseId,
        transactionId,
        amount,
      });
      if (expense.settlementMonth !== classification.settlementMonth)
        this.audit(classification.settlementMonth, "지출 연결 변경", transactionId, before, {
          expenseId,
          transactionId,
          amount,
        });
    });
  }
  saveCategory(input: unknown) {
    const v = valid.object(input),
      id = valid.id(v.id),
      name = valid.text(v.name, "항목 이름", 100);
    // 이름 변경은 기존 마감본(스냅샷)에 영향을 주지 않습니다.
    return this.atomic(() => {
      this.db
        .prepare("INSERT INTO ledger_categories VALUES (?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name")
        .run(id, name);
      this.audit("global", "정산 항목 저장", id, null, { id, name });
    });
  }
  saveRule(input: unknown) {
    const value = valid.rule(input);
    this.category(value.categoryId);
    return this.atomic(() => {
      const before = this.all<ClassificationRule>("classification_rules").find(row => row.id === value.id) ?? null;
      this.db
        .prepare("INSERT INTO classification_rules VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
        .run(value.id, JSON.stringify(value));
      this.audit("global", "분류 규칙 저장", value.id, before, value);
      return value;
    });
  }
  deleteRule(input: unknown) {
    const id = valid.id(input);
    return this.atomic(() => {
      const before = this.all<ClassificationRule>("classification_rules").find(row => row.id === id);
      if (!before) throw new Error("규칙을 찾을 수 없습니다.");
      this.db.prepare("DELETE FROM classification_rules WHERE id=?").run(id);
      this.audit("global", "분류 규칙 삭제", id, before, null);
    });
  }
  suggestRules(input: unknown): number {
    const month = valid.month(input);
    return this.atomic(() => this.suggestRulesInTransaction(month));
  }
  /** 가져오기와 같은 SQLite 트랜잭션 안에서 호출합니다. */
  suggestRulesInTransaction(month: string): number {
    this.assertOpen(month);
    const rules = this.all<ClassificationRule>("classification_rules").filter(row => row.enabled);
    const banks = this.db
      .prepare("SELECT * FROM bank_transactions WHERE substr(occurred_at,1,7)=? ORDER BY occurred_at,id")
      .all(month);
    let count = 0;
    for (const bank of banks) {
      if (this.getClassification(String(bank.id))) continue;
      const rule = rules.find(rule =>
        String(bank[rule.field]).toLocaleLowerCase().includes(rule.contains.toLocaleLowerCase()),
      );
      if (!rule) continue;
      const value = valid.classification({
        transactionId: bank.id,
        direction: rule.direction,
        group: rule.group,
        categoryId: rule.categoryId,
        settlementMonth: month,
        withdrawal: bank.withdrawal,
        deposit: bank.deposit,
        description: bank.description,
        confirmed: false,
        note: `규칙 제안: ${rule.name} (${rule.field}에 ‘${rule.contains}’ 포함)`,
      });
      value.ruleId = rule.id;
      this.saveClassification(value);
      count++;
    }
    return count;
  }
  saveSettings(inputMonth: unknown, input: unknown) {
    const month = valid.month(inputMonth),
      value = valid.settings(input);
    return this.atomic(() => {
      this.assertOpen(month);
      const before = this.settings(month);
      this.db
        .prepare("INSERT INTO settlement_settings VALUES (?,?) ON CONFLICT(month) DO UPDATE SET data=excluded.data")
        .run(month, JSON.stringify(value));
      this.audit(month, "배분 설정 저장", month, before, value);
      return value;
    });
  }
  private settings(month: string): SettlementSettings {
    const row = this.db.prepare("SELECT data FROM settlement_settings WHERE month=?").get(month);
    return row ? valid.settings(JSON.parse(String(row.data))) : structuredClone(DEFAULT_SETTINGS);
  }
  private snapshots(month: string): PeriodSnapshot[] {
    return this.db
      .prepare("SELECT * FROM settlement_snapshots WHERE month=? ORDER BY closed_at DESC,id")
      .all(month)
      .map(row => ({
        id: String(row.id),
        month,
        closedAt: String(row.closed_at),
        reopenedAt: row.reopened_at as string | null,
        reopenReason: row.reopen_reason as string | null,
        report: JSON.parse(String(row.report)),
      }));
  }
  workspace(input: unknown): LedgerWorkspace {
    const month = valid.month(input);
    const categories = this.db
      .prepare("SELECT id,name FROM ledger_categories ORDER BY rowid")
      .all()
      .map(row => ({ id: String(row.id), name: String(row.name) }));
    const classifications = this.all<Classification>("classifications"),
      expenses = this.all<Expense>("expenses"),
      links = this.links();
    const names = new Map(categories.map(row => [row.id, row.name])),
      byId = new Map(classifications.map(row => [row.transactionId, row]));
    const entries: LedgerEntry[] = [];
    // 명시적인 정산월이 없을 때만 원본 거래월을 사용합니다.
    const banks = this.db
      .prepare(
        "SELECT t.* FROM bank_transactions t LEFT JOIN classifications c ON c.transaction_id=t.id WHERE c.month=? OR (c.transaction_id IS NULL AND substr(t.occurred_at,1,7)=?) ORDER BY t.occurred_at,t.id",
      )
      .all(month, month);
    for (const bank of banks) {
      const id = String(bank.id),
        c = byId.get(id),
        direction = c?.direction ?? "unclassified";
      const linkedAmount = links.filter(row => row.transactionId === id).reduce((sum, row) => sum + row.amount, 0);
      const gross = direction === "income" ? c!.deposit : direction === "expense" ? c!.withdrawal : null;
      const amount = gross === null ? null : gross - linkedAmount;
      entries.push({
        id,
        source: "bank",
        occurredOn: String(bank.occurred_at).slice(0, 10),
        settlementMonth: month,
        description: c?.description || String(bank.description) || String(bank.counterparty),
        direction,
        categoryId: c?.categoryId ?? null,
        categoryName: names.get(c?.categoryId ?? "") ?? "미분류",
        group: c?.group ?? "other",
        amount,
        linkedAmount,
        confirmed: c?.confirmed ?? false,
        note: c?.note ?? "",
        paidBy: String(bank.account_name),
      });
    }
    for (const expense of expenses.filter(row => row.settlementMonth === month))
      entries.push({
        id: expense.id,
        source: "expense",
        occurredOn: expense.occurredOn,
        settlementMonth: month,
        description: expense.description,
        direction: "expense",
        categoryId: expense.categoryId,
        categoryName: names.get(expense.categoryId) ?? "기타지출",
        group: expense.group,
        amount: expense.amount,
        linkedAmount: links.filter(row => row.expenseId === expense.id).reduce((sum, row) => sum + row.amount, 0),
        confirmed: true,
        note: expense.note,
        paidBy: expense.paidBy,
      });
    const snapshots = this.snapshots(month),
      closed = snapshots.find(row => !row.reopenedAt);
    const report = closed?.report ?? calculateSettlement(month, entries, this.settings(month));
    const audit: AuditEvent[] = this.db
      .prepare("SELECT * FROM ledger_audit WHERE month IN (?, 'global') ORDER BY at DESC,rowid DESC LIMIT 50")
      .all(month)
      .map(row => ({
        id: String(row.id),
        at: String(row.at),
        action: String(row.action),
        entityId: String(row.entity_id),
        before: JSON.parse(String(row.before_json)),
        after: JSON.parse(String(row.after_json)),
      }));
    return {
      categories,
      classifications,
      expenses,
      links,
      rules: this.all<ClassificationRule>("classification_rules"),
      report,
      snapshots,
      closed: Boolean(closed),
      audit,
    };
  }
  closePeriod(input: unknown): PeriodSnapshot {
    const month = valid.month(input);
    return this.atomic(() => {
      this.assertOpen(month);
      const report = this.workspace(month).report;
      if (!report.entries.length) throw new Error("정산 자료가 없는 월은 마감할 수 없습니다.");
      if (report.pending) throw new Error(`미분류·미확정·금액 누락 ${report.pending}건을 확인한 뒤 마감해 주세요.`);
      const snapshot: PeriodSnapshot = {
        id: randomUUID(),
        month,
        closedAt: new Date().toISOString(),
        reopenedAt: null,
        reopenReason: null,
        report,
      };
      this.db
        .prepare("INSERT INTO settlement_snapshots VALUES (?,?,?,NULL,NULL,?)")
        .run(snapshot.id, month, snapshot.closedAt, JSON.stringify(report));
      this.audit(month, "월 마감", snapshot.id, null, snapshot);
      return snapshot;
    });
  }
  auditPage(inputMonth: unknown, inputPage: unknown): { rows: AuditEvent[]; total: number } {
    const month = valid.month(inputMonth);
    if (!Number.isInteger(inputPage) || (inputPage as number) < 0 || (inputPage as number) > 100000)
      throw new Error("이력 조회 조건을 확인해 주세요.");
    const total = Number(
      this.db.prepare("SELECT count(*) AS count FROM ledger_audit WHERE month IN (?, 'global')").get(month)!.count,
    );
    const rows = this.db
      .prepare("SELECT * FROM ledger_audit WHERE month IN (?, 'global') ORDER BY at DESC,rowid DESC LIMIT 50 OFFSET ?")
      .all(month, (inputPage as number) * 50)
      .map(row => ({
        id: String(row.id),
        at: String(row.at),
        action: String(row.action),
        entityId: String(row.entity_id),
        before: JSON.parse(String(row.before_json)),
        after: JSON.parse(String(row.after_json)),
      }));
    return { rows, total };
  }
  reopenPeriod(input: unknown, inputReason: unknown) {
    const month = valid.month(input),
      reason = valid.text(inputReason, "재개방 사유", 2000);
    return this.atomic(() => {
      const snapshot = this.snapshots(month).find(row => !row.reopenedAt);
      if (!snapshot) throw new Error("마감된 월이 아닙니다.");
      this.db
        .prepare("UPDATE settlement_snapshots SET reopened_at=?,reopen_reason=? WHERE id=?")
        .run(new Date().toISOString(), reason, snapshot.id);
      this.audit(month, "월 재개방", snapshot.id, snapshot, { reason });
    });
  }
  assertExpenseOpen(id: string) {
    const expense = this.getExpense(valid.id(id));
    this.assertOpen(expense.settlementMonth);
    return expense;
  }
  receipts(input: unknown) {
    const expenseId = valid.id(input);
    this.getExpense(expenseId);
    return this.db
      .prepare("SELECT id,expense_id,file_name,size FROM receipts WHERE expense_id=? ORDER BY rowid")
      .all(expenseId)
      .map(row => ({
        id: String(row.id),
        expenseId: String(row.expense_id),
        fileName: String(row.file_name),
        size: Number(row.size),
      }));
  }
  receipt(input: unknown) {
    const row = this.db.prepare("SELECT * FROM receipts WHERE id=?").get(valid.id(input));
    if (!row) throw new Error("영수증을 찾을 수 없습니다.");
    return {
      id: String(row.id),
      expenseId: String(row.expense_id),
      fileName: String(row.file_name),
      storedName: String(row.stored_name),
      size: Number(row.size),
      sha256: String(row.sha256),
    };
  }
  addReceipt(value: {
    id: string;
    expenseId: string;
    fileName: string;
    storedName: string;
    size: number;
    sha256: string;
  }) {
    return this.atomic(() => {
      const expense = this.assertExpenseOpen(value.expenseId);
      this.db
        .prepare("INSERT INTO receipts VALUES (?,?,?,?,?,?)")
        .run(value.id, value.expenseId, value.fileName, value.storedName, value.size, value.sha256);
      this.audit(expense.settlementMonth, "영수증 첨부", value.expenseId, null, {
        id: value.id,
        fileName: value.fileName,
        size: value.size,
      });
    });
  }
  deleteReceipt(input: unknown) {
    const receipt = this.receipt(input);
    return this.atomic(() => {
      const expense = this.assertExpenseOpen(receipt.expenseId);
      this.db.prepare("DELETE FROM receipts WHERE id=?").run(receipt.id);
      this.audit(
        expense.settlementMonth,
        "영수증 제거",
        expense.id,
        { id: receipt.id, fileName: receipt.fileName },
        null,
      );
      return receipt;
    });
  }
}
