import { shell } from "electron";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { strToU8, zipSync } from "fflate";
import bridgeAsset from "./claudeBridge.mjs?asset";

const run = promisify(execFile);
const entryPoint = "server/index.mjs";

function writePrivateFile(path: string, contents: string | Uint8Array) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, contents, { mode: 0o600, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

async function findWindowsClaudeDesktop() {
  const { SystemRoot, LOCALAPPDATA } = process.env;
  if (SystemRoot) {
    try {
      const { stdout } = await run(
        join(SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-AppxPackage -Name Claude | Where-Object PackageFamilyName -eq 'Claude_pzs8sxrjxfjjc' | Select-Object -First 1 -ExpandProperty InstallLocation",
        ],
        { windowsHide: true, timeout: 5000 },
      );
      const installLocation = stdout.trim();
      if (installLocation) return join(installLocation, "app", "claude.exe");
    } catch {
      // Older Claude Desktop installers can be found under LocalAppData.
    }
  }
  if (LOCALAPPDATA) {
    return [
      join(LOCALAPPDATA, "AnthropicClaude", "claude.exe"),
      join(LOCALAPPDATA, "Programs", "Claude", "Claude.exe"),
    ].find(existsSync);
  }
}

export class ClaudeDesktop {
  constructor(private readonly directory: () => string) {}

  private bundlePath() {
    return join(this.directory(), "chagok.mcpb");
  }

  private connectionPath() {
    return join(this.directory(), "connection.json");
  }

  isPrepared() {
    return existsSync(this.bundlePath());
  }

  prepare(version: string) {
    mkdirSync(this.directory(), { recursive: true, mode: 0o700 });
    const manifest = {
      manifest_version: "0.3",
      name: "chagok",
      display_name: "차곡",
      version,
      description: "Read your local Chagok ledger and classify transactions when you grant permission in Chagok.",
      author: { name: "lighteko" },
      server: {
        type: "node",
        entry_point: entryPoint,
        mcp_config: { command: "node", args: ["${__dirname}/" + entryPoint] },
      },
      tools_generated: true,
      compatibility: { platforms: ["win32", "darwin"], runtimes: { node: ">=20.0.0" } },
    };
    writePrivateFile(
      this.bundlePath(),
      zipSync({
        "manifest.json": strToU8(JSON.stringify(manifest)),
        [entryPoint]: readFileSync(bridgeAsset),
        "server/config.json": strToU8(JSON.stringify({ connectionFile: this.connectionPath(), version })),
      }),
    );
  }

  publish(port: number, token: string) {
    if (this.isPrepared()) writePrivateFile(this.connectionPath(), JSON.stringify({ port, token }));
  }

  disconnect() {
    try {
      rmSync(this.connectionPath(), { force: true });
    } catch {
      // Stopping the server revokes the credential even if Windows has the file open.
      console.warn("Claude Desktop 연결 파일을 정리하지 못했습니다.");
    }
  }

  async open(): Promise<boolean> {
    const path = this.bundlePath();
    if (process.platform === "win32") {
      const executable = await findWindowsClaudeDesktop();
      if (executable) {
        try {
          const child = spawn(executable, [path], { detached: true, stdio: "ignore", windowsHide: true });
          await once(child, "spawn");
          child.unref();
          return true;
        } catch {
          // Some Windows installs do not expose their app executable to other apps.
        }
      }
    } else if (!(await shell.openPath(path))) {
      return true;
    }
    this.reveal();
    return false;
  }

  reveal() {
    shell.showItemInFolder(this.bundlePath());
  }
}
