import { useCallback, useEffect, useState } from "react";
import type { LedgerWorkspace } from "@/shared/desktop/ledger";

export function useLedger(month: string, revision: number) {
  const [state, setState] = useState<{ month: string; data: LedgerWorkspace } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void window.chagok
      .getLedger(month)
      .then(value => {
        if (active) setState({ month, data: value });
      })
      .catch(error => {
        if (active) setError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [month, revision, retry]);
  return {
    data: state?.month === month ? state.data : null,
    error,
    reload: useCallback(() => setRetry(value => value + 1), []),
  };
}
export function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
    : "처리하지 못했습니다. 다시 시도해 주세요.";
}
