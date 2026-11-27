import { useEffect, useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/atomics/atoms/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/atomics/atoms/item";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/atomics/atoms/dialog";
import type { Expense, ReceiptInfo } from "@/shared/desktop/ledger";
import { errorText } from "@/domains/settlement/hooks/useLedger";

export function ReceiptDialog({
  expense,
  closed,
  onClose,
  onChanged,
}: {
  expense: Expense;
  closed: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<ReceiptInfo[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void window.chagok
      .listReceipts(expense.id)
      .then(rows => {
        if (active) setRows(rows);
      })
      .catch(error => {
        if (active) setError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [expense.id, retry]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setRows(await window.chagok.listReceipts(expense.id));
      onChanged();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>영수증 · {expense.description}</DialogTitle>
          <DialogDescription>
            PNG·JPEG·WebP·PDF, 파일당 최대 20MB. 앱 데이터 폴더에 복사하며 백업에 함께 보관합니다.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}{" "}
              <Button
                variant="link"
                onClick={() => {
                  setError(null);
                  setRetry(value => value + 1);
                }}
              >
                다시 불러오기
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {rows.length ? (
          <ItemGroup className="gap-3">
            {rows.map(row => (
              <Item
                role="listitem"
                variant="outline"
                key={row.id}
                className="flex-nowrap"
              >
                <ItemContent className="min-w-0 gap-0">
                  <ItemTitle className="block max-w-full truncate font-normal">{row.fileName}</ItemTitle>
                  <ItemDescription className="text-xs">{Math.ceil(row.size / 1024).toLocaleString()}KB</ItemDescription>
                </ItemContent>
                <ItemActions className="shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => window.chagok.openReceipt(row.id))}
                  >
                    열기
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || closed}
                    onClick={() => void run(() => window.chagok.deleteReceipt(row.id))}
                  >
                    제거
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyDescription>첨부된 영수증이 없습니다.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <Button
          disabled={busy || closed}
          onClick={() => void run(() => window.chagok.addReceipt(expense.id))}
        >
          {busy ? "처리 중…" : "영수증 첨부"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
