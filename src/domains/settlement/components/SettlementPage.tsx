import { useEffect, useRef, useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Input } from "@/atomics/atoms/input";
import { Label } from "@/atomics/atoms/label";
import { Checkbox } from "@/atomics/atoms/checkbox";
import { Badge } from "@/atomics/atoms/badge";
import { NativeSelect, NativeSelectOption } from "@/atomics/atoms/native-select";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/atomics/atoms/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/atomics/atoms/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/atomics/atoms/card";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/atomics/atoms/dialog";
import type { LedgerWorkspace, SettlementSettings } from "@/shared/desktop/ledger";
import { formatMoney } from "@/shared/utils/money";
import { BulkClassificationForm, ClassificationTools } from "./ClassificationTools";
import { SettlementCharts, type EntryFilter } from "./SettlementCharts";
import { errorText } from "../hooks/useLedger";
import { AuditHistory } from "./AuditHistory";
import type { SettlementNavigation } from "../types";

export function SettlementPage({
  month,
  ledger,
  revision,
  onChanged,
  onMonth,
  onTransaction,
  onExpense,
  navigation,
  onNavigationHandled,
}: {
  month: string;
  ledger: LedgerWorkspace;
  revision: number;
  onChanged: () => void;
  onMonth: (month: string) => void;
  onTransaction: (id: string) => void;
  onExpense: (id: string) => void;
  navigation?: SettlementNavigation | null;
  onNavigationHandled?: () => void;
}) {
  const [tab, setTab] = useState("overview"),
    [filter, setFilter] = useState<EntryFilter>({}),
    [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false),
    [closing, setClosing] = useState(false),
    [reopening, setReopening] = useState(false),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const listRef = useRef<HTMLDivElement>(null),
    report = ledger.report;
  useEffect(() => {
    if (!navigation) return;
    setTab(navigation.tab);
    setPendingOnly(navigation.pendingOnly ?? false);
    setFilter({});
    setSearch("");
    setSelected([]);
    setPage(0);
    if (navigation.openSettings) setSettingsOpen(true);
    onNavigationHandled?.();
  }, [navigation, onNavigationHandled]);
  const rows = report.entries.filter(
    row =>
      (!filter.day || row.occurredOn === filter.day) &&
      (filter.categoryId === undefined || row.categoryId === filter.categoryId) &&
      (!filter.direction || row.direction === filter.direction) &&
      (!pendingOnly || !row.confirmed || row.direction === "unclassified") &&
      `${row.description} ${row.categoryName} ${row.paidBy}`.includes(search),
  );
  async function run(action: () => Promise<unknown>, done: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      done();
      onChanged();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function exportReport(snapshotId?: string) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await window.chagok.exportSettlement(month, snapshotId);
      if (result) setNotice(`${result.fileName}에 정산표를 저장했습니다.`);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  function drilldown(next: EntryFilter) {
    setFilter(next);
    setPendingOnly(false);
    setPage(0);
    setTab("overview");
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / 50)),
    visible = rows.slice(Math.min(page, totalPages - 1) * 50, (Math.min(page, totalPages - 1) + 1) * 50);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={ledger.closed ? "default" : "secondary"}>{ledger.closed ? "마감됨" : "잠정 정산"}</Badge>
          <span className="text-sm text-muted-foreground">확인할 내역 {report.pending}건</span>
        </div>
        <div
          className="flex flex-wrap gap-2"
          data-tutorial-target="closing"
        >
          <Button
            variant="outline"
            disabled={busy || !report.entries.length}
            onClick={() => void exportReport()}
          >
            정산표 엑셀 출력
          </Button>
          <Button
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            data-tutorial-target="settlement"
          >
            배분 설정
          </Button>
          {ledger.closed ? (
            <Button
              variant="outline"
              onClick={() => setReopening(true)}
            >
              마감 재개방
            </Button>
          ) : (
            <Button
              disabled={busy || !!report.pending || !report.entries.length}
              onClick={() => setClosing(true)}
            >
              이번 달 마감
            </Button>
          )}
        </div>
      </div>
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
      {report.pending > 0 && (
        <Alert>
          <AlertDescription>
            미분류·미확정 {report.pending}건이 있어 잠정 금액을 표시합니다. 금액이 있는 분류 제안도 합계에 포함되므로
            확정 전 검토해 주세요.{" "}
            <Button
              variant="link"
              onClick={() => {
                setPendingOnly(true);
                setFilter({});
                setTab("entries");
                setPage(0);
              }}
            >
              확인할 내역 보기
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["정산 수입", report.income],
          ["총지출", report.totalExpenses],
          ["정산 잔액", report.net],
          ["현금 / 카드 / 기타", null],
        ].map(([label, amount]) => (
          <Card
            key={label}
            className={label === "정산 잔액" ? "bg-primary/5" : undefined}
          >
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle
                className={`text-2xl tabular-nums tracking-tight ${label === "정산 잔액" ? "text-primary" : ""}`}
              >
                {amount === null ? (
                  <span className="text-sm">
                    {formatMoney(report.expenses.cash)} / {formatMoney(report.expenses.card)} /{" "}
                    {formatMoney(report.expenses.other)}원
                  </span>
                ) : (
                  `${formatMoney(Number(amount))}원`
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>배분액</CardTitle>
          <CardDescription>
            {report.settings.rounding === "largest-remainder"
              ? "원 미만은 버린 뒤 소수 잔여가 큰 대상부터 1원씩 배분합니다. 동률은 대상 순서입니다."
              : "원 미만은 버리고 남는 금액을 마지막 대상에게 배분합니다."}{" "}
            음수 잔액은 손실 배분액입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8">
          {report.allocations.map(row => (
            <div key={row.id}>
              <p className="text-sm text-muted-foreground">
                {row.recipient} · {row.basisPoints / 100}%
              </p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-primary">
                {formatMoney(row.amount)}원
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Tabs
        value={tab}
        onValueChange={value => setTab(String(value))}
      >
        <TabsList>
          <TabsTrigger value="overview">대시보드</TabsTrigger>
          <TabsTrigger
            value="entries"
            data-tutorial-target="classify"
          >
            분류·확인
          </TabsTrigger>
          <TabsTrigger value="rules">항목·분류 규칙</TabsTrigger>
          <TabsTrigger value="history">마감·수정 이력</TabsTrigger>
        </TabsList>
        <TabsContent
          value="overview"
          className="mt-3 grid gap-5"
        >
          <SettlementCharts
            report={report}
            revision={revision}
            onFilter={drilldown}
            onMonth={onMonth}
          />
        </TabsContent>
        <TabsContent
          value="rules"
          className="mt-3"
        >
          <ClassificationTools
            month={month}
            ledger={ledger}
            onChanged={onChanged}
          />
        </TabsContent>
        <TabsContent
          value="history"
          className="mt-3 grid gap-5"
        >
          <Card>
            <CardHeader>
              <CardTitle>마감본</CardTitle>
              <CardDescription>재개방 후에도 이전 마감 당시의 계산 결과를 보관합니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {ledger.snapshots.length ? (
                ledger.snapshots.map(row => (
                  <div
                    className="rounded-md border p-3"
                    key={row.id}
                  >
                    <p className="font-medium">
                      {new Date(row.closedAt).toLocaleString()} · 잔액 {formatMoney(row.report.net)}원
                    </p>
                    <p className="text-sm">
                      {row.report.allocations.map(a => `${a.recipient} ${formatMoney(a.amount)}원`).join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.reopenedAt
                        ? `재개방 ${new Date(row.reopenedAt).toLocaleString()} · ${row.reopenReason}`
                        : "현재 마감본"}
                    </p>
                    <Button
                      className="mt-2"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void exportReport(row.id)}
                    >
                      이 마감본 엑셀 출력
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">아직 마감한 이력이 없습니다.</p>
              )}
            </CardContent>
          </Card>
          <AuditHistory
            key={`${month}-${revision}`}
            month={month}
          />
        </TabsContent>
      </Tabs>
      {(tab === "overview" || tab === "entries") && (
        <Card ref={listRef}>
          <CardHeader>
            <CardTitle>정산 내역 {rows.length}건</CardTitle>
            <CardDescription>
              통장 출금은 연결 금액을 차감한 금액으로 표시합니다. 원본 거래는 상세에서 확인합니다.
            </CardDescription>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                className="max-w-xs"
                aria-label="정산 내역 검색"
                placeholder="내용·항목·결제자 검색"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pending-only"
                  checked={pendingOnly}
                  onCheckedChange={checked => {
                    setPendingOnly(Boolean(checked));
                    setPage(0);
                  }}
                />
                <Label htmlFor="pending-only">확인할 내역만</Label>
              </div>
              {Object.keys(filter).length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilter({});
                    setPage(0);
                  }}
                >
                  차트 선택 해제 {filter.day ?? ""}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {selected.length > 0 && (
              <BulkClassificationForm
                ids={selected}
                month={month}
                ledger={ledger}
                onChanged={() => {
                  setSelected([]);
                  onChanged();
                }}
              />
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      aria-label="현재 페이지 통장 거래 모두 선택"
                      disabled={ledger.closed}
                      checked={
                        visible.filter(row => row.source === "bank").length > 0 &&
                        visible.filter(row => row.source === "bank").every(row => selected.includes(row.id))
                      }
                      onCheckedChange={checked => {
                        const ids = visible.filter(row => row.source === "bank").map(row => row.id);
                        setSelected(previous =>
                          checked ? [...new Set([...previous, ...ids])] : previous.filter(id => !ids.includes(id)),
                        );
                      }}
                    />
                  </TableHead>
                  {["사용일", "내용", "출처 / 결제자", "분류 / 항목", "정산 금액", "상태", ""].map((title, index) => (
                    <TableHead key={index}>{title}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(row => (
                  <TableRow key={`${row.source}-${row.id}`}>
                    <TableCell>
                      {row.source === "bank" && (
                        <Checkbox
                          aria-label={`${row.description || row.occurredOn} 선택`}
                          disabled={ledger.closed}
                          checked={selected.includes(row.id)}
                          onCheckedChange={checked =>
                            setSelected(previous =>
                              checked ? [...new Set([...previous, row.id])] : previous.filter(id => id !== row.id),
                            )
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>{row.occurredOn}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal">
                      {row.description || "내용 없음"}
                      {row.linkedAmount > 0 && (
                        <div className="text-xs text-muted-foreground">통장 연결 {formatMoney(row.linkedAmount)}원</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.source === "bank" ? "통장" : "별도"}
                      <div className="text-xs text-muted-foreground">{row.paidBy}</div>
                    </TableCell>
                    <TableCell>
                      {
                        { income: "수입", expense: "지출", transfer: "이체", excluded: "제외", unclassified: "미분류" }[
                          row.direction
                        ]
                      }
                      <div className="text-xs text-muted-foreground">{row.categoryName}</div>
                    </TableCell>
                    <TableCell>
                      {["transfer", "excluded"].includes(row.direction)
                        ? "정산 미반영"
                        : `${formatMoney(row.amount)}원`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.confirmed ? "outline" : "secondary"}>
                        {row.confirmed ? "확인 완료" : "확인 필요"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (row.source === "bank" ? onTransaction(row.id) : onExpense(row.id))}
                      >
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!visible.length && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      조건에 맞는 정산 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 0}
                onClick={() => setPage(value => value - 1)}
              >
                이전
              </Button>
              <span className="text-sm">
                {Math.min(page, totalPages - 1) + 1} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(value => value + 1)}
              >
                다음
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {settingsOpen && (
        <AllocationDialog
          ledger={ledger}
          onClose={() => setSettingsOpen(false)}
          onSaved={onChanged}
        />
      )}
      {(closing || reopening) && (
        <Dialog
          open
          onOpenChange={open => {
            if (!open && !busy) {
              setClosing(false);
              setReopening(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{closing ? `${month} 정산 마감` : `${month} 마감 재개방`}</DialogTitle>
              <DialogDescription>
                {closing
                  ? "현재 내역·계산 기준·배분액을 마감본으로 보관하고 이번 달 수정을 잠급니다."
                  : "기존 마감본은 보존됩니다. 수정할 사유를 기록해 주세요."}
              </DialogDescription>
            </DialogHeader>
            {reopening && (
              <>
                <Label htmlFor="reopen-reason">재개방 사유</Label>
                <Input
                  id="reopen-reason"
                  maxLength={2000}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setClosing(false);
                  setReopening(false);
                }}
              >
                취소
              </Button>
              <Button
                disabled={busy || (reopening && !reason.trim())}
                onClick={() =>
                  void run(
                    () => (closing ? window.chagok.closePeriod(month) : window.chagok.reopenPeriod(month, reason)),
                    () => {
                      setClosing(false);
                      setReopening(false);
                      setReason("");
                    },
                  )
                }
              >
                {busy ? "저장 중…" : closing ? "마감 확정" : "사유 기록 후 재개방"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AllocationDialog({
  ledger,
  onClose,
  onSaved,
}: {
  ledger: LedgerWorkspace;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [settings, setSettings] = useState<SettlementSettings>(() => structuredClone(ledger.report.settings)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await window.chagok.saveSettlementSettings(ledger.report.month, settings);
      onSaved();
      onClose();
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>배분 설정 · {ledger.report.month}</DialogTitle>
          <DialogDescription>
            이번 달의 대상과 비율을 설정합니다. 합계는 100%이며 소수점 둘째 자리까지 지원합니다.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={event => {
            event.preventDefault();
            void save();
          }}
        >
          {settings.allocations.map((row, index) => (
            <div
              key={row.id}
              className="flex items-end gap-2"
            >
              <div className="grid flex-1 gap-2">
                <Label htmlFor={`recipient-${index}`}>대상 {index + 1}</Label>
                <Input
                  id={`recipient-${index}`}
                  required
                  maxLength={100}
                  disabled={ledger.closed}
                  value={row.recipient}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      allocations: settings.allocations.map((a, i) =>
                        i === index ? { ...a, recipient: e.target.value } : a,
                      ),
                    })
                  }
                />
              </div>
              <div className="grid w-24 gap-2">
                <Label htmlFor={`ratio-${index}`}>비율 (%)</Label>
                <Input
                  id={`ratio-${index}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  disabled={ledger.closed}
                  value={row.basisPoints / 100}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      allocations: settings.allocations.map((a, i) =>
                        i === index ? { ...a, basisPoints: Math.round(Number(e.target.value) * 100) } : a,
                      ),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={ledger.closed || settings.allocations.length === 1}
                onClick={() =>
                  setSettings({ ...settings, allocations: settings.allocations.filter((_, i) => i !== index) })
                }
              >
                삭제
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={ledger.closed || settings.allocations.length >= 20}
            onClick={() =>
              setSettings({
                ...settings,
                allocations: [...settings.allocations, { id: crypto.randomUUID(), recipient: "", basisPoints: 0 }],
              })
            }
          >
            배분 대상 추가
          </Button>
          <p className="text-sm">합계 {settings.allocations.reduce((sum, row) => sum + row.basisPoints, 0) / 100}%</p>
          <Label htmlFor="rounding">원 미만 처리</Label>
          <NativeSelect
            id="rounding"
            disabled={ledger.closed}
            value={settings.rounding}
            onChange={e => setSettings({ ...settings, rounding: e.target.value as SettlementSettings["rounding"] })}
          >
            <NativeSelectOption value="largest-remainder">소수 잔여가 큰 대상부터 1원 배분</NativeSelectOption>
            <NativeSelectOption value="last-recipient">마지막 대상에게 잔여 원 배분</NativeSelectOption>
          </NativeSelect>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              닫기
            </Button>
            <Button
              type="submit"
              disabled={busy || ledger.closed}
            >
              이번 달 배분 설정 저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
