import { useEffect, useState } from "react";
import { currentMonth, isValidMonth } from "@/shared/utils/month";

export type WorkspaceView = "transactions" | "expenses" | "settlement";
interface WorkspacePreferences {
  view: WorkspaceView;
  month: string;
}
const STORAGE_KEY = "chagok.workspace.v1";

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return value === "transactions" || value === "expenses" || value === "settlement";
}

function readPreferences(): WorkspacePreferences {
  const fallback: WorkspacePreferences = { view: "transactions", month: currentMonth() };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return fallback;
    const candidate = saved as Partial<WorkspacePreferences>;
    return {
      view: isWorkspaceView(candidate.view) ? candidate.view : fallback.view,
      month: isValidMonth(candidate.month) ? candidate.month : fallback.month,
    };
  } catch {
    return fallback;
  }
}

export function useWorkspaceState() {
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      console.warn("작업 화면 설정을 저장하지 못했습니다.");
    }
  }, [preferences]);
  return {
    ...preferences,
    setView: (view: WorkspaceView) => setPreferences(previous => ({ ...previous, view })),
    setMonth: (month: string) => {
      if (isValidMonth(month)) setPreferences(previous => ({ ...previous, month }));
    },
  };
}
