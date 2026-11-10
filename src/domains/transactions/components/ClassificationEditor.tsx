import { useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Input } from "@/atomics/atoms/input";
import { Label } from "@/atomics/atoms/label";
import { Checkbox } from "@/atomics/atoms/checkbox";
import { Textarea } from "@/atomics/atoms/textarea";
import { NativeSelect, NativeSelectOption } from "@/atomics/atoms/native-select";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import type { Classification, LedgerWorkspace } from "@/shared/desktop/ledger";
import type { TransactionDetail } from "@/shared/desktop/transactions";
import { errorText } from "@/domains/settlement/hooks/useLedger";

export function ClassificationEditor({
  detail,
  ledger,
  onSaved,
}: {
  detail: TransactionDetail;
  ledger: LedgerWorkspace;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Classification>(
    () =>
      ledger.classifications.find(row => row.transactionId === detail.id) ?? {
        transactionId: detail.id,
        direction: detail.deposit && !detail.withdrawal ? "income" : "expense",
        group: "other",
        categoryId: null,
        settlementMonth: detail.occurredAt.slice(0, 7),
        withdrawal: detail.withdrawal,
        deposit: detail.deposit,
        description: detail.description,
        confirmed: false,
        note: "",
        ruleId: null,
      },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  function field<K extends keyof Classification>(key: K, value: Classification[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
  }
  const isClosed = ledger.snapshots.some(row => !row.reopenedAt && row.month === form.settlementMonth);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await window.chagok.classifyTransaction(form);
      onSaved();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="grid gap-4 border-t pt-4"
      onSubmit={event => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <h3 className="font-semibold">정산 분류·보정</h3>
        <p className="text-sm text-muted-foreground">보정 값은 정산에 사용하며 아래의 엑셀 원본은 보존합니다.</p>
      </div>
      {form.ruleId && <p className="text-sm text-muted-foreground">{form.note} · 제안을 검토한 뒤 확정해 주세요.</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="class-direction">분류</Label>
          <NativeSelect
            id="class-direction"
            value={form.direction}
            onChange={e => field("direction", e.target.value as Classification["direction"])}
          >
            {[
              ["income", "수입"],
              ["expense", "지출"],
              ["transfer", "이체"],
              ["excluded", "정산 제외"],
            ].map(([id, label]) => (
              <NativeSelectOption
                key={id}
                value={id}
              >
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="class-month">정산월</Label>
          <Input
            id="class-month"
            type="month"
            required
            value={form.settlementMonth}
            onChange={e => field("settlementMonth", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="class-category">정산 항목</Label>
          <NativeSelect
            id="class-category"
            value={form.categoryId ?? ""}
            onChange={e => field("categoryId", e.target.value || null)}
          >
            <NativeSelectOption value="">선택해 주세요</NativeSelectOption>
            {ledger.categories.map(row => (
              <NativeSelectOption
                key={row.id}
                value={row.id}
              >
                {row.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="class-group">지출 구분</Label>
          <NativeSelect
            id="class-group"
            value={form.group}
            onChange={e => field("group", e.target.value as Classification["group"])}
          >
            <NativeSelectOption value="cash">현금</NativeSelectOption>
            <NativeSelectOption value="card">카드</NativeSelectOption>
            <NativeSelectOption value="other">기타</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["withdrawal", "deposit"] as const).map(key => (
          <div
            className="grid gap-2"
            key={key}
          >
            <Label htmlFor={`class-${key}`}>{key === "withdrawal" ? "출금" : "입금"} 보정 (원)</Label>
            <Input
              id={`class-${key}`}
              type="number"
              min="0"
              step="1"
              value={form[key] ?? ""}
              placeholder="미확인"
              onChange={e => field(key, e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="class-description">정산 내용</Label>
        <Input
          id="class-description"
          maxLength={500}
          value={form.description}
          onChange={e => field("description", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="class-note">검토·보정·제외 사유</Label>
        <Textarea
          id="class-note"
          maxLength={2000}
          value={form.note}
          onChange={e => field("note", e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="class-confirmed"
          checked={form.confirmed}
          onCheckedChange={checked => field("confirmed", Boolean(checked))}
        />
        <Label htmlFor="class-confirmed">금액과 분류를 확인했습니다</Label>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        disabled={busy || isClosed}
        type="submit"
      >
        {isClosed ? "마감된 월" : busy ? "저장 중…" : "분류·보정 저장"}
      </Button>
    </form>
  );
}
