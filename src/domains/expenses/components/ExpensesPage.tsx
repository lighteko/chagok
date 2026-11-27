import { useEffect, useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Input } from "@/atomics/atoms/input";
import { Field, FieldGroup, FieldLabel } from "@/atomics/atoms/field";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/atomics/atoms/item";
import { NativeSelect, NativeSelectOption } from "@/atomics/atoms/native-select";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/atomics/atoms/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/atomics/atoms/card";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/atomics/atoms/dialog";
import type { Expense, LedgerWorkspace } from "@/shared/desktop/ledger";
import { ExpenseEditor } from "./ExpenseEditor";
import { errorText } from "@/domains/settlement/hooks/useLedger";
import { formatMoney } from "@/shared/utils/money";
import { ReceiptDialog } from "./ReceiptDialog";
import type { ExpenseNavigation } from "../types";

export function ExpensesPage({
  month,
  ledger,
  onChanged,
  navigation,
  onNavigationHandled,
}: {
  month: string;
  ledger: LedgerWorkspace;
  onChanged: () => void;
  navigation?: ExpenseNavigation | null;
  onNavigationHandled?: () => void;
}) {
  const [editing, setEditing] = useState<Expense | null>(null),
    [linking, setLinking] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [receiptExpense, setReceiptExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!navigation) return;
    const expense = ledger.expenses.find(row => row.id === navigation.expenseId && row.settlementMonth === month);
    if (expense) {
      setSearch("");
      if (navigation.action === "link") setLinking(expense);
      else setReceiptExpense(expense);
    }
    onNavigationHandled?.();
  }, [navigation, ledger.expenses, month, onNavigationHandled]);
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await window.chagok.deleteExpense(deleting.id);
      setDeleting(null);
      onChanged();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const expenses = ledger.expenses.filter(
    row => row.settlementMonth === month && `${row.description} ${row.paidBy} ${row.note}`.includes(search),
  );
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>별도 지출</CardTitle>
          <CardDescription>
            지출 사용액을 정산에 반영합니다. 통장 출금을 연결하면 연결 금액만큼 통장 쪽의 비용이 줄어듭니다.
          </CardDescription>
          <Input
            aria-label="별도 지출 검색"
            placeholder="내용·결제자 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {["사용일", "내용 / 항목", "결제자 / 수단", "구분", "금액", "통장 연결", "작업"].map(title => (
                  <TableHead key={title}>{title}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map(expense => {
                const linked = ledger.links
                  .filter(row => row.expenseId === expense.id)
                  .reduce((sum, row) => sum + row.amount, 0);
                return (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.occurredOn}</TableCell>
                    <TableCell>
                      <div className="font-medium">{expense.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {ledger.categories.find(row => row.id === expense.categoryId)?.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expense.paidBy}
                      <div className="text-xs text-muted-foreground">{expense.paymentMethod}</div>
                    </TableCell>
                    <TableCell>{{ cash: "현금", card: "카드", other: "기타" }[expense.group]}</TableCell>
                    <TableCell>{formatMoney(expense.amount)}원</TableCell>
                    <TableCell>
                      {formatMoney(linked)}원 /{" "}
                      {linked === expense.amount ? "전체 연결" : linked ? "일부 연결" : "미연결"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ledger.closed}
                          onClick={() => setEditing(expense)}
                        >
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ledger.closed}
                          onClick={() => setLinking(expense)}
                          data-tutorial-target={expense.id === expenses[0]?.id ? "links" : undefined}
                        >
                          연결
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReceiptExpense(expense)}
                        >
                          영수증
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ledger.closed}
                          onClick={() => setDeleting(expense)}
                        >
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!expenses.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    등록된 지출이 없습니다. 지출 추가에서 기록해 주세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {editing && (
        <ExpenseEditor
          month={month}
          expense={editing}
          categories={ledger.categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {linking && (
        <PaymentLinkDialog
          expense={linking}
          ledger={ledger}
          onClose={() => setLinking(null)}
          onChanged={onChanged}
        />
      )}
      {receiptExpense && (
        <ReceiptDialog
          expense={receiptExpense}
          closed={ledger.closed}
          onClose={() => setReceiptExpense(null)}
          onChanged={onChanged}
        />
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={open => {
            if (!open && !busy) setDeleting(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>지출을 삭제할까요?</DialogTitle>
              <DialogDescription>
                {deleting.description} · {formatMoney(deleting.amount)}원. 통장 연결과 영수증 참조를 함께 제거하고 삭제
                이력은 보관합니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void remove()}
              >
                지출 삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function PaymentLinkDialog({
  expense,
  ledger,
  onClose,
  onChanged,
}: {
  expense: Expense;
  ledger: LedgerWorkspace;
  onClose: () => void;
  onChanged: () => void;
}) {
  const candidates = ledger.classifications.filter(
    row => row.direction === "expense" && row.withdrawal !== null && row.deposit === 0,
  );
  const links = ledger.links.filter(row => row.expenseId === expense.id);
  const [transactionId, setTransactionId] = useState(candidates[0]?.transactionId ?? ""),
    [amount, setAmount] = useState(expense.amount);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function save(id: string, amount: number) {
    setBusy(true);
    setError(null);
    try {
      await window.chagok.savePaymentLink({ expenseId: expense.id, transactionId: id, amount });
      onChanged();
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>통장 출금 연결</DialogTitle>
          <DialogDescription>
            {expense.description} · {formatMoney(expense.amount)}원. 카드대금 한 건에 여러 사용 건을 연결할 수 있습니다.
            사용월과 출금월이 달라도 사용액은 지출의 정산월에 반영됩니다.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="link-transaction">지출로 분류한 통장 출금</FieldLabel>
            <NativeSelect
              id="link-transaction"
              value={transactionId}
              onChange={e => setTransactionId(e.target.value)}
            >
              <NativeSelectOption value="">선택해 주세요</NativeSelectOption>
              {candidates.map(row => (
                <NativeSelectOption
                  key={row.transactionId}
                  value={row.transactionId}
                >
                  {row.settlementMonth} · {row.description || row.transactionId.slice(0, 8)} ·{" "}
                  {formatMoney(row.withdrawal)}원
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="link-amount">이번 지출에 연결할 금액 (원)</FieldLabel>
            <Input
              id="link-amount"
              type="number"
              min="1"
              step="1"
              value={amount || ""}
              onChange={e => setAmount(Number(e.target.value))}
            />
          </Field>
          {links.length > 0 && (
            <ItemGroup className="gap-2">
              {links.map(row => (
                <Item
                  role="listitem"
                  variant="outline"
                  key={row.transactionId}
                >
                  <ItemContent>
                    <ItemTitle className="line-clamp-none font-normal">
                      {ledger.classifications.find(c => c.transactionId === row.transactionId)?.description} ·{" "}
                      {formatMoney(row.amount)}원 연결
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void save(row.transactionId, 0)}
                    >
                      연결 해제
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            disabled={busy || !transactionId || amount < 1}
            onClick={() => void save(transactionId, amount)}
          >
            연결 저장
          </Button>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
