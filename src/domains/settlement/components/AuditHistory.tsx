import { useEffect, useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/atomics/atoms/card";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import type { AuditEvent } from "@/shared/desktop/ledger";
import { errorText } from "../hooks/useLedger";

export function AuditHistory({ month }: { month: string }) {
  const [page, setPage] = useState(0),
    [data, setData] = useState<{ rows: AuditEvent[]; total: number } | null>(null),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    void window.chagok
      .getLedgerAudit(month, page)
      .then(value => {
        if (active) setData(value);
      })
      .catch(error => {
        if (active) setError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [month, page, retry]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>수정 이력</CardTitle>
        <CardDescription>
          이번 달과 공통 설정의 변경 전후를 보관합니다. 50건씩 이전 기록까지 조회할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}{" "}
              <Button
                variant="link"
                onClick={() => setRetry(value => value + 1)}
              >
                다시 불러오기
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!data && !error && (
          <p
            role="status"
            className="py-4 text-muted-foreground"
          >
            수정 이력 불러오는 중…
          </p>
        )}
        {data?.rows.map(event => (
          <details
            key={event.id}
            className="rounded-md border p-3"
          >
            <summary className="cursor-pointer text-sm">
              {new Date(event.at).toLocaleString()} · {event.action}
            </summary>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="font-medium">변경 전</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(event.before, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-medium">변경 후</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(event.after, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        ))}
        {data && (
          <div className="mt-3 flex items-center justify-end gap-3">
            <span className="text-sm">
              전체 {data.total}건 · {page + 1} / {Math.max(1, Math.ceil(data.total / 50))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!page}
              onClick={() => setPage(value => value - 1)}
            >
              최근 이력
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * 50 >= data.total}
              onClick={() => setPage(value => value + 1)}
            >
              이전 이력
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
