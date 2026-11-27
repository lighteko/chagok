import { useEffect, useState } from "react";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/atomics/atoms/chart";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/atomics/atoms/card";
import { Empty, EmptyDescription, EmptyHeader } from "@/atomics/atoms/empty";
import { Button } from "@/atomics/atoms/button";
import type { SettlementReport } from "@/shared/desktop/ledger";
import { shiftMonth } from "@/shared/utils/month";
export interface EntryFilter {
  day?: string;
  categoryId?: string;
  direction?: "income" | "expense";
}
const config = {
  income: { label: "수입", color: "var(--chart-1)" },
  expense: { label: "지출", color: "var(--chart-2)" },
  amount: { label: "지출", color: "var(--chart-1)" },
};

export function SettlementCharts({
  report,
  onFilter,
  onMonth,
  revision,
}: {
  report: SettlementReport;
  onFilter: (filter: EntryFilter) => void;
  onMonth: (month: string) => void;
  revision: number;
}) {
  const [comparison, setComparison] = useState<{ month: string; income: number; expense: number; pending: number }[]>(
      [],
    ),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setComparison([]);
    const months = Array.from({ length: 6 }, (_, index) => shiftMonth(report.month, index - 5)).filter(
      month => month >= "1900-01",
    );
    void Promise.all(months.map(month => window.chagok.getLedger(month)))
      .then(values => {
        if (active)
          setComparison(
            values.map(value => ({
              month: value.report.month,
              income: value.report.income,
              expense: value.report.totalExpenses,
              pending: value.report.pending,
            })),
          );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [report.month, revision, retry]);
  const days = new Map<string, { day: string; income: number; expense: number }>();
  const categories = new Map<string, { categoryId: string; name: string; amount: number }>();
  for (const row of report.entries) {
    if (!["income", "expense"].includes(row.direction) || row.amount === null) continue;
    const day = row.occurredOn;
    const daily = days.get(day) ?? { day, income: 0, expense: 0 };
    if (row.direction === "income") daily.income += row.amount;
    else daily.expense += row.amount;
    days.set(day, daily);
    if (row.direction === "expense") {
      const categoryId = row.categoryId ?? "",
        category = categories.get(categoryId) ?? { categoryId, name: row.categoryName, amount: 0 };
      category.amount += row.amount;
      categories.set(categoryId, category);
    }
  }
  const daily = [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    breakdown = [...categories.values()].sort((a, b) => b.amount - a.amount);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>일별 수입·지출</CardTitle>
          <CardDescription>
            정산월에 포함된 자료의 사용일 기준입니다. 막대를 누르면 해당 내역을 보여줍니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {daily.length ? (
            <ChartContainer
              config={config}
              className="h-60 w-full"
            >
              <BarChart
                accessibilityLayer
                data={daily}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={value => String(value).slice(5)}
                  tickLine={false}
                />
                <YAxis
                  width={65}
                  tickFormatter={value => `${Number(value) / 10000}만`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={3}
                  onClick={data => onFilter({ day: String(data.payload.day), direction: "income" })}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  radius={3}
                  onClick={data => onFilter({ day: String(data.payload.day), direction: "expense" })}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <Empty className="py-20">
              <EmptyHeader>
                <EmptyDescription>분류한 수입·지출이 없습니다.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>지출 항목별 구성</CardTitle>
          <CardDescription>연결된 통장 출금의 중복 금액을 차감한 정산 지출입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {breakdown.length ? (
            <ChartContainer
              config={config}
              className="h-60 w-full"
            >
              <BarChart
                accessibilityLayer
                data={breakdown}
                layout="vertical"
              >
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={value => `${Number(value) / 10000}만`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={70}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="amount"
                  fill="var(--color-amount)"
                  radius={3}
                  onClick={data => onFilter({ categoryId: String(data.payload.categoryId), direction: "expense" })}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <Empty className="py-20">
              <EmptyHeader>
                <EmptyDescription>분류한 지출이 없습니다.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {breakdown.map(row => (
              <Button
                key={row.categoryId}
                variant="ghost"
                size="sm"
                onClick={() => onFilter({ categoryId: row.categoryId, direction: "expense" })}
              >
                {row.name} 내역
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>최근 6개월 비교</CardTitle>
          <CardDescription>미확정 월은 잠정 금액입니다. 막대를 누르면 해당 정산월로 이동합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {failed ? (
            <Button
              variant="outline"
              onClick={() => setRetry(value => value + 1)}
            >
              월별 비교 다시 불러오기
            </Button>
          ) : (
            <ChartContainer
              config={config}
              className="h-64 w-full"
            >
              <BarChart
                accessibilityLayer
                data={comparison}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis
                  width={65}
                  tickFormatter={value => `${Number(value) / 10000}만`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={3}
                  onClick={data => onMonth(String(data.payload.month))}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  radius={3}
                  onClick={data => onMonth(String(data.payload.month))}
                />
              </BarChart>
            </ChartContainer>
          )}
          <div className="flex flex-wrap gap-2">
            {comparison.map(row => (
              <Button
                key={row.month}
                variant="ghost"
                size="sm"
                onClick={() => onMonth(row.month)}
              >
                {row.month}
                {row.pending ? ` · 확인 ${row.pending}건` : ""}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
