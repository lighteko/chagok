import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import { Button } from "@/atomics/atoms/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/atomics/atoms/dialog";
import { Skeleton } from "@/atomics/atoms/skeleton";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/atomics/atoms/table";
import type { TransactionDetail } from "@/shared/desktop/transactions";
import { formatMoney } from "@/shared/utils/money";
import type { LedgerWorkspace } from "@/shared/desktop/ledger";
import { ClassificationEditor } from "./ClassificationEditor";

export function TransactionDetailDialog({
  id,
  onClose,
  ledger,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  ledger?: LedgerWorkspace;
  onSaved?: () => void;
}) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    void window.chagok
      .getTransaction(id)
      .then(value => {
        if (active) setDetail(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>거래 상세</DialogTitle>
          <DialogDescription>저장한 거래와 엑셀 원본 값을 확인합니다.</DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              거래를 읽지 못했습니다.{" "}
              <Button
                variant="link"
                onClick={() => setRetry(value => value + 1)}
              >
                다시 불러오기
              </Button>
            </AlertDescription>
          </Alert>
        ) : !detail ? (
          <Skeleton className="h-48" />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["계좌", detail.accountName],
                ["거래일시", detail.occurredAt],
                ["출금", `${formatMoney(detail.withdrawal)} 원`],
                ["입금", `${formatMoney(detail.deposit)} 원`],
                ["거래 후 잔액", `${formatMoney(detail.balance)} 원`],
                ["메모", detail.memo || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {detail.issues.length > 0 && (
              <Alert>
                <AlertDescription>{detail.issues.join(" · ")}</AlertDescription>
              </Alert>
            )}
            <p className="break-all text-xs text-muted-foreground">
              {detail.fileName} / {detail.sheetName} / {detail.sourceRow}행
            </p>
            {ledger && onSaved && (
              <ClassificationEditor
                key={detail.id}
                detail={detail}
                ledger={ledger}
                onSaved={onSaved}
              />
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>원본 열</TableHead>
                  <TableHead>원본 값</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.rawCells.map((cell, index) => (
                  <TableRow key={index}>
                    <TableCell>{cell.column}</TableCell>
                    <TableCell className="max-w-80 whitespace-normal break-words">
                      {cell.value === null ? "빈 셀" : String(cell.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
