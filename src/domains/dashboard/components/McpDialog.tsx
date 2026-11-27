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
  const [claudeHint, setClaudeHint] = useState("");

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
    setClaudeHint("");
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

  async function connectClaude() {
    setBusy(true);
    setError("");
    setClaudeHint("");
    try {
      const { status: connected, opened } = await window.chagok.connectClaudeDesktop(allowClassification);
      setStatus(connected);
      setClaudeHint(
        opened
          ? "Claude Desktop에서 차곡 확장 설치를 승인하세요."
          : "Claude Desktop의 설정 → 확장 → 고급 설정 → 확장 설치에서 표시한 chagok.mcpb 파일을 선택하세요.",
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function revealClaudeBundle() {
    setError("");
    try {
      await window.chagok.revealClaudeBundle();
    } catch (error) {
      setError(errorText(error));
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
            <details open={!status.claudeDesktopPrepared}>
              <summary className="cursor-pointer text-sm">다른 MCP 클라이언트 설정</summary>
              <div className="mt-2 grid gap-3">
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
                  Streamable HTTP 방식으로 이 주소와 Bearer 토큰을 등록하세요.
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
            </details>
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
        <div className="grid gap-2 rounded-md border p-3">
          <p className="text-sm text-muted-foreground">
            Claude Desktop에서 차곡 확장을 한 번 설치하세요. 이후에는 차곡에서 연결만 켜면 됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={status?.claudeDesktopPrepared ? "outline" : "default"}
              size="sm"
              disabled={busy || !status}
              onClick={() => void connectClaude()}
            >
              {status?.claudeDesktopPrepared ? "확장 설치 다시 열기" : "Claude Desktop 연결"}
            </Button>
            {status?.claudeDesktopPrepared && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void revealClaudeBundle()}
              >
                설치 파일 보기
              </Button>
            )}
          </div>
          {claudeHint && (
            <p
              role="status"
              className="text-sm text-muted-foreground"
            >
              {claudeHint}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={busy || (!status && !error)}
            variant={status?.url || !status?.claudeDesktopPrepared ? "outline" : "default"}
            onClick={() => void toggle()}
          >
            {status?.url ? "연결 끄기" : "연결 켜기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
