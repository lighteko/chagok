import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type DesktopApi } from "@/shared/desktop/contracts";

const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
  getMcpStatus: () => ipcRenderer.invoke(IPC_CHANNELS.mcpStatus),
  setMcpEnabled: (enabled, allowClassification) =>
    ipcRenderer.invoke(IPC_CHANNELS.mcpSetEnabled, enabled, allowClassification),
  copyMcpToken: () => ipcRenderer.invoke(IPC_CHANNELS.mcpCopyToken),
  onMcpLedgerChanged: listener => {
    const notify = () => listener();
    ipcRenderer.on(IPC_CHANNELS.mcpLedgerChanged, notify);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.mcpLedgerChanged, notify);
  },
  getWorkspacePreferences: legacy => ipcRenderer.invoke(IPC_CHANNELS.preferencesGet, legacy),
  saveWorkspacePreferences: preferences => ipcRenderer.invoke(IPC_CHANNELS.preferencesSave, preferences),
  previewTransactionImport: () => ipcRenderer.invoke(IPC_CHANNELS.transactionsPreview),
  commitTransactionImport: request => ipcRenderer.invoke(IPC_CHANNELS.transactionsCommit, request),
  cancelTransactionImport: token => ipcRenderer.invoke(IPC_CHANNELS.transactionsCancel, token),
  listTransactions: query => ipcRenderer.invoke(IPC_CHANNELS.transactionsList, query),
  getTransaction: id => ipcRenderer.invoke(IPC_CHANNELS.transactionDetail, id),
  exportTransactions: month => ipcRenderer.invoke(IPC_CHANNELS.transactionsExport, month),
  getLedger: month => ipcRenderer.invoke(IPC_CHANNELS.ledgerGet, month),
  getLedgerAudit: (month, page) => ipcRenderer.invoke(IPC_CHANNELS.ledgerAudit, month, page),
  classifyTransaction: value => ipcRenderer.invoke(IPC_CHANNELS.ledgerClassify, value),
  bulkClassifyTransactions: value => ipcRenderer.invoke(IPC_CHANNELS.ledgerBulkClassify, value),
  saveExpense: value => ipcRenderer.invoke(IPC_CHANNELS.ledgerExpenseSave, value),
  deleteExpense: id => ipcRenderer.invoke(IPC_CHANNELS.ledgerExpenseDelete, id),
  savePaymentLink: value => ipcRenderer.invoke(IPC_CHANNELS.ledgerLink, value),
  saveCategory: value => ipcRenderer.invoke(IPC_CHANNELS.ledgerCategory, value),
  saveClassificationRule: value => ipcRenderer.invoke(IPC_CHANNELS.ledgerRuleSave, value),
  deleteClassificationRule: id => ipcRenderer.invoke(IPC_CHANNELS.ledgerRuleDelete, id),
  suggestClassificationRules: month => ipcRenderer.invoke(IPC_CHANNELS.ledgerRuleSuggest, month),
  saveSettlementSettings: (month, value) => ipcRenderer.invoke(IPC_CHANNELS.ledgerSettings, month, value),
  closePeriod: month => ipcRenderer.invoke(IPC_CHANNELS.ledgerClose, month),
  reopenPeriod: (month, reason) => ipcRenderer.invoke(IPC_CHANNELS.ledgerReopen, month, reason),
  listReceipts: id => ipcRenderer.invoke(IPC_CHANNELS.receiptsList, id),
  addReceipt: id => ipcRenderer.invoke(IPC_CHANNELS.receiptsAdd, id),
  openReceipt: id => ipcRenderer.invoke(IPC_CHANNELS.receiptsOpen, id),
  deleteReceipt: id => ipcRenderer.invoke(IPC_CHANNELS.receiptsDelete, id),
  createBackup: () => ipcRenderer.invoke(IPC_CHANNELS.backupCreate),
  restoreBackup: () => ipcRenderer.invoke(IPC_CHANNELS.backupRestore),
  exportSettlement: (month, id) => ipcRenderer.invoke(IPC_CHANNELS.settlementExport, month, id),
};

contextBridge.exposeInMainWorld("chagok", Object.freeze(api));
