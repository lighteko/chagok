import { useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Input } from "@/atomics/atoms/input";
import { Field, FieldGroup, FieldLabel } from "@/atomics/atoms/field";
import { Textarea } from "@/atomics/atoms/textarea";
import { NativeSelect, NativeSelectOption } from "@/atomics/atoms/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/atomics/atoms/dialog";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import type { Expense, Category } from "@/shared/desktop/ledger";
import { errorText } from "@/domains/settlement/hooks/useLedger";

export function ExpenseEditor({
  month,
  expense,
  categories,
  onClose,
  onSaved,
}: {
  month: string;
  expense?: Expense;
  categories: Category[];
  onClose: () => void;
  onSaved: (expense: Expense) => void;
}) {
  const [form, setForm] = useState<Expense>(
    () =>
      expense ?? {
        id: crypto.randomUUID(),
        occurredOn: `${month}-01`,
        settlementMonth: month,
        amount: 0,
        description: "",
        group: "cash",
        categoryId: categories.find(row => row.name === "기타지출")?.id ?? categories[0]?.id ?? "",
        paidBy: "",
        paymentMethod: "현금",
        note: "",
      },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  function field<K extends keyof Expense>(key: K, value: Expense[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await window.chagok.saveExpense(form);
      onSaved(saved);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{expense ? "별도 지출 수정" : "별도 지출 추가"}</DialogTitle>
          <DialogDescription>
            사용일과 정산월을 따로 지정할 수 있습니다. 통장 출금 연결은 저장 후 선택합니다.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={event => {
            event.preventDefault();
            void save();
          }}
          className="grid gap-4"
        >
          <FieldGroup className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="expense-date">사용일</FieldLabel>
              <Input
                id="expense-date"
                type="date"
                required
                value={form.occurredOn}
                onChange={e => field("occurredOn", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="expense-month">정산월</FieldLabel>
              <Input
                id="expense-month"
                type="month"
                required
                value={form.settlementMonth}
                onChange={e => field("settlementMonth", e.target.value)}
              />
            </Field>
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor="expense-description">내용</FieldLabel>
            <Input
              id="expense-description"
              required
              maxLength={500}
              value={form.description}
              onChange={e => field("description", e.target.value)}
            />
          </Field>
          <FieldGroup className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="expense-amount">금액 (원)</FieldLabel>
              <Input
                id="expense-amount"
                type="number"
                min="1"
                step="1"
                required
                value={form.amount || ""}
                onChange={e => field("amount", Number(e.target.value))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="expense-group">지출 구분</FieldLabel>
              <NativeSelect
                id="expense-group"
                value={form.group}
                onChange={e => field("group", e.target.value as Expense["group"])}
              >
                <NativeSelectOption value="cash">현금</NativeSelectOption>
                <NativeSelectOption value="card">카드</NativeSelectOption>
                <NativeSelectOption value="other">기타</NativeSelectOption>
              </NativeSelect>
            </Field>
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor="expense-category">정산 항목</FieldLabel>
            <NativeSelect
              id="expense-category"
              value={form.categoryId}
              onChange={e => field("categoryId", e.target.value)}
            >
              {categories.map(row => (
                <NativeSelectOption
                  key={row.id}
                  value={row.id}
                >
                  {row.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <FieldGroup className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="expense-payer">결제자</FieldLabel>
              <Input
                id="expense-payer"
                required
                maxLength={100}
                value={form.paidBy}
                onChange={e => field("paidBy", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="expense-method">결제수단</FieldLabel>
              <Input
                id="expense-method"
                required
                maxLength={100}
                placeholder="현금 / 개인 카드 등"
                value={form.paymentMethod}
                onChange={e => field("paymentMethod", e.target.value)}
              />
            </Field>
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor="expense-note">메모</FieldLabel>
            <Textarea
              id="expense-note"
              maxLength={2000}
              value={form.note}
              onChange={e => field("note", e.target.value)}
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={busy}
            >
              {busy ? "저장 중…" : "지출 저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
