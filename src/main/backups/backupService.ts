import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, stat, rename, rm, readdir, open } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { AppDatabase } from "../storage/database";
import { validReceiptName } from "../receipts/receiptService";

const MAX_BYTES = 250 * 1024 * 1024;
const TABLES = [
  "workspace_preferences",
  "transaction_imports",
  "bank_transactions",
  "ledger_categories",
  "classifications",
  "expenses",
  "payment_links",
  "classification_rules",
  "settlement_settings",
  "settlement_snapshots",
  "ledger_audit",
  "receipts",
];
interface BackupFile {
  name: string;
  bytes: string;
  sha256: string;
}
interface BackupEnvelope {
  format: "chagok-backup";
  version: 1;
  createdAt: string;
  database: BackupFile;
  receipts: BackupFile[];
}
export interface RestorePlan {
  directory: string;
  createdAt: string;
  transactions: number;
  expenses: number;
  receipts: number;
}
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const file = (name: string, bytes: Buffer): BackupFile => ({
  name,
  bytes: bytes.toString("base64"),
  sha256: hash(bytes),
});

export async function writeBackup(database: AppDatabase, storage: string, destination: string) {
  const parent = join(storage, "..", "backup-staging");
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, "create-"));
  let temporary: string | undefined;
  try {
    const snapshot = join(staging, "chagok.sqlite");
    database.writeBackup(snapshot);
    const bytes = await readFile(snapshot),
      inspection = new DatabaseSync(snapshot, { readOnly: true });
    let rows: Record<string, unknown>[];
    try {
      rows = inspection.prepare("SELECT stored_name,size,sha256 FROM receipts").all();
    } finally {
      inspection.close();
    }
    const receipts: BackupFile[] = [];
    let total = bytes.length;
    for (const row of rows) {
      const name = String(row.stored_name);
      if (!validReceiptName(name)) throw new Error("영수증 경로가 올바르지 않습니다.");
      const data = await readFile(join(storage, "receipts", name));
      total += data.length;
      if (total > MAX_BYTES * 0.7) throw new Error("백업 자료가 지원 크기를 초과했습니다.");
      if (data.length !== row.size || hash(data) !== row.sha256)
        throw new Error("영수증 파일이 누락되거나 손상되어 백업을 중단했습니다.");
      receipts.push(file(name, data));
    }
    const envelope: BackupEnvelope = {
      format: "chagok-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      database: file("chagok.sqlite", bytes),
      receipts,
    };
    const encoded = Buffer.from(JSON.stringify(envelope));
    if (encoded.length > MAX_BYTES) throw new Error("백업 자료가 지원 크기를 초과했습니다.");
    const target = extname(destination) ? destination : `${destination}.chagok`;
    if (extname(target).toLowerCase() !== ".chagok") throw new Error(".chagok 형식으로 저장해 주세요.");
    temporary = join(target, "..", `.chagok-backup-${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(gzipSync(encoded));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
    temporary = undefined;
    return { fileName: basename(target), createdAt: envelope.createdAt, receipts: receipts.length };
  } finally {
    if (temporary) await rm(temporary, { force: true }).catch(() => {});
    await rm(staging, { recursive: true, force: true });
  }
}
function decodeFile(input: unknown): { name: string; bytes: Buffer; sha256: string } {
  if (!input || typeof input !== "object") throw new Error("백업 파일 정보가 올바르지 않습니다.");
  const value = input as BackupFile;
  if (
    typeof value.name !== "string" ||
    typeof value.bytes !== "string" ||
    value.bytes.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/.test(value.bytes) ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  )
    throw new Error("백업 파일 정보가 올바르지 않습니다.");
  const bytes = Buffer.from(value.bytes, "base64");
  if (bytes.toString("base64") !== value.bytes || hash(bytes) !== value.sha256)
    throw new Error("백업 파일의 검사 값이 일치하지 않습니다.");
  return { ...value, bytes };
}
export async function prepareRestore(path: string, userData: string): Promise<RestorePlan> {
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_BYTES || extname(path).toLowerCase() !== ".chagok")
    throw new Error("정상적인 차곡 백업(.chagok)을 선택해 주세요.");
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(gunzipSync(await readFile(path), { maxOutputLength: MAX_BYTES }).toString("utf8"));
  } catch {
    throw new Error("백업을 읽을 수 없습니다. 파일이 손상되었는지 확인해 주세요.");
  }
  if (
    envelope?.format !== "chagok-backup" ||
    envelope.version !== 1 ||
    typeof envelope.createdAt !== "string" ||
    !Number.isFinite(Date.parse(envelope.createdAt)) ||
    !Array.isArray(envelope.receipts) ||
    envelope.receipts.length > 10000
  )
    throw new Error("지원하지 않는 백업 형식입니다.");
  const parent = join(userData, "backup-staging");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, "restore-"));
  try {
    const dbFile = decodeFile(envelope.database);
    if (dbFile.name !== "chagok.sqlite" || dbFile.bytes.subarray(0, 16).toString() !== "SQLite format 3\0")
      throw new Error("정상적인 SQLite 백업이 아닙니다.");
    const dbPath = join(directory, "chagok.sqlite");
    await writeFile(dbPath, dbFile.bytes, { flag: "wx" });
    const inspection = new DatabaseSync(dbPath, { readOnly: true });
    let receiptRows: Record<string, unknown>[], transactions: number, expenses: number;
    try {
      if (inspection.prepare("PRAGMA user_version").get()?.user_version !== 3)
        throw new Error("이 앱에서 복원할 수 없는 데이터 버전입니다.");
      const schema = inspection.prepare("SELECT name,type FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'").all();
      if (
        schema.some(row => !["table", "index"].includes(String(row.type))) ||
        TABLES.some(name => !schema.some(row => row.name === name && row.type === "table")) ||
        schema.filter(row => row.type === "table").length !== TABLES.length
      )
        throw new Error("백업의 데이터 구조가 올바르지 않습니다.");
      if (
        inspection.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" ||
        inspection.prepare("PRAGMA foreign_key_check").all().length
      )
        throw new Error("백업 데이터의 무결성 검사를 통과하지 못했습니다.");
      receiptRows = inspection.prepare("SELECT stored_name,size,sha256 FROM receipts").all();
      transactions = Number(inspection.prepare("SELECT count(*) AS count FROM bank_transactions").get()!.count);
      expenses = Number(inspection.prepare("SELECT count(*) AS count FROM expenses").get()!.count);
    } finally {
      inspection.close();
    }
    if (receiptRows.length !== envelope.receipts.length) throw new Error("백업의 영수증 수가 일치하지 않습니다.");
    await mkdir(join(directory, "receipts"));
    const seen = new Set<string>();
    for (const encoded of envelope.receipts) {
      const receipt = decodeFile(encoded);
      if (!validReceiptName(receipt.name) || seen.has(receipt.name))
        throw new Error("백업 영수증 이름이 올바르지 않습니다.");
      seen.add(receipt.name);
      const row = receiptRows.find(row => row.stored_name === receipt.name);
      if (
        !row ||
        row.sha256 !== receipt.sha256 ||
        row.size !== receipt.bytes.length ||
        receipt.bytes.length > 20 * 1024 * 1024
      )
        throw new Error("백업 영수증 검사에 실패했습니다.");
      await writeFile(join(directory, "receipts", receipt.name), receipt.bytes, { flag: "wx" });
    }
    // 일반 앱 조회와 같은 경로로 JSON·금액·설정을 검사합니다.
    const validation = new AppDatabase(directory);
    try {
      const months = new Set<string>();
      const sql = new DatabaseSync(dbPath, { readOnly: true });
      try {
        for (const row of sql
          .prepare(
            "SELECT substr(occurred_at,1,7) AS month FROM bank_transactions UNION SELECT month FROM expenses UNION SELECT month FROM classifications UNION SELECT month FROM settlement_snapshots",
          )
          .all())
          months.add(String(row.month));
      } finally {
        sql.close();
      }
      validation.loadWorkspacePreferences();
      for (const month of months) validation.ledger.workspace(month);
    } finally {
      validation.close();
    }
    return { directory, createdAt: envelope.createdAt, transactions, expenses, receipts: receiptRows.length };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
export async function discardRestore(plan: RestorePlan) {
  await rm(plan.directory, { recursive: true, force: true });
}

/** 현재 저장소를 삭제하지 않고 별도 폴더로 옮긴 뒤 검증한 저장소로 교체합니다. 실패하면 원위치로 되돌립니다. */
export async function installRestore(
  plan: RestorePlan,
  storage: string,
  close: () => void,
): Promise<{ database: AppDatabase; previousDirectory: string }> {
  const previousDirectory = join(storage, "..", `before-restore-${randomUUID()}`);
  // staging DB를 닫은 뒤 WAL이 남아 있지 않아야 합니다.
  const names = await readdir(plan.directory);
  if (names.some(name => name.endsWith("-wal") || name.endsWith("-shm")))
    throw new Error("복원할 저장소가 아직 사용 중입니다.");
  const journal = join(storage, "..", "restore-journal.json");
  const journalHandle = await open(journal, "wx", 0o600);
  try {
    await journalHandle.writeFile(JSON.stringify({ previous: basename(previousDirectory) }));
    await journalHandle.sync();
  } finally {
    await journalHandle.close();
  }
  close();
  let moved = false,
    installed = false;
  try {
    await rename(storage, previousDirectory);
    moved = true;
    await rename(plan.directory, storage);
    installed = true;
    const database = new AppDatabase(storage);
    await rm(journal, { force: true }).catch(() => {});
    return { database, previousDirectory };
  } catch (error) {
    if (installed) await rename(storage, plan.directory);
    if (moved) await rename(previousDirectory, storage);
    await rm(journal, { force: true });
    throw error;
  }
}

/** 교체 도중 앱이 종료되면 빈 장부를 생성하기 전에 기존 저장소부터 복구합니다. */
export async function recoverInterruptedRestore(userData: string) {
  const journal = join(userData, "restore-journal.json");
  let previous: string;
  try {
    const value = JSON.parse(await readFile(journal, "utf8"));
    if (typeof value.previous !== "string" || !/^before-restore-[0-9a-f-]{36}$/.test(value.previous))
      throw new Error("복원 복구 기록을 확인할 수 없습니다.");
    previous = value.previous;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const storage = join(userData, "storage");
  try {
    await stat(join(storage, "chagok.sqlite"));
    const validation = new AppDatabase(storage);
    validation.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await rename(join(userData, previous), storage);
  }
  await rm(journal);
}
