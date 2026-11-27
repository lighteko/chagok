import { useState } from "react";
import { Button } from "@/atomics/atoms/button";
import { Input } from "@/atomics/atoms/input";
import { Field, FieldLabel } from "@/atomics/atoms/field";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/atomics/atoms/item";
import { Checkbox } from "@/atomics/atoms/checkbox";
import { NativeSelect, NativeSelectOption } from "@/atomics/atoms/native-select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/atomics/atoms/card";
import { Alert, AlertDescription } from "@/atomics/atoms/alert";
import type { LedgerWorkspace, ClassificationRule, BulkClassification } from "@/shared/desktop/ledger";
import { errorText } from "../hooks/useLedger";

export function BulkClassificationForm({
  ids,
  month,
  ledger,
  onChanged,
}: {
  ids: string[];
  month: string;
  ledger: LedgerWorkspace;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<Omit<BulkClassification, "ids">>({
    direction: "expense",
    categoryId: null,
    group: "other",
    settlementMonth: month,
    note: "",
    confirmed: false,
  });
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await window.chagok.bulkClassifyTransactions({ ...form, ids });
      onChanged();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <p className="font-medium">선택한 통장 거래 {ids.length}건 일괄 분류</p>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="일괄 분류"
          value={form.direction}
          onChange={e => setForm({ ...form, direction: e.target.value as BulkClassification["direction"] })}
        >
          {[
            ["income", "수입"],
            ["expense", "지출"],
            ["transfer", "이체"],
            ["excluded", "정산 제외"],
          ].map(([id, name]) => (
            <NativeSelectOption
              key={id}
              value={id}
            >
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="일괄 정산 항목"
          value={form.categoryId ?? ""}
          onChange={e => setForm({ ...form, categoryId: e.target.value || null })}
        >
          <NativeSelectOption value="">항목 선택</NativeSelectOption>
          {ledger.categories.map(row => (
            <NativeSelectOption
              key={row.id}
              value={row.id}
            >
              {row.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="일괄 지출 구분"
          value={form.group}
          onChange={e => setForm({ ...form, group: e.target.value as BulkClassification["group"] })}
        >
          <NativeSelectOption value="cash">현금</NativeSelectOption>
          <NativeSelectOption value="card">카드</NativeSelectOption>
          <NativeSelectOption value="other">기타</NativeSelectOption>
        </NativeSelect>
        <Input
          className="w-40"
          type="month"
          aria-label="일괄 정산월"
          value={form.settlementMonth}
          onChange={e => setForm({ ...form, settlementMonth: e.target.value })}
        />
      </div>
      <Input
        aria-label="일괄 검토 사유"
        placeholder="검토·보정·제외 사유"
        maxLength={2000}
        value={form.note}
        onChange={e => setForm({ ...form, note: e.target.value })}
      />
      <Field orientation="horizontal">
        <Checkbox
          id="bulk-confirm"
          checked={form.confirmed}
          onCheckedChange={checked => setForm({ ...form, confirmed: Boolean(checked) })}
        />
        <FieldLabel htmlFor="bulk-confirm">선택 거래의 금액과 분류를 모두 확인했습니다</FieldLabel>
      </Field>
      <p className="text-xs text-muted-foreground">
        누락 금액은 개별 거래에서 보정해 주세요. 한 건이라도 검증에 실패하면 전체 변경을 취소합니다.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        className="w-fit"
        disabled={!ids.length || busy || ledger.closed}
        onClick={() => void save()}
      >
        선택 거래에 적용
      </Button>
    </div>
  );
}

export function ClassificationTools({
  month,
  ledger,
  onChanged,
}: {
  month: string;
  ledger: LedgerWorkspace;
  onChanged: () => void;
}) {
  const emptyRule = (): ClassificationRule => ({
    id: crypto.randomUUID(),
    name: "",
    field: "description",
    contains: "",
    direction: "expense",
    categoryId: null,
    group: "other",
    enabled: true,
  });
  const [rule, setRule] = useState(emptyRule),
    [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function run(action: () => Promise<unknown>, done?: () => void) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await action();
      done?.();
      onChanged();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
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
      <Card>
        <CardHeader>
          <CardTitle>반복 거래 규칙</CardTitle>
          <CardDescription>
            등록 순서대로 첫 번째 일치 규칙을 제안합니다. 이미 분류한 거래를 덮어쓰지 않으며 제안은 확인 후 확정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button
            className="w-fit"
            variant="outline"
            disabled={busy || ledger.closed}
            onClick={() =>
              void run(async () => {
                const count = await window.chagok.suggestClassificationRules(month);
                setNotice(`${count}건에 분류를 제안했습니다. 분류·확인에서 검토해 주세요.`);
              })
            }
          >
            이번 달 미분류에 규칙 제안
          </Button>
          {ledger.rules.length > 0 && (
            <ItemGroup>
              {ledger.rules.map(row => (
                <Item
                  key={row.id}
                  role="listitem"
                  variant="outline"
                >
                  <ItemContent>
                    <ItemTitle className="line-clamp-none">
                      {row.name} {row.enabled ? "" : "(중지)"}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-none text-xs">
                      {row.field}에 ‘{row.contains}’ 포함 → {row.direction} ·{" "}
                      {ledger.categories.find(c => c.id === row.categoryId)?.name ?? "항목 없음"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="flex-wrap gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRule(row)}
                    >
                      편집
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(() => window.chagok.saveClassificationRule({ ...row, enabled: !row.enabled }))
                      }
                    >
                      {row.enabled ? "중지" : "사용"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => window.chagok.deleteClassificationRule(row.id))}
                    >
                      삭제
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
          <form
            className="grid gap-3 border-t pt-4"
            onSubmit={event => {
              event.preventDefault();
              void run(
                () => window.chagok.saveClassificationRule(rule),
                () => setRule(emptyRule()),
              );
            }}
          >
            <Field>
              <FieldLabel htmlFor="rule-name">규칙 이름</FieldLabel>
              <Input
                id="rule-name"
                required
                maxLength={100}
                value={rule.name}
                onChange={e => setRule({ ...rule, name: e.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <NativeSelect
                aria-label="규칙 검색 대상"
                value={rule.field}
                onChange={e => setRule({ ...rule, field: e.target.value as ClassificationRule["field"] })}
              >
                <NativeSelectOption value="description">거래 내용</NativeSelectOption>
                <NativeSelectOption value="memo">메모</NativeSelectOption>
                <NativeSelectOption value="counterparty">상대 예금주</NativeSelectOption>
              </NativeSelect>
              <Input
                aria-label="규칙 포함 문구"
                placeholder="포함하는 문구"
                required
                maxLength={120}
                value={rule.contains}
                onChange={e => setRule({ ...rule, contains: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <NativeSelect
                aria-label="규칙 분류"
                value={rule.direction}
                onChange={e => setRule({ ...rule, direction: e.target.value as ClassificationRule["direction"] })}
              >
                {[
                  ["income", "수입"],
                  ["expense", "지출"],
                  ["transfer", "이체"],
                  ["excluded", "정산 제외"],
                ].map(([id, name]) => (
                  <NativeSelectOption
                    key={id}
                    value={id}
                  >
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="규칙 정산 항목"
                value={rule.categoryId ?? ""}
                onChange={e => setRule({ ...rule, categoryId: e.target.value || null })}
              >
                <NativeSelectOption value="">항목 선택</NativeSelectOption>
                {ledger.categories.map(row => (
                  <NativeSelectOption
                    key={row.id}
                    value={row.id}
                  >
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="규칙 지출 구분"
                value={rule.group}
                onChange={e => setRule({ ...rule, group: e.target.value as ClassificationRule["group"] })}
              >
                <NativeSelectOption value="cash">현금</NativeSelectOption>
                <NativeSelectOption value="card">카드</NativeSelectOption>
                <NativeSelectOption value="other">기타</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                type="submit"
              >
                규칙 저장
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setRule(emptyRule())}
              >
                새 규칙
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>정산 항목</CardTitle>
          <CardDescription>필요한 수입·지출 용도를 추가합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm">{ledger.categories.map(row => row.name).join(" · ")}</p>
          <form
            className="flex gap-2"
            onSubmit={event => {
              event.preventDefault();
              void run(
                () => window.chagok.saveCategory({ id: crypto.randomUUID(), name }),
                () => setName(""),
              );
            }}
          >
            <Input
              aria-label="새 정산 항목"
              value={name}
              maxLength={100}
              required
              placeholder="항목 이름"
              onChange={e => setName(e.target.value)}
            />
            <Button
              disabled={busy}
              type="submit"
            >
              항목 추가
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
