import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type DesktopApi } from "@/shared/desktop/contracts";

const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
  getWorkspacePreferences: legacy => ipcRenderer.invoke(IPC_CHANNELS.preferencesGet, legacy),
  saveWorkspacePreferences: preferences => ipcRenderer.invoke(IPC_CHANNELS.preferencesSave, preferences),
};

contextBridge.exposeInMainWorld("chagok", Object.freeze(api));
