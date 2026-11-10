import type { WorkspacePreferences } from "@/shared/desktop/preferences";

export const IPC_CHANNELS = {
  appInfo: "app:info",
  preferencesGet: "preferences:get",
  preferencesSave: "preferences:save",
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface DesktopApi {
  getAppInfo: () => Promise<AppInfo>;
  getWorkspacePreferences: (legacy?: WorkspacePreferences) => Promise<WorkspacePreferences>;
  saveWorkspacePreferences: (preferences: WorkspacePreferences) => Promise<WorkspacePreferences>;
}
