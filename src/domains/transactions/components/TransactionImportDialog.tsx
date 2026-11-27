import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/atomics/atoms/alert";
import { Badge } from "@/atomics/atoms/badge";
import { Button } from "@/atomics/atoms/button";
import { Checkbox } from "@/atomics/atoms/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/atomics/atoms/dialog";
import { Input } from "@/atomics/atoms/input";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/atomics/atoms/field";
import { NativeSelect, NativeSelectOption } from "@/atomics/atoms/native-select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/atomics/atoms/table";
import type { TransactionImportPreview, TransactionImportResult } from "@/shared/desktop/transactions";
import { formatMoney } from "@/shared/utils/money";

export function TransactionImportDialog({
  preview,
  currentMonth,
  onClose,
  onSaved,
}: {
  preview: TransactionImportPreview;
  currentMonth: string;
  onClose: () => void;
  onSaved: (result: TransactionImportResult) => void;
}) {
  const [sheetId, setSheetId] = useState(preview.sheets[0].sheetId);
  const sheet = preview.sheets.find(sheet => sheet.sheetId === sheetId)!;
  const initialMonths = (id: string) => {
    const available = preview.sheets.find(sheet => sheet.sheetId === id)!.months.map(value => value.month);
    return [available.includes(currentMonth) ? currentMonth : available.at(-1)!];
  };
  const [months, setMonths] = useState(() => initialMonths(sheetId));
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = sheet.months.filter(value => months.includes(value.month)).reduce((sum, value) => sum + value.count, 0);
  const sample = sheet.rows.filter(row => months.includes(row.occurredAt.slice(0, 7))).slice(0, 10);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await window.chagok.commitTransactionImport({
        token: preview.token,
        sheetId,
        months,
        accountName,
      });
      onSaved(result);
    } catch {
      setError("거래를 저장하지 못했습니다. 기존 거래는 유지됩니다. 다시 시도하거나 파일을 다시 선택해 주세요.");
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-4xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>거래내역 미리보기</DialogTitle>
          <DialogDescription>{preview.fileName} · 저장 전에 계좌와 가져올 월을 확인해 주세요.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="import-account">계좌 이름</FieldLabel>
              <Input
                id="import-account"
                aria-describedby="import-account-help"
                placeholder="예: 운영 계좌"
                value={accountName}
                maxLength={80}
                disabled={saving}
                onChange={event => setAccountName(event.target.value)}
              />
              <FieldDescription
                id="import-account-help"
                className="text-xs"
              >
                같은 계좌는 항상 같은 이름을 사용하고, 다른 계좌는 구분해 주세요.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="import-sheet">가져올 시트</FieldLabel>
              <NativeSelect
                id="import-sheet"
                value={sheetId}
                disabled={saving}
                onChange={event => {
                  setSheetId(event.target.value);
                  setMonths(initialMonths(event.target.value));
                  setError(null);
                }}
              >
                <NativeSelectOption
                  value=""
                  disabled
                >
                  시트 선택
                </NativeSelectOption>
                {preview.sheets.map(sheet => (
                  <NativeSelectOption
                    key={sheet.sheetId}
                    value={sheet.sheetId}
                  >
                    {sheet.sheetName} ({sheet.total}건)
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
          <FieldSet disabled={saving}>
            <FieldLegend variant="label">가져올 월</FieldLegend>
            <FieldGroup className="flex-row flex-wrap gap-4">
              {sheet.months.map(value => (
                <Field
                  key={value.month}
                  orientation="horizontal"
                  className="w-fit"
                >
                  <Checkbox
                    id={`import-month-${value.month}`}
                    checked={months.includes(value.month)}
                    disabled={saving}
                    onCheckedChange={checked =>
                      setMonths(previous =>
                        checked ? [...previous, value.month] : previous.filter(month => month !== value.month),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`import-month-${value.month}`}>
                    {value.month}
                    <span className="text-xs text-muted-foreground">{value.count}건</span>
                  </FieldLabel>
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
          {(sheet.warnings.length > 0 || sheet.rejectedCount > 0 || preview.skippedSheets.length > 0) && (
            <Alert>
              <AlertTitle>확인할 내용</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1">
                  {sheet.warnings.map(warning => (
                    <li key={warning}>{warning}</li>
                  ))}
                  {sheet.rejectedCount > 0 && (
                    <li>
                      거래일시를 확인할 수 없는 {sheet.rejectedCount}행은 저장에서 제외됩니다.{" "}
                      {sheet.rejected
                        .slice(0, 5)
                        .map(row => `${row.row}행`)
                        .join(", ")}
                    </li>
                  )}
                  {preview.skippedSheets.length > 0 && (
                    <li>거래 양식이 없는 시트는 제외했습니다: {preview.skippedSheets.join(", ")}</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">선택한 거래 {count}건</Badge>
            <span className="text-xs text-muted-foreground">
              미리보기는 월별 최대 5건이며, 선택한 월의 전체 거래를 저장합니다.
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>원본 행</TableHead>
                <TableHead>거래일시</TableHead>
                <TableHead>거래 내용</TableHead>
                <TableHead className="text-right">출금</TableHead>
                <TableHead className="text-right">입금</TableHead>
                <TableHead>확인</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sample.map(row => (
                <TableRow key={row.sourceRow}>
                  <TableCell>{row.sourceRow}</TableCell>
                  <TableCell>{row.occurredAt}</TableCell>
                  <TableCell className="max-w-40 truncate">{row.description || "내용 없음"}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.withdrawal)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.deposit)}</TableCell>
                  <TableCell>{row.issues.length ? <Badge variant="destructive">확인 필요</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            같은 계좌에서 금액·잔액·거래 정보가 일치하는 기록은 중복 제외합니다. 누락 금액은 미확인 상태로 보존합니다.
          </p>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            취소
          </Button>
          <Button
            disabled={saving || !count || !accountName.trim()}
            onClick={() => void save()}
          >
            {saving ? "저장 중…" : `${count.toLocaleString()}건 저장`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
