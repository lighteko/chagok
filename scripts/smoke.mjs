import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect } from "@playwright/test";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const executableArgument = process.argv.slice(2).find(argument => argument.endsWith(".exe"));
const executablePath = executableArgument ? resolve(executableArgument) : undefined;
const app = await electron.launch({ executablePath, args: executablePath ? [] : ["."], env, timeout: 30_000 });
try {
  const window = await app.firstWindow();
  const errors = [];
  window.on("pageerror", error => errors.push(error.message));
  await window.getByRole("heading", { name: /차곡차곡 모아서/ }).waitFor();
  await window.getByText("차곡 v0.1.0 · win32", { exact: true }).waitFor();
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
  await window.getByRole("button", { name: "다시 확인" }).click();
  await expect(window.getByRole("button", { name: "다시 확인" })).toBeEnabled();
  assert.deepEqual(errors, []);
  await mkdir("test-results", { recursive: true });
  await window.screenshot({ path: "test-results/chagok-start.png", fullPage: true });
  console.log("PASS: Electron launch, renderer, typed IPC, refresh, sandbox, Node isolation");
} finally {
  await app.close();
}
