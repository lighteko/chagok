import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type DesktopApi } from "@/shared/desktop/contracts";

const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
};

contextBridge.exposeInMainWorld("chagok", Object.freeze(api));
