import type { AppUpdater } from "electron-updater";
import type { AppUpdateStatus } from "@/shared/desktop/contracts";

const STARTUP_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class AppUpdates {
  private status: AppUpdateStatus;
  private startupTimer?: NodeJS.Timeout;
  private intervalTimer?: NodeJS.Timeout;

  constructor(
    private readonly updater: AppUpdater | null,
    private readonly notify: (status: AppUpdateStatus) => void,
  ) {
    this.status = { phase: updater ? "idle" : "unsupported" };
    if (!updater) return;

    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.disableWebInstaller = true;
    updater.on("download-progress", ({ percent }) => {
      if (this.status.phase !== "downloading" || !Number.isFinite(percent)) return;
      const wholePercent = Math.min(100, Math.max(0, Math.floor(percent)));
      if (wholePercent !== this.status.percent) this.setStatus({ ...this.status, percent: wholePercent });
    });
    updater.on("error", () => {
      if (this.status.phase === "installing") this.installFailed();
    });
  }

  getStatus(): AppUpdateStatus {
    return this.status;
  }

  start(): void {
    if (!this.updater) return;
    this.startupTimer = setTimeout(() => void this.check(), STARTUP_DELAY_MS);
    this.intervalTimer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    clearTimeout(this.startupTimer);
    clearInterval(this.intervalTimer);
  }

  async check(): Promise<void> {
    if (!this.updater || !["idle", "current", "error"].includes(this.status.phase)) return;
    clearTimeout(this.startupTimer);
    this.setStatus({ phase: "checking" });
    let failureMessage = "새 버전을 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
    try {
      const result = await this.updater.checkForUpdates();
      if (!result) throw new Error("Update check returned no result");
      if (!result.isUpdateAvailable) {
        this.setStatus({ phase: "current" });
        return;
      }
      const { version } = result.updateInfo;
      failureMessage = "업데이트 파일을 내려받지 못했습니다. 다시 시도해 주세요.";
      this.setStatus({ phase: "downloading", version, percent: 0 });
      await this.updater.downloadUpdate();
      this.setStatus({ phase: "ready", version });
    } catch {
      this.setStatus({ phase: "error", message: failureMessage });
    }
  }

  install(): void {
    if (!this.updater || this.status.phase !== "ready") return;
    this.setStatus({ phase: "installing", version: this.status.version });
    try {
      this.updater.quitAndInstall(false, true);
    } catch {
      this.installFailed();
    }
  }

  private installFailed(): void {
    this.setStatus({ phase: "error", message: "업데이트 설치를 시작하지 못했습니다. 다시 시도해 주세요." });
  }

  private setStatus(status: AppUpdateStatus): void {
    this.status = status;
    this.notify(status);
  }
}
