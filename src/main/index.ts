import { app, BrowserWindow, dialog, ipcMain, session, type IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IPC_CHANNELS, type AppInfo } from "@/shared/desktop/contracts";
import { AppDatabase } from "./storage/database";
import { TransactionImportService } from "./imports/transactionImport";

const rendererFile = join(__dirname, "../renderer/index.html");
let mainWindow: BrowserWindow | null = null;
let database: AppDatabase | null = null;

function assertTrustedCaller(event: IpcMainInvokeEvent): void {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame ||
    !isTrustedUrl(event.senderFrame.url)
  ) {
    throw new Error("허용되지 않은 앱 요청입니다.");
  }
}

function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (process.env.ELECTRON_RENDERER_URL && !app.isPackaged) {
      return parsed.origin === new URL(process.env.ELECTRON_RENDERER_URL).origin;
    }
    return parsed.protocol === "file:" && fileURLToPath(parsed) === rendererFile;
  } catch {
    return false;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: "차곡",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });
  const window = mainWindow;
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    mainWindow = null;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL && !app.isPackaged) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(rendererFile);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });
  app
    .whenReady()
    .then(() => {
      app.setAppUserModelId("com.lighteko.chagok");
      database = new AppDatabase(join(app.getPath("userData"), "storage"));
      const imports = new TransactionImportService(database.transactions);
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const development = Boolean(process.env.ELECTRON_RENDERER_URL) && !app.isPackaged;
        const connect = development ? "'self' http://127.0.0.1:5173 ws://127.0.0.1:5173" : "'self'";
        const scripts = development ? "'self' 'unsafe-inline'" : "'self'";
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${connect}; object-src 'none'; base-uri 'none'; frame-src 'none'`,
            ],
          },
        });
      });
      ipcMain.handle(IPC_CHANNELS.appInfo, (event): AppInfo => {
        assertTrustedCaller(event);
        return { name: "차곡", version: app.getVersion(), platform: process.platform };
      });
      ipcMain.handle(IPC_CHANNELS.preferencesGet, (event, legacy: unknown) => {
        assertTrustedCaller(event);
        if (!database) throw new Error("저장소가 준비되지 않았습니다.");
        return database.loadWorkspacePreferences(legacy);
      });
      ipcMain.handle(IPC_CHANNELS.preferencesSave, (event, preferences: unknown) => {
        assertTrustedCaller(event);
        if (!database) throw new Error("저장소가 준비되지 않았습니다.");
        return database.saveWorkspacePreferences(preferences);
      });
      ipcMain.handle(IPC_CHANNELS.transactionsPreview, async event => {
        assertTrustedCaller(event);
        const selected = await dialog.showOpenDialog(mainWindow!, {
          title: "거래내역 가져오기",
          properties: ["openFile"],
          filters: [{ name: "엑셀 거래내역", extensions: ["xlsx"] }],
        });
        if (selected.canceled || !selected.filePaths[0]) return null;
        assertTrustedCaller(event);
        return imports.preview(selected.filePaths[0]);
      });
      ipcMain.handle(IPC_CHANNELS.transactionsCommit, (event, request: unknown) => {
        assertTrustedCaller(event);
        return imports.commit(request);
      });
      ipcMain.handle(IPC_CHANNELS.transactionsCancel, (event, token: unknown) => {
        assertTrustedCaller(event);
        imports.cancel(token);
      });
      ipcMain.handle(IPC_CHANNELS.transactionsList, (event, query: unknown) => {
        assertTrustedCaller(event);
        if (!database) throw new Error("저장소가 준비되지 않았습니다.");
        return database.transactions.list(query);
      });
      ipcMain.handle(IPC_CHANNELS.transactionDetail, (event, id: unknown) => {
        assertTrustedCaller(event);
        if (!database) throw new Error("저장소가 준비되지 않았습니다.");
        return database.transactions.detail(id);
      });
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch(error => {
      console.error("차곡을 시작할 수 없습니다.", error);
      dialog.showErrorBox(
        "차곡을 시작할 수 없습니다",
        "저장된 데이터를 열지 못했습니다. 기존 데이터 파일은 보존됩니다. 앱을 다시 실행해 주세요.",
      );
      app.exit(1);
    });
  app.on("will-quit", () => {
    database?.close();
    database = null;
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
