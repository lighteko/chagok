import type { WorkspacePreferences } from "@/shared/desktop/preferences";

export function getWorkspacePreferences(legacy?: WorkspacePreferences) {
  return window.chagok.getWorkspacePreferences(legacy);
}

export function saveWorkspacePreferences(preferences: WorkspacePreferences) {
  return window.chagok.saveWorkspacePreferences(preferences);
}
