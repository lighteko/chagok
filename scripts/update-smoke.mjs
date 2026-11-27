import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { _electron as electron, expect } from "@playwright/test";

const executable = process.argv.slice(2).find(argument => argument.endsWith(".exe"));
assert(executable, "Pass a packaged Chagok executable to the update smoke test");
await mkdir("test-results", { recursive: true });
const profile = await mkdtemp(resolve("test-results/update-"));
const fixtureCache = join(profile, "cache");
await mkdir(fixtureCache);

const version = "99.0.0";
const installer = Buffer.from("synthetic Chagok installer data");
const corrupt = Buffer.from(installer).fill(0, 0, 1);
const hash = createHash("sha512").update(installer).digest("base64");
const file = "chagok-test-setup.exe";
const manifest = `version: ${version}\nfiles:\n  - url: ${file}\n    sha512: ${hash}\n    size: ${installer.length}\npath: ${file}\nsha512: ${hash}\n`;
let transmit = corrupt;
let downloads = 0;
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname === "/latest.yml") {
    response.writeHead(200, { "Content-Type": "text/yaml" }).end(manifest);
  } else if (pathname === `/${file}`) {
    downloads++;
    response.writeHead(200, { "Content-Length": transmit.length }).end(transmit);
  } else {
    response.writeHead(404).end();
  }
});
await once(server.listen(0, "127.0.0.1"), "listening");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
let app;
try {
  app = await electron.launch({ executablePath: resolve(executable), args: [`--user-data-dir=${profile}`], env });
  const window = await app.firstWindow();
  assert.equal(resolve(await app.evaluate(({ app }) => app.getPath("userData"))), profile);
  const fixtureUrl = `http://127.0.0.1:${server.address().port}/`;
  const usePublicFeed = process.argv.includes("--verify-current-release");
  await app.evaluate(({ app }, cache) => {
    const appRequire = process.getBuiltinModule("node:module").createRequire(`${app.getAppPath()}/package.json`);
    const updater = appRequire("electron-updater").autoUpdater;
    Object.defineProperty(updater.app, "baseCachePath", { value: cache });
    if (!updater.autoInstallOnAppQuit) throw new Error("Expected the app to enable installation on quit");
    updater.autoInstallOnAppQuit = false;
    updater.disableDifferentialDownload = true;
    updater.quitAndInstall = (...args) => {
      globalThis.updateInstallArgs = args;
    };
  }, fixtureCache);

  await window.getByRole("button", { name: "업데이트", exact: true }).click();
  const dialog = window.getByRole("dialog", { name: "차곡 업데이트" });
  const check = dialog.getByRole("button", { name: "업데이트 확인" });
  if (usePublicFeed) {
    await check.click();
    await expect(dialog.getByText("최신 버전입니다.")).toBeVisible({ timeout: 15000 });
  }
  await app.evaluate(({ app }, url) => {
    const appRequire = process.getBuiltinModule("node:module").createRequire(`${app.getAppPath()}/package.json`);
    appRequire("electron-updater").autoUpdater.setFeedURL({ provider: "generic", url });
  }, fixtureUrl);
  if (usePublicFeed) await check.click();
  await expect(dialog.getByRole("alert")).toContainText("내려받지 못했습니다", { timeout: 20000 });
  assert.equal(downloads, 1, "The updater should reject the corrupted installer");
  await expect(dialog.getByRole("button", { name: "재시작 및 설치" })).toHaveCount(0);

  transmit = installer;
  await check.click();
  await expect(dialog.getByText(`${version} 업데이트를 받았습니다.`, { exact: false })).toBeVisible();
  assert.equal(downloads, 2);
  await expect(window.getByText("새 버전", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "재시작 및 설치" }).click();
  await expect.poll(() => app.evaluate(() => globalThis.updateInstallArgs)).toEqual([false, true]);
  console.log(
    "Update smoke passed: background check, corrupt download rejection, download retry, and restart request.",
  );
} finally {
  try {
    await app?.close();
  } finally {
    server.closeAllConnections();
    await new Promise(resolveClose => server.close(resolveClose));
  }
}
