import { currentMonth, isValidMonth } from "@/shared/utils/month";

export type WorkspaceView = "transactions" | "expenses" | "settlement";

export interface WorkspacePreferences {
  view: WorkspaceView;
  month: string;
}

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return value === "transactions" || value === "expenses" || value === "settlement";
}

export function isWorkspacePreferences(value: unknown): value is WorkspacePreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WorkspacePreferences>;
  return Object.keys(value).length === 2 && isWorkspaceView(candidate.view) && isValidMonth(candidate.month);
}

export function defaultWorkspacePreferences(): WorkspacePreferences {
  return { view: "transactions", month: currentMonth() };
}
