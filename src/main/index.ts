import { app, BrowserWindow, dialog, ipcMain, session, shell, type IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IPC_CHANNELS, type AppInfo } from "@/shared/desktop/contracts";
import { AppDatabase } from "./storage/database";
import { TransactionImportService } from "./imports/transactionImport";
import { saveTransactionExport } from "./exports/transactionExport";
import { ReceiptService } from "./receipts/receiptService";
import { id as validId } from "./storage/ledgerValidation";
import {
  writeBackup,
  prepareRestore,
  discardRestore,
  installRestore,
  recoverInterruptedRestore,
} from "./backups/backupService";
import { saveSettlementExport } from "./exports/settlementExport";
import appIcon from "../../build/icons/icon.png?asset";

const rendererFile = join(__dirname, "../renderer/index.html");
let mainWindow: BrowserWindow | null = null;
let database: AppDatabase | null = null;
let restoring = false;

function assertTrustedCaller(event: IpcMainInvokeEvent): void {
  if (restoring) throw new Error("백업 복원 중입니다. 잠시 후 다시 시도해 주세요.");
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
    icon: appIcon,
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
    .then(async () => {
      app.setAppUserModelId("com.lighteko.chagok");
      await recoverInterruptedRestore(app.getPath("userData"));
      database = new AppDatabase(join(app.getPath("userData"), "storage"));
      let imports = new TransactionImportService(database.transactions);
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
      ipcMain.handle(IPC_CHANNELS.transactionsExport, async (event, month: unknown) => {
        assertTrustedCaller(event);
        if (!database) throw new Error("저장소가 준비되지 않았습니다.");
        const snapshot = database.transactions.exportMonth(month);
        const selected = await dialog.showSaveDialog(mainWindow!, {
          title: "월별 거래내역 엑셀 내보내기",
          defaultPath: join(app.getPath("documents"), `차곡_거래내역_${snapshot.month}.xlsx`),
          filters: [{ name: "엑셀 통합 문서", extensions: ["xlsx"] }],
          properties: ["showOverwriteConfirmation"],
        });
        if (selected.canceled || !selected.filePath) return null;
        assertTrustedCaller(event);
        return saveTransactionExport(snapshot, selected.filePath);
      });
      const ledgerHandlers: [string, (...args: unknown[]) => unknown][] = [
        [IPC_CHANNELS.ledgerGet, month => database!.ledger.workspace(month)],
        [IPC_CHANNELS.ledgerAudit, (month, page) => database!.ledger.auditPage(month, page)],
        [IPC_CHANNELS.ledgerClassify, value => database!.ledger.classify(value)],
        [IPC_CHANNELS.ledgerBulkClassify, value => database!.ledger.bulkClassify(value)],
        [IPC_CHANNELS.ledgerExpenseSave, value => database!.ledger.saveExpense(value)],
        [IPC_CHANNELS.ledgerExpenseDelete, value => database!.ledger.deleteExpense(value)],
        [IPC_CHANNELS.ledgerLink, value => database!.ledger.saveLink(value)],
        [IPC_CHANNELS.ledgerCategory, value => database!.ledger.saveCategory(value)],
        [IPC_CHANNELS.ledgerRuleSave, value => database!.ledger.saveRule(value)],
        [IPC_CHANNELS.ledgerRuleDelete, value => database!.ledger.deleteRule(value)],
        [IPC_CHANNELS.ledgerRuleSuggest, value => database!.ledger.suggestRules(value)],
        [IPC_CHANNELS.ledgerSettings, (month, value) => database!.ledger.saveSettings(month, value)],
        [IPC_CHANNELS.ledgerClose, month => database!.ledger.closePeriod(month)],
        [IPC_CHANNELS.ledgerReopen, (month, reason) => database!.ledger.reopenPeriod(month, reason)],
      ];
      for (const [channel, handler] of ledgerHandlers)
        ipcMain.handle(channel, (event, ...args: unknown[]) => {
          assertTrustedCaller(event);
          if (!database) throw new Error("저장소가 준비되지 않았습니다.");
          return handler(...args);
        });
      const receipts = () => new ReceiptService(join(app.getPath("userData"), "storage", "receipts"), database!.ledger);
      ipcMain.handle(IPC_CHANNELS.receiptsList, (event, id: unknown) => {
        assertTrustedCaller(event);
        return database!.ledger.receipts(id);
      });
      ipcMain.handle(IPC_CHANNELS.receiptsAdd, async (event, input: unknown) => {
        assertTrustedCaller(event);
        const id = validId(input);
        database!.ledger.assertExpenseOpen(id);
        const selected = await dialog.showOpenDialog(mainWindow!, {
          title: "영수증 첨부",
          properties: ["openFile"],
          filters: [{ name: "영수증 이미지·PDF", extensions: ["png", "jpg", "jpeg", "webp", "pdf"] }],
        });
        if (selected.canceled || !selected.filePaths[0]) return null;
        assertTrustedCaller(event);
        return receipts().add(id, selected.filePaths[0]);
      });
      ipcMain.handle(IPC_CHANNELS.receiptsOpen, async (event, input: unknown) => {
        assertTrustedCaller(event);
        const path = await receipts().path(validId(input));
        assertTrustedCaller(event);
        const error = await shell.openPath(path);
        if (error) throw new Error("기본 앱으로 영수증을 열지 못했습니다.");
      });
      ipcMain.handle(IPC_CHANNELS.receiptsDelete, async (event, input: unknown) => {
        assertTrustedCaller(event);
        await receipts().remove(validId(input));
      });
      ipcMain.handle(IPC_CHANNELS.backupCreate, async event => {
        assertTrustedCaller(event);
        const selected = await dialog.showSaveDialog(mainWindow!, {
          title: "차곡 전체 백업",
          defaultPath: join(app.getPath("documents"), `차곡_백업_${new Date().toISOString().slice(0, 10)}.chagok`),
          filters: [{ name: "차곡 전체 백업", extensions: ["chagok"] }],
          properties: ["showOverwriteConfirmation"],
        });
        if (selected.canceled || !selected.filePath) return null;
        assertTrustedCaller(event);
        return writeBackup(database!, join(app.getPath("userData"), "storage"), selected.filePath);
      });
      ipcMain.handle(IPC_CHANNELS.settlementExport, async (event, month: unknown, inputId: unknown) => {
        assertTrustedCaller(event);
        const workspace = database!.ledger.workspace(month);
        const snapshot =
          inputId === undefined ? undefined : workspace.snapshots.find(row => row.id === validId(inputId));
        if (inputId !== undefined && !snapshot) throw new Error("마감본을 찾을 수 없습니다.");
        const report = snapshot?.report ?? workspace.report;
        if (!report.entries.length) throw new Error("출력할 정산 자료가 없습니다.");
        const selected = await dialog.showSaveDialog(mainWindow!, {
          title: "기존 정산표 양식으로 내보내기",
          defaultPath: join(
            app.getPath("documents"),
            `차곡_정산표_${report.month}${snapshot || workspace.closed ? "_마감" : "_잠정"}.xlsx`,
          ),
          filters: [{ name: "엑셀 정산표", extensions: ["xlsx"] }],
          properties: ["showOverwriteConfirmation"],
        });
        if (selected.canceled || !selected.filePath) return null;
        assertTrustedCaller(event);
        return saveSettlementExport(report, Boolean(snapshot) || workspace.closed, selected.filePath);
      });
      ipcMain.handle(IPC_CHANNELS.backupRestore, async event => {
        assertTrustedCaller(event);
        const selected = await dialog.showOpenDialog(mainWindow!, {
          title: "차곡 백업 복원",
          filters: [{ name: "차곡 전체 백업", extensions: ["chagok"] }],
          properties: ["openFile"],
        });
        if (selected.canceled || !selected.filePaths[0]) return null;
        assertTrustedCaller(event);
        const plan = await prepareRestore(selected.filePaths[0], app.getPath("userData"));
        try {
          assertTrustedCaller(event);
          const confirmation = await dialog.showMessageBox(mainWindow!, {
            type: "warning",
            title: "백업 복원 확인",
            message: "선택한 백업으로 현재 장부를 교체할까요?",
            detail: `백업 시각: ${new Date(plan.createdAt).toLocaleString()}\n거래 ${plan.transactions}건 · 별도 지출 ${plan.expenses}건 · 영수증 ${plan.receipts}개\n현재 장부는 복원 전 보관본으로 PC에 남깁니다.`,
            buttons: ["취소", "검증한 백업으로 복원"],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          });
          if (confirmation.response !== 1) return null;
          assertTrustedCaller(event);
          restoring = true;
          const storage = join(app.getPath("userData"), "storage");
          try {
            const result = await installRestore(plan, storage, () => {
              database!.close();
              database = null;
            });
            database = result.database;
            imports = new TransactionImportService(database.transactions);
          } catch (error) {
            if (!database) {
              database = new AppDatabase(storage);
              imports = new TransactionImportService(database.transactions);
            }
            throw error;
          } finally {
            restoring = false;
          }
          mainWindow!.webContents.reload();
          return {
            createdAt: plan.createdAt,
            transactions: plan.transactions,
            expenses: plan.expenses,
            receipts: plan.receipts,
          };
        } finally {
          await discardRestore(plan);
        }
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
