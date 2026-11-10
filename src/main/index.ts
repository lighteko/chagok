import { app, BrowserWindow, ipcMain, session } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IPC_CHANNELS, type AppInfo } from "@/shared/desktop/contracts";

const rendererFile = join(__dirname, "../renderer/index.html");
let mainWindow: BrowserWindow | null = null;

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
        if (
          !mainWindow ||
          event.sender !== mainWindow.webContents ||
          event.senderFrame !== mainWindow.webContents.mainFrame ||
          !isTrustedUrl(event.senderFrame.url)
        ) {
          throw new Error("허용되지 않은 앱 요청입니다.");
        }
        return { name: "차곡", version: app.getVersion(), platform: process.platform };
      });
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch(error => {
      console.error("차곡을 시작할 수 없습니다.", error);
      app.exit(1);
    });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
