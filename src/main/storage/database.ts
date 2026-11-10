import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrateTransactions, TransactionRepository } from "./transactions";
import {
  defaultWorkspacePreferences,
  isWorkspacePreferences,
  type WorkspacePreferences,
} from "@/shared/desktop/preferences";

const SCHEMA_VERSION = 2;

export class AppDatabase {
  private readonly database: DatabaseSync;
  readonly transactions: TransactionRepository;

  constructor(directory: string) {
    mkdirSync(directory, { recursive: true });
    this.database = new DatabaseSync(join(directory, "chagok.sqlite"));
    try {
      this.database.exec(
        "PRAGMA busy_timeout = 1000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;",
      );
      const version = this.database.prepare("PRAGMA user_version").get()?.user_version;
      if (typeof version !== "number" || version > SCHEMA_VERSION) {
        throw new Error("이 앱 버전에서 지원하지 않는 데이터 형식입니다.");
      }
      if (version === 0) this.migrate();
      if (version < 2) migrateTransactions(this.database);
      this.transactions = new TransactionRepository(this.database);
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  private migrate(): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec(`
        CREATE TABLE workspace_preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          view TEXT NOT NULL CHECK (view IN ('transactions', 'expenses', 'settlement')),
          month TEXT NOT NULL CHECK (
            month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
            AND month BETWEEN '1900-01' AND '2100-12'
            AND substr(month, 6, 2) BETWEEN '01' AND '12'
          )
        ) STRICT;
        PRAGMA user_version = 1;
      `);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /** 기존 DB 값이 우선이며, legacy 값은 첫 저장 때만 사용합니다. */
  loadWorkspacePreferences(legacy?: unknown): WorkspacePreferences {
    const row = this.database.prepare("SELECT view, month FROM workspace_preferences WHERE id = 1").get();
    if (row) {
      if (!isWorkspacePreferences(row)) throw new Error("저장된 작업 설정을 확인할 수 없습니다.");
      return { view: row.view, month: row.month };
    }
    return this.saveWorkspacePreferences(isWorkspacePreferences(legacy) ? legacy : defaultWorkspacePreferences());
  }

  saveWorkspacePreferences(value: unknown): WorkspacePreferences {
    if (!isWorkspacePreferences(value)) throw new Error("올바르지 않은 작업 설정입니다.");
    this.database
      .prepare(
        `
      INSERT INTO workspace_preferences (id, view, month) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET view = excluded.view, month = excluded.month
    `,
      )
      .run(value.view, value.month);
    return { view: value.view, month: value.month };
  }

  close(): void {
    this.database.close();
  }
}
