import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/atomics/atoms/card";
import type { TransactionList } from "@/shared/desktop/transactions";
import { formatMoney } from "@/shared/utils/money";

export function TransactionSummary({ summary }: { summary?: TransactionList["summary"] }) {
  const metrics = [
    {
      label: "입금 합계",
      value: summary?.deposits ?? null,
      detail: summary?.missingAmounts ? "확인된 금액만 합산" : "선택한 달의 통장 입금",
    },
    {
      label: "출금 합계",
      value: summary?.withdrawals ?? null,
      detail: summary?.missingAmounts ? "확인된 금액만 합산" : "선택한 달의 통장 출금",
    },
    { label: "입출금 차액", value: summary?.difference ?? null, detail: "통장 기준 · 정산 금액과 구분" },
  ];
  return (
    <section
      className="grid grid-cols-3 gap-4"
      aria-label="월별 요약"
    >
      {metrics.map(metric => (
        <Card
          key={metric.label}
          size="sm"
        >
          <CardHeader>
            <CardTitle>{metric.label}</CardTitle>
            <CardDescription>{metric.detail}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(metric.value)} <span className="text-sm font-normal text-muted-foreground">원</span>
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
