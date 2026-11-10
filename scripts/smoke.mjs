import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { _electron as electron, expect } from "@playwright/test";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const executableArgument = process.argv.slice(2).find(argument => argument.endsWith(".exe"));
const executablePath = executableArgument ? resolve(executableArgument) : undefined;
await mkdir("test-results", { recursive: true });
const profile = await mkdtemp(resolve("test-results/smoke-"));
const args = [...(executablePath ? [] : ["."]), `--user-data-dir=${profile}`];
const launch = () => electron.launch({ executablePath, args, env, timeout: 30_000 });
let app = await launch();
let inspection;
try {
  const window = await app.firstWindow();
  const errors = [];
  window.on("pageerror", error => errors.push(error.message));
  await window.getByRole("navigation", { name: "작업 메뉴" }).waitFor();
  await expect(window.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  await expect(window.getByRole("heading", { name: "앱 연결 상태" })).toHaveCount(0);
  await expect(window.getByText("차곡차곡 모아서,", { exact: false })).toHaveCount(0);
  await expect(window.getByText("v0.1.0", { exact: true })).toBeVisible();
  const info = await window.evaluate(() => window.chagok.getAppInfo());
  assert.equal(info.name, "차곡");
  assert.equal(info.version, "0.1.0");
  assert.deepEqual(await window.evaluate(() => ({ node: typeof window.require, process: typeof window.process })), {
    node: "undefined",
    process: "undefined",
  });
  const security = await app.evaluate(({ BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      contextIsolation: preferences.contextIsolation,
      nodeIntegration: preferences.nodeIntegration,
      sandbox: preferences.sandbox,
    };
  });
  assert.deepEqual(security, { contextIsolation: true, nodeIntegration: false, sandbox: true });
  const userData = await app.evaluate(({ app }) => app.getPath("userData"));
  assert.equal(resolve(userData), profile, "Smoke test must not access the real user profile");
  const databasePath = join(profile, "storage", "chagok.sqlite");
  assert.equal((await readFile(databasePath)).subarray(0, 16).toString(), "SQLite format 3\0");
  inspection = new DatabaseSync(databasePath);
  const storedPreferences = () => ({
    ...inspection.prepare("SELECT view, month FROM workspace_preferences WHERE id = 1").get(),
  });
  assert.equal(inspection.prepare("PRAGMA user_version").get().user_version, 1);
  assert.equal(inspection.prepare("PRAGMA journal_mode").get().journal_mode, "wal");

  // Simulate an existing user upgrading from the localStorage version.
  await window.evaluate(() =>
    localStorage.setItem("chagok.workspace.v1", JSON.stringify({ view: "expenses", month: "2026-09" })),
  );
  inspection.exec("DELETE FROM workspace_preferences");
  await window.reload();
  await expect(window.getByRole("heading", { name: "별도 지출", exact: true }).first()).toBeVisible();
  await expect(window.getByLabel("정산월", { exact: true })).toHaveValue("2026-09");
  assert.deepEqual(storedPreferences(), { view: "expenses", month: "2026-09" });
  assert.equal(await window.evaluate(() => localStorage.getItem("chagok.workspace.v1")), null);
  assert.deepEqual(
    await window.evaluate(() => window.chagok.getWorkspacePreferences({ view: "transactions", month: "2020-01" })),
    { view: "expenses", month: "2026-09" },
  );
  assert.equal(
    await window.evaluate(async () => {
      try {
        await window.chagok.saveWorkspacePreferences({ view: "transactions", month: "2026-13" });
        return false;
      } catch {
        return true;
      }
    }),
    true,
  );
  assert.deepEqual(storedPreferences(), { view: "expenses", month: "2026-09" });

  // Force a real SQLite write failure, then confirm the UI can retry safely.
  inspection.exec(
    "CREATE TRIGGER smoke_reject_save BEFORE UPDATE ON workspace_preferences BEGIN SELECT RAISE(ABORT, 'smoke write failure'); END;",
  );
  await window.getByLabel("정산월", { exact: true }).fill("2026-10");
  await expect(window.getByRole("alert")).toContainText("화면 설정을 저장하지 못했습니다");
  assert.equal(storedPreferences().month, "2026-09");
  inspection.exec("DROP TRIGGER smoke_reject_save");
  await window.getByRole("button", { name: "다시 저장" }).click();
  await expect.poll(() => storedPreferences().month).toBe("2026-10");
  await expect(window.getByRole("alert")).toHaveCount(0);
  await window.getByRole("navigation", { name: "작업 메뉴" }).getByRole("button", { name: "거래내역" }).click();
  const month = window.getByLabel("정산월", { exact: true });
  await month.fill("2026-12");
  await window.getByRole("button", { name: "다음 달" }).click();
  await expect(month).toHaveValue("2027-01");
  await expect(window.getByText("2027.01.01 – 2027.01.31", { exact: true })).toBeVisible();
  await window.getByRole("button", { name: "이전 달" }).click();
  await expect(month).toHaveValue("2026-12");
  await month.fill("2026-09");
  const navigation = window.getByRole("navigation", { name: "작업 메뉴" });
  await navigation.getByRole("button", { name: "별도 지출" }).click();
  await expect(window.getByRole("heading", { name: "별도 지출", exact: true }).first()).toBeVisible();
  await window.reload();
  await expect(window.getByRole("heading", { name: "별도 지출", exact: true }).first()).toBeVisible();
  await expect(month).toHaveValue("2026-09");
  await navigation.getByRole("button", { name: "월별 정산" }).click();
  await expect(window.getByRole("heading", { name: "정산할 내역이 없습니다" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "월별 정산" })).toHaveAttribute("aria-current", "page");
  await window.screenshot({ path: "test-results/chagok-settlement.png", fullPage: true, animations: "disabled" });
  await navigation.getByRole("button", { name: "거래내역" }).click();
  await expect(window.getByRole("table")).toBeVisible();
  await expect(window.getByRole("button", { name: "파일 가져오기", exact: true })).toBeDisabled();
  await expect(navigation.getByRole("button", { name: "거래내역" })).toHaveAttribute("aria-current", "page");
  await window.screenshot({ path: "test-results/chagok-workspace.png", fullPage: true, animations: "disabled" });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 640));
  await expect(window.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  assert.equal(await window.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await window.screenshot({ path: "test-results/chagok-workspace-small.png", fullPage: true, animations: "disabled" });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1240, 820));
  assert.deepEqual(errors, []);
  await expect.poll(storedPreferences).toEqual({ view: "transactions", month: "2026-09" });
  inspection.close();
  inspection = undefined;
  await app.close();
  app = undefined;
  app = await launch();
  const restarted = await app.firstWindow();
  restarted.on("pageerror", error => errors.push(error.message));
  await expect(restarted.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  await expect(restarted.getByLabel("정산월", { exact: true })).toHaveValue("2026-09");
  assert.equal(await restarted.evaluate(() => localStorage.getItem("chagok.workspace.v1")), null);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: SQLite persistence, legacy migration, validation, write failure and retry, full restart, workspace, IPC and sandbox",
  );
} finally {
  inspection?.close();
  await app?.close();
}
