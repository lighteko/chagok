import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type DesktopApi } from "@/shared/desktop/contracts";

const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
  getWorkspacePreferences: legacy => ipcRenderer.invoke(IPC_CHANNELS.preferencesGet, legacy),
  saveWorkspacePreferences: preferences => ipcRenderer.invoke(IPC_CHANNELS.preferencesSave, preferences),
  previewTransactionImport: () => ipcRenderer.invoke(IPC_CHANNELS.transactionsPreview),
  commitTransactionImport: request => ipcRenderer.invoke(IPC_CHANNELS.transactionsCommit, request),
  cancelTransactionImport: token => ipcRenderer.invoke(IPC_CHANNELS.transactionsCancel, token),
  listTransactions: query => ipcRenderer.invoke(IPC_CHANNELS.transactionsList, query),
  getTransaction: id => ipcRenderer.invoke(IPC_CHANNELS.transactionDetail, id),
};

contextBridge.exposeInMainWorld("chagok", Object.freeze(api));
