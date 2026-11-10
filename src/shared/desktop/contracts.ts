export const IPC_CHANNELS = { appInfo: "app:info" } as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface DesktopApi {
  getAppInfo: () => Promise<AppInfo>;
}
