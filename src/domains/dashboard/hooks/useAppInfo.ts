import { useEffect, useState } from "react";
import type { AppInfo } from "@/shared/desktop/contracts";

export function useAppInfo() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    let active = true;
    void window.chagok
      .getAppInfo()
      .then(value => {
        if (active) setInfo(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return info;
}
