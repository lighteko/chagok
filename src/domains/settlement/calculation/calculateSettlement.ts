import type { Allocation, LedgerEntry, SettlementReport, SettlementSettings } from "@/shared/desktop/ledger";

function safe(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("정산 금액이 안전하게 계산할 수 있는 범위를 넘었습니다.");
  return value;
}

/** 정수 원 단위. 음수 잔액도 부호를 유지하며 배분 합계가 잔액과 정확하게 일치합니다. */
export function allocate(net: number, settings: SettlementSettings): (Allocation & { amount: number })[] {
  safe(net);
  if (!settings.allocations.length) return [];
  const magnitude = BigInt(Math.abs(net));
  const shares = settings.allocations.map((rule, index) => {
    const product = magnitude * BigInt(rule.basisPoints);
    return { ...rule, index, remainder: product % 10000n, amount: Number(product / 10000n) };
  });
  let rest = Math.abs(net) - shares.reduce((sum, row) => sum + row.amount, 0);
  if (settings.rounding === "last-recipient") shares[shares.length - 1].amount += rest;
  else {
    const ranked = [...shares].sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    );
    for (let i = 0; rest > 0; i++, rest--) ranked[i % ranked.length].amount++;
  }
  return shares.map(({ id, recipient, basisPoints, amount }) => ({
    id,
    recipient,
    basisPoints,
    amount: net < 0 && amount !== 0 ? -amount : amount,
  }));
}

export function calculateSettlement(
  month: string,
  entries: LedgerEntry[],
  settings: SettlementSettings,
): SettlementReport {
  let income = 0;
  const expenses = { cash: 0, card: 0, other: 0 };
  let pending = 0;
  for (const row of entries) {
    if (
      !row.confirmed ||
      row.direction === "unclassified" ||
      (row.amount === null && !["excluded", "transfer"].includes(row.direction))
    )
      pending++;
    if (row.amount === null) continue;
    if (row.direction === "income") income = safe(income + row.amount);
    if (row.direction === "expense") expenses[row.group] = safe(expenses[row.group] + row.amount);
  }
  const totalExpenses = safe(expenses.cash + expenses.card + expenses.other);
  const net = safe(income - totalExpenses);
  return {
    month,
    entries,
    income,
    expenses,
    totalExpenses,
    net,
    pending,
    settings,
    allocations: allocate(net, settings),
  };
}
