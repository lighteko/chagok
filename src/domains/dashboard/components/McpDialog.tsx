import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
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
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/atomics/atoms/field";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/atomics/atoms/collapsible";
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
          <DialogTitle>Claude Desktop 연결</DialogTitle>
          <DialogDescription>Claude Desktop에서 차곡의 거래내역과 월별 정산 요약을 확인하세요.</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {status?.url ? (
          <p className="text-sm font-medium">{status.canClassify ? "거래 분류 및 규칙 관리 허용됨" : "읽기 전용"}</p>
        ) : (
          <Field orientation="horizontal">
            <Checkbox
              id="mcp-allow-classification"
              aria-describedby="mcp-classification-help"
              checked={allowClassification}
              disabled={busy || !status}
              onCheckedChange={setAllowClassification}
            />
            <FieldContent>
              <FieldLabel htmlFor="mcp-allow-classification">거래 분류 및 규칙 관리 허용</FieldLabel>
              <FieldDescription id="mcp-classification-help">
                연결된 클라이언트가 분류를 저장·확정하고 반복 거래 규칙을 관리할 수 있습니다.
              </FieldDescription>
            </FieldContent>
          </Field>
        )}
        {!status?.claudeDesktopPrepared && (
          <p className="text-sm text-muted-foreground">처음 한 번 Claude Desktop에서 차곡 확장 설치를 승인하세요.</p>
        )}
        {status?.claudeDesktopPrepared && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void connectClaude()}
            >
              확장 설치 다시 열기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void revealClaudeBundle()}
            >
              설치 파일 보기
            </Button>
          </div>
        )}
        {claudeHint && (
          <p
            role="status"
            className="text-sm text-muted-foreground"
          >
            {claudeHint}
          </p>
        )}
        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                className="group px-1 text-muted-foreground"
              />
            }
          >
            <ChevronDown
              aria-hidden="true"
              className="-rotate-90 transition-transform group-aria-expanded:rotate-0"
            />
            다른 클라이언트 설정
          </CollapsibleTrigger>
          <CollapsibleContent hiddenUntilFound>
            {status?.url ? (
              <div className="mt-2 grid gap-3">
                <Field>
                  <FieldLabel htmlFor="mcp-url">서버 주소</FieldLabel>
                  <Input
                    id="mcp-url"
                    aria-describedby="mcp-url-help"
                    readOnly
                    value={status.url}
                    onFocus={event => event.currentTarget.select()}
                  />
                  <FieldDescription id="mcp-url-help">
                    Streamable HTTP 방식으로 이 주소와 Bearer 토큰을 등록하세요.
                  </FieldDescription>
                </Field>
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
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || (!status && !error)}
                  onClick={() => void toggle()}
                >
                  다른 클라이언트 연결 켜기
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
        <DialogFooter>
          {status?.url && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void toggle()}
            >
              연결 끄기
            </Button>
          )}
          {!status?.claudeDesktopPrepared ? (
            <Button
              disabled={busy || (!status && !error)}
              onClick={() => void connectClaude()}
            >
              Claude Desktop 확장 설치
            </Button>
          ) : (
            !status.url && (
              <Button
                disabled={busy}
                onClick={() => void toggle()}
              >
                Claude Desktop 연결 켜기
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
