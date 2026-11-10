import type { Classification, Expense, ClassificationRule, SettlementSettings } from "@/shared/desktop/ledger";
import { isValidMonth } from "@/shared/utils/month";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("입력 값을 확인해 주세요.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 500, required = true): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()))
    throw new Error(`${label} 값을 확인해 주세요.`);
  return value.trim();
}
export function id(value: unknown): string {
  return text(value, "식별자", 64);
}
export function month(value: unknown): string {
  if (!isValidMonth(value)) throw new Error("정산월을 확인해 주세요.");
  return value;
}
export function amount(value: unknown, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("금액은 0 이상의 정수 원 단위로 입력해 주세요.");
  return value as number;
}
function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("확인 상태를 확인해 주세요.");
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new Error("선택 값을 확인해 주세요.");
  return value as T;
}
export function classification(value: unknown): Classification {
  const v = object(value);
  const result: Classification = {
    transactionId: id(v.transactionId),
    direction: choice(v.direction, ["income", "expense", "transfer", "excluded"]),
    categoryId: v.categoryId === null ? null : id(v.categoryId),
    group: choice(v.group, ["cash", "card", "other"]),
    settlementMonth: month(v.settlementMonth),
    withdrawal: amount(v.withdrawal, true),
    deposit: amount(v.deposit, true),
    description: text(v.description, "내용", 500, false),
    note: text(v.note, "사유", 2000, false),
    confirmed: flag(v.confirmed),
    // 적용 근거는 메인 프로세스가 생성합니다. 수동 수정은 규칙과 분리합니다.
    ruleId: null,
  };
  if (result.direction === "excluded" && !result.note) throw new Error("정산 제외 사유를 입력해 주세요.");
  if (["income", "expense"].includes(result.direction) && !result.categoryId)
    throw new Error("정산 항목을 선택해 주세요.");
  if (result.confirmed && result.direction !== "excluded") {
    if (result.withdrawal === null || result.deposit === null)
      throw new Error("입금과 출금의 누락 금액을 보정한 뒤 확정해 주세요.");
    if (result.direction === "income" && result.withdrawal !== 0)
      throw new Error("출금이 있는 거래는 수입으로 확정할 수 없습니다.");
    if (result.direction === "expense" && result.deposit !== 0)
      throw new Error("입금이 있는 거래는 지출로 확정할 수 없습니다.");
  }
  return result;
}
export function expense(value: unknown): Expense {
  const v = object(value);
  const occurredOn = text(v.occurredOn, "사용일", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) ||
    !isValidMonth(occurredOn.slice(0, 7)) ||
    new Date(`${occurredOn}T00:00:00Z`).toISOString().slice(0, 10) !== occurredOn
  )
    throw new Error("유효한 사용일을 입력해 주세요.");
  const result: Expense = {
    id: id(v.id),
    occurredOn,
    settlementMonth: month(v.settlementMonth),
    amount: amount(v.amount)!,
    description: text(v.description, "내용"),
    group: choice(v.group, ["cash", "card", "other"]),
    categoryId: id(v.categoryId),
    paidBy: text(v.paidBy, "결제자", 100),
    paymentMethod: text(v.paymentMethod, "결제수단", 100),
    note: text(v.note, "메모", 2000, false),
  };
  if (!result.amount) throw new Error("지출 금액은 1원 이상이어야 합니다.");
  return result;
}
export function rule(value: unknown): ClassificationRule {
  const v = object(value);
  const result: ClassificationRule = {
    id: id(v.id),
    name: text(v.name, "규칙 이름", 100),
    field: choice(v.field, ["description", "memo", "counterparty"]),
    contains: text(v.contains, "검색어", 120),
    direction: choice(v.direction, ["income", "expense", "transfer", "excluded"]),
    categoryId: v.categoryId === null ? null : id(v.categoryId),
    group: choice(v.group, ["cash", "card", "other"]),
    enabled: flag(v.enabled),
  };
  if (["income", "expense"].includes(result.direction) && !result.categoryId)
    throw new Error("정산 항목을 선택해 주세요.");
  return result;
}
export function settings(value: unknown): SettlementSettings {
  const v = object(value);
  if (!Array.isArray(v.allocations) || v.allocations.length < 1 || v.allocations.length > 20)
    throw new Error("배분 대상은 1~20명으로 설정해 주세요.");
  const allocations = v.allocations.map(value => {
    const row = object(value);
    return { id: id(row.id), recipient: text(row.recipient, "배분 대상", 100), basisPoints: amount(row.basisPoints)! };
  });
  if (
    allocations.reduce((sum, row) => sum + row.basisPoints, 0) !== 10000 ||
    new Set(allocations.map(row => row.id)).size !== allocations.length
  )
    throw new Error("배분 비율의 합계는 100%여야 하고 대상 ID는 중복될 수 없습니다.");
  return { allocations, rounding: choice(v.rounding, ["largest-remainder", "last-recipient"]) };
}
