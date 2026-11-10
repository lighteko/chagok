import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect } from "@playwright/test";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const executableArgument = process.argv.slice(2).find(argument => argument.endsWith(".exe"));
const executablePath = executableArgument ? resolve(executableArgument) : undefined;
await mkdir("test-results", { recursive: true });
const args = [...(executablePath ? [] : ["."]), `--user-data-dir=${resolve("test-results/smoke-profile")}`];
const app = await electron.launch({ executablePath, args, env, timeout: 30_000 });
try {
  const window = await app.firstWindow();
  const errors = [];
  window.on("pageerror", error => errors.push(error.message));
  await window.getByRole("navigation", { name: "작업 메뉴" }).waitFor();
  await window.evaluate(() => localStorage.removeItem("chagok.workspace.v1"));
  await window.reload();
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
  console.log(
    "PASS: Direct workspace, month rollover, navigation, restored preferences, window sizing, IPC and sandbox",
  );
} finally {
  await app.close();
}
