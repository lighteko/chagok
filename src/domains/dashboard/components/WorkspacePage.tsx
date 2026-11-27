import { useCallback, useEffect, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/atomics/atoms/alert";
import { Badge } from "@/atomics/atoms/badge";
import { Button } from "@/atomics/atoms/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/atomics/atoms/empty";
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
import { useLedger } from "@/domains/settlement/hooks/useLedger";
import { SettlementPage } from "@/domains/settlement/components/SettlementPage";
import { ExpenseEditor } from "@/domains/expenses/components/ExpenseEditor";
import { ExpensesPage } from "@/domains/expenses/components/ExpensesPage";
import type { Expense } from "@/shared/desktop/ledger";
import { BackupDialog } from "./BackupDialog";
import { McpDialog } from "./McpDialog";
import { UpdateDialog } from "./UpdateDialog";
import type { AppUpdateStatus } from "@/shared/desktop/contracts";
import { TutorialGuide } from "@/domains/tutorial/components/TutorialGuide";
import { tutorialSteps } from "@/domains/tutorial/content/steps";
import type { SettlementNavigation } from "@/domains/settlement/types";
import type { ExpenseNavigation } from "@/domains/expenses/types";

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
  const ledger = useLedger(workspace.preferences?.month ?? currentMonth(), revision);
  const [expenseEditor, setExpenseEditor] = useState<{ expense?: Expense } | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [update, setUpdate] = useState<AppUpdateStatus | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false),
    [tutorialIndex, setTutorialIndex] = useState(0),
    [tutorialFinished, setTutorialFinished] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [lastExpenseId, setLastExpenseId] = useState<string | null>(null);
  const [settlementNavigation, setSettlementNavigation] = useState<SettlementNavigation | null>(null);
  const [expenseNavigation, setExpenseNavigation] = useState<ExpenseNavigation | null>(null);
  const settlementNavigationHandled = useCallback(() => setSettlementNavigation(null), []);
  const expenseNavigationHandled = useCallback(() => setExpenseNavigation(null), []);
  const changed = useCallback(() => {
    setBackedUp(false);
    setRevision(value => value + 1);
  }, []);
  useEffect(() => window.chagok.onMcpLedgerChanged(changed), [changed]);
  useEffect(() => {
    let active = true;
    let receivedStatus = false;
    const unsubscribe = window.chagok.onUpdateStatus(status => {
      receivedStatus = true;
      if (active) setUpdate(status);
    });
    void window.chagok
      .getUpdateStatus()
      .then(status => {
        if (active && !receivedStatus) setUpdate(status);
      })
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  function revealTutorialTarget(target: string) {
    requestAnimationFrame(() => {
      document.querySelector("main")?.scrollTo({ top: 0 });
      const element = document.querySelector<HTMLElement>(`[data-tutorial-target="${target}"]`);
      const focusable = element?.matches("button,input")
        ? element
        : element?.querySelector<HTMLElement>("button,input");
      focusable?.focus({ preventScroll: true });
    });
  }
  function selectTutorialStep(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= tutorialSteps.length) return;
    setTutorialIndex(index);
    const step = tutorialSteps[index].id;
    setSettlementNavigation(null);
    setExpenseNavigation(null);
    if (step === "import") workspace.setView("transactions");
    if (step === "expenses" || step === "links") workspace.setView("expenses");
    if (step === "classify" || step === "settlement" || step === "closing") {
      workspace.setView("settlement");
      setSettlementNavigation({ tab: step === "classify" ? "entries" : "overview", pendingOnly: step === "classify" });
    }
    requestAnimationFrame(() => document.querySelector("main")?.scrollTo({ top: 0 }));
  }
  function closeTutorial() {
    setTutorialOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-tutorial-launch]")?.focus());
  }
  function toggleTutorial() {
    if (tutorialOpen) {
      closeTutorial();
      return;
    }
    setTutorialOpen(true);
    setMessage(null);
    setTutorialFinished(false);
    selectTutorialStep(tutorialFinished ? 0 : tutorialIndex);
  }
  function runTutorialAction() {
    const step = tutorialSteps[tutorialIndex].id;
    if (step === "month") {
      requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>('[data-tutorial-target="month"] input')?.focus(),
      );
      return;
    }
    if (step === "import") {
      void chooseFile();
      return;
    }
    if (step === "classify") {
      const banks = ledger.data?.report.entries.filter(row => row.source === "bank") ?? [];
      const entry = banks.find(row => !row.confirmed) ?? banks[0];
      if (entry) setDetailId(entry.id);
      return;
    }
    if (step === "expenses") {
      workspace.setView("expenses");
      setExpenseEditor({});
      return;
    }
    if (step === "links") {
      const expenses = ledger.data?.expenses.filter(row => row.settlementMonth === workspace.preferences?.month) ?? [];
      const expense = expenses.find(row => row.id === lastExpenseId) ?? expenses[0];
      if (expense) {
        workspace.setView("expenses");
        setExpenseNavigation({ action: "link", expenseId: expense.id });
      }
      return;
    }
    if (step === "settlement") {
      workspace.setView("settlement");
      setSettlementNavigation({ tab: "overview", openSettings: true });
      return;
    }
    if (step === "closing") {
      workspace.setView("settlement");
      setSettlementNavigation({ tab: "overview" });
      revealTutorialTarget("closing");
      return;
    }
    setBackupOpen(true);
  }
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
    setBackedUp(false);
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
  const tutorialStep = tutorialSteps[tutorialIndex].id;
  const tutorialExpenses = ledger.data?.expenses.filter(row => row.settlementMonth === month) ?? [];
  const tutorialExpense = tutorialExpenses.find(row => row.id === lastExpenseId) ?? tutorialExpenses[0];
  const tutorialBanks = ledger.data?.report.entries.filter(row => row.source === "bank") ?? [];
  const guideBusy =
    importing || exporting || Boolean(preview || detailId || expenseEditor || backupOpen || mcpOpen || updateOpen);
  let actionHint: string | undefined;
  if (["classify", "expenses", "links", "settlement"].includes(tutorialStep) && (ledger.error || !ledger.data))
    actionHint = ledger.error ? "정산 자료를 다시 불러온 뒤 진행해 주세요." : "정산 자료를 불러오는 중입니다.";
  else if (tutorialStep === "classify" && !tutorialBanks.length)
    actionHint = "엑셀 가져오기 단계에서 거래를 저장하거나 다른 정산월을 선택해 주세요.";
  else if (["expenses", "links"].includes(tutorialStep) && ledger.data?.closed)
    actionHint = "마감·엑셀 출력 단계에서 사유를 기록하고 재개방하면 수정할 수 있습니다.";
  else if (tutorialStep === "links" && !tutorialExpenses.length)
    actionHint = "연결할 별도 지출이 없으면 다음 단계로 넘어가세요.";
  else if (
    tutorialStep === "links" &&
    !ledger.data?.classifications.some(
      row => row.direction === "expense" && row.withdrawal !== null && row.deposit === 0,
    )
  )
    actionHint = "먼저 연결할 통장 출금을 지출로 분류하고 금액을 보정해 주세요.";
  return (
    <WorkspaceLayout
      sidebar={
        <AppSidebar
          view={view}
          onSelect={workspace.setView}
          version={info?.version}
          tutorialOpen={tutorialOpen}
          onTutorial={toggleTutorial}
          onMcp={() => setMcpOpen(true)}
          onUpdate={update && update.phase !== "unsupported" ? () => setUpdateOpen(true) : undefined}
          updateReady={update?.phase === "ready"}
        />
      }
    >
      <div
        className="contents"
        data-tutorial-step={tutorialOpen ? tutorialStep : undefined}
      >
        <div className="sticky top-0 z-20 bg-background">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b bg-background px-6 py-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="h-4"
              />
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {view === "transactions" && transactions.data && (
                <Badge variant="secondary">{transactions.data.summary.count.toLocaleString()}건</Badge>
              )}
            </div>
            <div data-tutorial-target="month">
              <MonthSelector
                value={month}
                onValueChange={workspace.setMonth}
              />
            </div>
          </header>
          {tutorialOpen && (
            <div className="px-6 pt-4 pb-1">
              <TutorialGuide
                index={tutorialIndex}
                context={{
                  month,
                  ledger: ledger.data,
                  transactionCount: transactions.data && !transactions.loading ? transactions.data.summary.count : null,
                  backedUp,
                  transactionError: Boolean(transactions.error),
                  ledgerError: Boolean(ledger.error),
                }}
                disabled={guideBusy}
                actionDisabled={Boolean(actionHint)}
                actionHint={actionHint}
                onAction={runTutorialAction}
                onSelect={selectTutorialStep}
                onClose={closeTutorial}
                onFinish={() => {
                  setTutorialFinished(true);
                  closeTutorial();
                  setMessage({
                    text: "사용 안내를 마쳤습니다. 왼쪽 아래의 사용 안내에서 다시 열어볼 수 있습니다.",
                    error: false,
                  });
                }}
                onReceipt={
                  tutorialStep === "expenses" && tutorialExpense
                    ? () => {
                        workspace.setView("expenses");
                        setExpenseNavigation({ action: "receipts", expenseId: tutorialExpense.id });
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-5 p-6">
          {ledger.error && ledger.data && (
            <Alert variant="destructive">
              <AlertDescription>정산 자료를 갱신하지 못했습니다. {ledger.error}</AlertDescription>
              <AlertAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={ledger.reload}
                >
                  다시 불러오기
                </Button>
              </AlertAction>
            </Alert>
          )}
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{monthRange(month)}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setBackupOpen(true)}
                data-tutorial-target="backup"
              >
                백업·복원
              </Button>
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
                disabled={!ledger.data || ledger.data.closed}
                onClick={() => setExpenseEditor({})}
                data-tutorial-target="expenses"
              >
                <Plus />
                지출 추가
              </Button>
              <Button
                disabled={importing || exporting}
                onClick={() => void chooseFile()}
                data-tutorial-target="import"
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
                  <AlertTitle>원본 금액 누락 {transactions.data.summary.missingAmounts}건</AlertTitle>
                  <AlertDescription>
                    이 요약은 엑셀 원본 기준입니다. 누락 금액이 있어 입출금 차액은 표시하지 않습니다. 보정·분류한 금액은
                    월별 정산에서 확인합니다.
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
                  classifications={ledger.data?.classifications}
                />
              ) : (
                <Skeleton
                  className="min-h-96 flex-1"
                  aria-label="거래내역 불러오는 중"
                />
              )}
            </>
          ) : ledger.data ? (
            view === "expenses" ? (
              <ExpensesPage
                month={month}
                ledger={ledger.data}
                onChanged={changed}
                navigation={expenseNavigation}
                onNavigationHandled={expenseNavigationHandled}
              />
            ) : (
              <SettlementPage
                key={month}
                month={month}
                ledger={ledger.data}
                revision={revision}
                onChanged={changed}
                onMonth={workspace.setMonth}
                onTransaction={setDetailId}
                navigation={settlementNavigation}
                onNavigationHandled={settlementNavigationHandled}
                onExpense={id => {
                  const expense = ledger.data?.expenses.find(row => row.id === id);
                  if (expense) setExpenseEditor({ expense });
                }}
              />
            )
          ) : ledger.error ? (
            <Alert variant="destructive">
              <AlertDescription>{ledger.error}</AlertDescription>
              <AlertAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={ledger.reload}
                >
                  다시 불러오기
                </Button>
              </AlertAction>
            </Alert>
          ) : (
            <Skeleton
              className="h-96"
              aria-label="정산 자료 불러오는 중"
            />
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
            ledger={ledger.data ?? undefined}
            onSaved={() => {
              setDetailId(null);
              changed();
            }}
          />
        )}
        {expenseEditor && ledger.data && (
          <ExpenseEditor
            month={month}
            expense={expenseEditor.expense}
            categories={ledger.data.categories}
            onClose={() => setExpenseEditor(null)}
            onSaved={expense => {
              setLastExpenseId(expense.id);
              setExpenseEditor(null);
              changed();
            }}
          />
        )}
        {backupOpen && (
          <BackupDialog
            onClose={() => setBackupOpen(false)}
            onBackupCreated={() => setBackedUp(true)}
          />
        )}
        {mcpOpen && <McpDialog onClose={() => setMcpOpen(false)} />}
        {updateOpen && update && (
          <UpdateDialog
            status={update}
            version={info?.version}
            onClose={() => setUpdateOpen(false)}
          />
        )}
      </div>
    </WorkspaceLayout>
  );
}
