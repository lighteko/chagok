import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronUp, List, X } from "lucide-react";
import { Badge } from "@/atomics/atoms/badge";
import { Button } from "@/atomics/atoms/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/atomics/atoms/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/atomics/atoms/dialog";
import { tutorialSteps, tutorialStatus, type TutorialContext } from "../content/steps";
import "../styles/tutorial.css";

export function TutorialGuide({
  index,
  context,
  disabled,
  actionDisabled,
  actionHint,
  onAction,
  onSelect,
  onClose,
  onFinish,
  onReceipt,
}: {
  index: number;
  context: TutorialContext;
  disabled: boolean;
  actionDisabled: boolean;
  actionHint?: string;
  onAction: () => void;
  onSelect: (index: number) => void;
  onClose: () => void;
  onFinish: () => void;
  onReceipt?: () => void;
}) {
  const step = tutorialSteps[index];
  const [expanded, setExpanded] = useState(true),
    [contentsOpen, setContentsOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setExpanded(true);
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);
  function act(action: () => void) {
    setExpanded(false);
    action();
  }
  return (
    <>
      <Card
        id="chagok-tutorial"
        role="region"
        aria-label="차곡 사용 안내"
        className="gap-0 border border-primary/20 shadow-none"
        size="sm"
      >
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="secondary">
              사용 안내 {index + 1} / {tutorialSteps.length}
            </Badge>
            <CardTitle>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-sm font-semibold outline-none"
              >
                {step.title}
              </h2>
            </CardTitle>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!expanded && (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || actionDisabled}
                title={actionHint}
                onClick={() => act(onAction)}
              >
                이 단계 해보기
              </Button>
            )}
            {!expanded && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="이전 안내 단계"
                  disabled={disabled || index === 0}
                  onClick={() => onSelect(index - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  size="sm"
                  disabled={disabled}
                  onClick={() => (index === tutorialSteps.length - 1 ? onFinish() : onSelect(index + 1))}
                >
                  {index === tutorialSteps.length - 1 ? "안내 마치기" : "다음"}
                  <ArrowRight />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="사용 안내 목차"
              disabled={disabled}
              onClick={() => setContentsOpen(true)}
            >
              <List />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-expanded={expanded}
              aria-label={expanded ? "안내 접기" : "안내 펼치기"}
              onClick={() => setExpanded(value => !value)}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="사용 안내 닫기"
              disabled={disabled}
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        </CardHeader>
        {expanded && (
          <>
            <CardContent className="grid gap-3 pb-3">
              <CardDescription>{step.description}</CardDescription>
              <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-relaxed">
                {step.instructions.map(instruction => (
                  <li
                    key={instruction}
                    className="pl-1"
                  >
                    {instruction}
                  </li>
                ))}
              </ol>
              <p
                role="status"
                className="text-xs font-medium text-primary"
              >
                {tutorialStatus(step.id, context)}
              </p>
              {actionDisabled && actionHint && <p className="text-xs text-muted-foreground">{actionHint}</p>}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={disabled || actionDisabled}
                  onClick={() => act(onAction)}
                >
                  {step.action}
                  <ArrowRight />
                </Button>
                {onReceipt && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => act(onReceipt)}
                  >
                    영수증 첨부 위치 열기
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || index === 0}
                  onClick={() => onSelect(index - 1)}
                >
                  <ChevronLeft />
                  이전
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => (index === tutorialSteps.length - 1 ? onFinish() : onSelect(index + 1))}
                >
                  {index === tutorialSteps.length - 1 ? "안내 마치기" : "다음 단계"}
                  <ArrowRight />
                </Button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>
      <Dialog
        open={contentsOpen}
        onOpenChange={setContentsOpen}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>차곡 사용 안내</DialogTitle>
            <DialogDescription>
              실제 장부에서 작업하는 순서입니다. 필요한 단계부터 열거나 안내를 처음부터 살펴보세요.
            </DialogDescription>
          </DialogHeader>
          <ol className="grid gap-1">
            {tutorialSteps.map((item, position) => (
              <li key={item.id}>
                <Button
                  className="h-auto w-full justify-start gap-3 py-3 text-left"
                  variant={position === index ? "secondary" : "ghost"}
                  aria-current={position === index ? "step" : undefined}
                  onClick={() => {
                    setContentsOpen(false);
                    onSelect(position);
                  }}
                >
                  <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{position + 1}</span>
                  <span>{item.shortTitle}</span>
                  {position === index && (
                    <Badge
                      variant="outline"
                      className="ml-auto"
                    >
                      현재 단계
                    </Badge>
                  )}
                </Button>
              </li>
            ))}
          </ol>
          <Button
            variant="outline"
            onClick={() => {
              setContentsOpen(false);
              onSelect(0);
            }}
          >
            안내 처음부터
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
