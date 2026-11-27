import { useState } from "react";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import { Button } from "@/atomics/atoms/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/atomics/atoms/dialog";
import { Progress } from "@/atomics/atoms/progress";
import type { AppUpdateStatus } from "@/shared/desktop/contracts";
import { errorText } from "@/domains/settlement/hooks/useLedger";

export function UpdateDialog({
  status,
  version,
  onClose,
}: {
  status: AppUpdateStatus;
  version?: string;
  onClose: () => void;
}) {
  const [actionError, setActionError] = useState("");
  const phase = status.phase;

  async function request(action: () => Promise<void>) {
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(errorText(error));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>차곡 업데이트</DialogTitle>
          <DialogDescription>
            {version ? `현재 설치 버전 ${version}` : "설치된 차곡의 업데이트를 확인합니다."}
          </DialogDescription>
        </DialogHeader>
        <div
          role="status"
          className="grid gap-2"
        >
          {phase === "idle" && <p>새 버전이 있으면 자동으로 내려받습니다.</p>}
          {phase === "checking" && <p>새 버전을 확인하고 있습니다.</p>}
          {phase === "current" && <p>최신 버전입니다.</p>}
          {phase === "downloading" && (
            <>
              <p>
                {status.version} 내려받는 중 · {status.percent}%
              </p>
              <Progress
                aria-label="업데이트 다운로드 진행률"
                className="w-full [&_[data-slot=progress-track]]:h-2"
                value={status.percent}
              />
            </>
          )}
          {phase === "ready" && <p>{status.version} 업데이트를 받았습니다. 차곡을 종료하면 설치됩니다.</p>}
          {phase === "installing" && <p>차곡을 다시 시작해 {status.version} 업데이트를 설치합니다.</p>}
        </div>
        {(phase === "error" || actionError) && (
          <Alert variant="destructive">
            <AlertDescription>{actionError || (phase === "error" && status.message)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          {phase === "ready" ? (
            <Button onClick={() => void request(window.chagok.installUpdate)}>재시작 및 설치</Button>
          ) : (
            <Button
              disabled={phase === "checking" || phase === "downloading" || phase === "installing"}
              onClick={() => void request(window.chagok.checkForUpdate)}
            >
              업데이트 확인
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
