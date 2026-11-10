import { useCallback, useEffect, useRef, useState } from "react";
import { getWorkspacePreferences, saveWorkspacePreferences } from "@/domains/dashboard/api/workspacePreferences";
import {
  isWorkspacePreferences,
  isWorkspaceView,
  type WorkspacePreferences,
  type WorkspaceView,
} from "@/shared/desktop/preferences";
import { isValidMonth } from "@/shared/utils/month";

export { isWorkspaceView } from "@/shared/desktop/preferences";

// 이전 버전의 화면 설정을 이관할 때만 읽으며 새 값은 쓰지 않습니다.
const LEGACY_KEY = "chagok.workspace.v1";

function readLegacyPreferences(): WorkspacePreferences | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null");
    return isWorkspacePreferences(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function useWorkspaceState() {
  const [preferences, setPreferences] = useState<WorkspacePreferences | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const latest = useRef<WorkspacePreferences | null>(null);
  const loadVersion = useRef(0);
  const saveVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoadError(false);
    try {
      const saved = await getWorkspacePreferences(readLegacyPreferences());
      if (version !== loadVersion.current) return;
      latest.current = saved;
      setPreferences(saved);
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* DB에 이관된 값이 우선하므로 다음 실행에 다시 정리합니다. */
      }
    } catch {
      if (version === loadVersion.current) setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      loadVersion.current += 1;
    };
  }, [reload]);

  const save = useCallback((next: WorkspacePreferences) => {
    const version = ++saveVersion.current;
    latest.current = next;
    setPreferences(next);
    setSaveError(false);
    setIsSaving(true);
    void saveWorkspacePreferences(next)
      .then(saved => {
        if (version !== saveVersion.current) return;
        latest.current = saved;
        setPreferences(saved);
        setIsSaving(false);
      })
      .catch(() => {
        if (version !== saveVersion.current) return;
        setSaveError(true);
        setIsSaving(false);
      });
  }, []);

  return {
    preferences,
    loadError,
    saveError,
    isSaving,
    reload,
    retrySave: () => {
      if (latest.current) save(latest.current);
    },
    setView: (view: WorkspaceView) => {
      if (latest.current && isWorkspaceView(view)) save({ ...latest.current, view });
    },
    setMonth: (month: string) => {
      if (latest.current && isValidMonth(month)) save({ ...latest.current, month });
    },
  };
}
