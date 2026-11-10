import { useState } from "react";
import { Download, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/atomics/atoms/alert";
import { Badge } from "@/atomics/atoms/badge";
import { Button } from "@/atomics/atoms/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/atomics/atoms/empty";
import { SidebarTrigger } from "@/atomics/atoms/sidebar";
import { Skeleton } from "@/atomics/atoms/skeleton";
import { Separator } from "@/atomics/atoms/separator";
import { MonthSelector } from "@/atomics/molecules/MonthSelector";
import { WorkspaceLayout } from "@/atomics/templates/WorkspaceLayout";
import { AppSidebar } from "@/domains/dashboard/components/AppSidebar";
import { useAppInfo } from "@/domains/dashboard/hooks/useAppInfo";
import { useWorkspaceState } from "@/domains/dashboard/hooks/useWorkspaceState";
import { TransactionTable } from "@/domains/transactions/components/TransactionTable";
import { TransactionSummary } from "@/domains/transactions/components/TransactionSummary";
import { TransactionImportDialog } from "@/domains/transactions/components/TransactionImportDialog";
import { TransactionDetailDialog } from "@/domains/transactions/components/TransactionDetailDialog";
import { useTransactions } from "@/domains/transactions/hooks/useTransactions";
import type { TransactionImportPreview, TransactionImportResult } from "@/shared/desktop/transactions";
import { currentMonth, monthRange } from "@/shared/utils/month";

export function WorkspacePage() {
  const info = useAppInfo();
  const workspace = useWorkspaceState();
  const [revision, setRevision] = useState(0),
    [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<TransactionImportPreview | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const transactions = useTransactions(workspace.preferences?.month ?? currentMonth(), revision);

  async function chooseFile() {
    setImporting(true);
    setMessage(null);
    try {
      const value = await window.chagok.previewTransactionImport();
      if (value) setPreview(value);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
          : "파일을 읽지 못했습니다.";
      setMessage({ text, error: true });
    } finally {
      setImporting(false);
    }
  }
  function closePreview() {
    if (preview) void window.chagok.cancelTransactionImport(preview.token).catch(() => {});
    setPreview(null);
  }
  function imported(result: TransactionImportResult) {
    setPreview(null);
    workspace.setView("transactions");
    workspace.setMonth(result.months.at(-1)!);
    setRevision(value => value + 1);
    setMessage({
      text: `${result.inserted.toLocaleString()}건 저장했습니다.${result.duplicates ? ` 중복 ${result.duplicates.toLocaleString()}건은 제외했습니다.` : ""}`,
      error: false,
    });
  }

  async function exportMonth() {
    if (!workspace.preferences) return;
    setExporting(true);
    setMessage(null);
    try {
      const result = await window.chagok.exportTransactions(workspace.preferences.month);
      if (result)
        setMessage({
          text: `${result.month} 거래 ${result.count.toLocaleString()}건을 ${result.fileName}로 내보냈습니다.`,
          error: false,
        });
    } catch {
      setMessage({
        text: "엑셀 파일을 저장하지 못했습니다. 파일이 다른 프로그램에서 열려 있는지와 저장 위치를 확인한 뒤 다시 시도해 주세요.",
        error: true,
      });
    } finally {
      setExporting(false);
    }
  }

  if (!workspace.preferences)
    return (
      <Empty className="h-svh">
        <EmptyHeader>
          <EmptyTitle>
            {workspace.loadError ? "작업 설정을 불러오지 못했습니다." : "작업 화면을 불러오는 중입니다."}
          </EmptyTitle>
        </EmptyHeader>
        {workspace.loadError && <Button onClick={() => void workspace.reload()}>다시 불러오기</Button>}
      </Empty>
    );
  const { view, month } = workspace.preferences;
  const title = { transactions: "거래내역", expenses: "별도 지출", settlement: "월별 정산" }[view];
  return (
    <WorkspaceLayout
      sidebar={
        <AppSidebar
          view={view}
          onSelect={workspace.setView}
          version={info?.version}
        />
      }
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="h-4"
          />
          <h1 className="text-lg font-semibold">{title}</h1>
          {view === "transactions" && transactions.data && (
            <Badge variant="secondary">{transactions.data.summary.count.toLocaleString()}건</Badge>
          )}
        </div>
        <MonthSelector
          value={month}
          onValueChange={workspace.setMonth}
        />
      </header>
      <div className="flex flex-1 flex-col gap-5 p-6">
        {workspace.saveError && (
          <Alert variant="destructive">
            <AlertDescription>화면 설정을 저장하지 못했습니다. 앱을 닫기 전에 다시 저장해 주세요.</AlertDescription>
            <AlertAction>
              <Button
                variant="outline"
                size="sm"
                onClick={workspace.retrySave}
              >
                다시 저장
              </Button>
            </AlertAction>
          </Alert>
        )}
        {message && (
          <Alert variant={message.error ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="sm"
                aria-label="알림 닫기"
                onClick={() => setMessage(null)}
              >
                닫기
              </Button>
            </AlertAction>
          </Alert>
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{monthRange(month)}</p>
          <div className="flex gap-2">
            {view === "transactions" && (
              <Button
                variant="outline"
                disabled={exporting || importing || !transactions.data?.summary.count}
                onClick={() => void exportMonth()}
                title="검색·필터·페이지와 관계없이 선택한 달의 전체 거래를 내보냅니다."
              >
                <Download />
                {exporting ? "내보내는 중…" : "엑셀 내보내기"}
              </Button>
            )}
            <Button
              variant="outline"
              disabled
              title="지출 입력 기능은 아직 지원하지 않습니다."
            >
              <Plus />
              지출 추가
            </Button>
            <Button
              disabled={importing || exporting}
              onClick={() => void chooseFile()}
            >
              <Upload />
              {importing ? "파일 읽는 중…" : "파일 가져오기"}
            </Button>
          </div>
        </div>
        {view === "transactions" ? (
          <>
            <TransactionSummary summary={transactions.data?.summary} />
            {transactions.data?.summary.missingAmounts ? (
              <Alert>
                <AlertTitle>금액 확인이 필요한 거래 {transactions.data.summary.missingAmounts}건</AlertTitle>
                <AlertDescription>
                  합계에는 확인된 금액만 포함됩니다. 누락 금액이 있어 입출금 차액은 표시하지 않습니다.
                </AlertDescription>
              </Alert>
            ) : null}
            {transactions.error ? (
              <Alert variant="destructive">
                <AlertDescription>{transactions.error}</AlertDescription>
                <AlertAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={transactions.reload}
                  >
                    다시 불러오기
                  </Button>
                </AlertAction>
              </Alert>
            ) : transactions.data ? (
              <TransactionTable
                data={transactions.data}
                query={transactions.query}
                onSearch={transactions.setSearch}
                onFilter={transactions.setFilter}
                onPage={transactions.setPage}
                onImport={() => void chooseFile()}
                onDetail={setDetailId}
                importing={importing || exporting}
                loading={transactions.loading}
              />
            ) : (
              <Skeleton
                className="min-h-96 flex-1"
                aria-label="거래내역 불러오는 중"
              />
            )}
          </>
        ) : (
          <Empty className="min-h-96 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSpreadsheet />
              </EmptyMedia>
              <EmptyTitle>{view === "expenses" ? "별도 지출" : "월별 정산"}</EmptyTitle>
              <EmptyDescription>
                {view === "expenses"
                  ? "통장에 없는 지출을 기록하는 기능은 아직 지원하지 않습니다."
                  : "정산 항목 분류와 배분 계산은 아직 지원하지 않습니다. 가져온 거래는 거래내역에서 확인할 수 있습니다."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
      {preview && (
        <TransactionImportDialog
          key={preview.token}
          preview={preview}
          currentMonth={month}
          onClose={closePreview}
          onSaved={imported}
        />
      )}
      {detailId && (
        <TransactionDetailDialog
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </WorkspaceLayout>
  );
}
