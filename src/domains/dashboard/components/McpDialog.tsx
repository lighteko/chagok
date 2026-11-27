import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import { Button } from "@/atomics/atoms/button";
import { Checkbox } from "@/atomics/atoms/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/atomics/atoms/dialog";
import { Input } from "@/atomics/atoms/input";
import { Label } from "@/atomics/atoms/label";
import { errorText } from "@/domains/settlement/hooks/useLedger";
import type { McpStatus } from "@/shared/desktop/contracts";

export function McpDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [allowClassification, setAllowClassification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void window.chagok.getMcpStatus().then(
      value => {
        if (active) setStatus(value);
      },
      failure => {
        if (active) setError(errorText(failure));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const enabled = !status?.url;
      setStatus(await window.chagok.setMcpEnabled(enabled, enabled && allowClassification));
      if (!enabled) setAllowClassification(false);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    setError("");
    try {
      await window.chagok.copyMcpToken();
      setCopied(true);
    } catch (error) {
      setError(errorText(error));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>MCP 연결</DialogTitle>
          <DialogDescription>
            같은 PC의 MCP 클라이언트에서 거래내역과 월별 정산 요약을 읽을 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {status?.url ? (
          <div className="grid gap-3">
            <p className="text-sm font-medium">{status.canClassify ? "거래 분류 및 규칙 관리 허용됨" : "읽기 전용"}</p>
            <div className="grid gap-2">
              <Label htmlFor="mcp-url">서버 주소</Label>
              <Input
                id="mcp-url"
                readOnly
                value={status.url}
                onFocus={event => event.currentTarget.select()}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              클라이언트에 Streamable HTTP 방식으로 주소와 Bearer 토큰을 등록하세요. 연결을 다시 켤 때는 표시된 주소와
              새 토큰을 사용하세요.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void copyToken()}
              >
                토큰 복사
              </Button>
              <span
                role="status"
                className="text-sm text-muted-foreground"
              >
                {copied ? "토큰을 복사했습니다." : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mcp-allow-classification"
                aria-describedby="mcp-classification-help"
                checked={allowClassification}
                disabled={busy || !status}
                onCheckedChange={setAllowClassification}
              />
              <Label htmlFor="mcp-allow-classification">거래 분류 및 규칙 관리 허용</Label>
            </div>
            <p
              id="mcp-classification-help"
              className="text-sm text-muted-foreground"
            >
              연결된 클라이언트가 분류를 저장·확정하고 반복 거래 규칙을 관리할 수 있습니다.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button
            disabled={busy || (!status && !error)}
            variant={status?.url ? "outline" : "default"}
            onClick={() => void toggle()}
          >
            {status?.url ? "연결 끄기" : "연결 켜기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
