import { useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/atomics/atoms/dialog";
import { errorText } from "@/domains/settlement/hooks/useLedger";

export function BackupDialog({ onClose, onBackupCreated }: { onClose: () => void; onBackupCreated?: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  async function run(restore: boolean) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      if (restore) {
        await window.chagok.restoreBackup();
      } else {
        const result = await window.chagok.createBackup();
        if (result) {
          setNotice(`${result.fileName}에 전체 장부와 영수증 ${result.receipts}개를 백업했습니다.`);
          onBackupCreated?.();
        }
      }
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
          <DialogTitle>장부 백업·복원</DialogTitle>
          <DialogDescription>
            거래 원본, 분류·보정, 별도 지출, 영수증, 배분 설정, 마감본과 수정 이력을 하나의 .chagok 파일에 보관합니다.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          백업 파일은 다른 드라이브나 외부 저장장치에도 보관해 주세요. 금융 자료와 영수증이 포함된 파일입니다.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <Button
          disabled={busy}
          onClick={() => void run(false)}
        >
          전체 장부 백업
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void run(true)}
        >
          백업 파일에서 복원
        </Button>
        <p className="text-xs text-muted-foreground">
          복원 전 파일과 영수증을 검증하고 자료 수를 보여줍니다. 확인 후 현재 장부를 교체하며 복원 전 보관본도 PC에
          남깁니다.
        </p>
      </DialogContent>
    </Dialog>
  );
}
