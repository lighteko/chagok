import type { Cell, CellObject, SheetData } from "write-excel-file/node";
import type { SettlementReport, LedgerEntry } from "@/shared/desktop/ledger";

const style: CellObject = { borderStyle: "thin", borderColor: "#B8B8B8", alignVertical: "center", height: 22 };
const text = (value: string, extra: CellObject = {}): CellObject => ({
  ...style,
  type: String,
  value,
  wrap: true,
  ...extra,
});
const amount = (value: number): CellObject => ({
  ...style,
  type: Number,
  value,
  format: "#,##0;[Red]-#,##0;0",
  align: "right",
});
const heading = (value: string, columnSpan = 1): CellObject =>
  text(value, { fontWeight: "bold", backgroundColor: "#E8ECEF", align: "center", columnSpan, height: 28 });
const date = (value: string): CellObject => ({
  ...style,
  type: Date,
  value: new Date(`${value}T00:00:00Z`),
  format: "yyyy-mm-dd",
});

/** 첨부 정산 양식의 A:E 수입 / F:H 현금 / I:K 카드 / L:N 기타 배치를 유지합니다. */
export function buildSettlementWorkbook(report: SettlementReport, closed: boolean) {
  const income = report.entries.filter(row => row.direction === "income" && row.amount !== null);
  const group = (group: string) =>
    report.entries.filter(
      row => row.direction === "expense" && row.group === group && row.amount !== null && row.amount !== 0,
    );
  const cash = group("cash"),
    card = group("card"),
    other = group("other");
  const incomeEnd = Math.max(34, 3 + income.length),
    cashEnd = Math.max(34, 3 + cash.length),
    cardEnd = Math.max(26, 3 + card.length),
    otherEnd = Math.max(19, 3 + other.length);
  const cashSummary = Math.max(36, cashEnd + 2),
    incomeSummary = cardEnd + 3,
    netRow = cardEnd + 6;
  const length = Math.max(incomeEnd, cashSummary + 5, netRow + report.allocations.length * 3, otherEnd + 2) + 4;
  if (length > 1048576) throw new Error("정산 내역이 엑셀 최대 행 수를 초과합니다.");
  const data: SheetData = Array.from({ length }, () => Array<Cell>(14).fill(null));
  const put = (row: number, col: number, cell: Cell) => {
    data[row - 1][col - 1] = cell;
  };
  const monthNumber = Number(report.month.slice(5));
  put(
    1,
    1,
    text(`${report.month} · ${closed ? "마감 정산표" : "잠정 정산표"}`, {
      columnSpan: 14,
      fontWeight: "bold",
      height: 28,
    }),
  );
  put(2, 1, heading(`${monthNumber}월수입.`, 5));
  put(2, 6, heading("현금지출", 3));
  put(2, 9, heading("카드지출", 3));
  put(2, 12, heading("기타지출", 3));
  ["거래일시", "출금", "입금", "총액", "내용"].forEach((label, index) => put(3, index + 1, heading(label)));
  for (const start of [6, 9, 12]) {
    put(3, start, heading("사용일"));
    put(3, start + 1, heading("금액"));
    put(3, start + 2, heading("내용 / 결제자"));
  }
  let cumulative = 0;
  income.forEach((row, index) => {
    const line = index + 4;
    cumulative += row.amount!;
    put(line, 1, date(row.occurredOn));
    put(line, 2, amount(0));
    put(line, 3, amount(row.amount!));
    put(line, 4, amount(cumulative));
    put(line, 5, text(row.description));
  });
  function expenses(rows: LedgerEntry[], start: number) {
    rows.forEach((row, index) => {
      put(index + 4, start, date(row.occurredOn));
      put(index + 4, start + 1, amount(row.amount!));
      put(index + 4, start + 2, text(`${row.description}${row.paidBy ? ` / ${row.paidBy}` : ""}`));
    });
  }
  expenses(cash, 6);
  expenses(card, 9);
  expenses(other, 12);
  // 첫 사용 행부터 마지막 사용 행까지 동일한 기준으로 집계합니다. 원본 양식의 범위 불일치는 옮기지 않습니다.
  put(otherEnd + 1, 13, heading("총"));
  put(otherEnd + 1, 14, amount(report.expenses.other));
  put(cardEnd + 1, 10, heading("총"));
  put(cardEnd + 1, 11, amount(report.expenses.card));
  put(incomeSummary, 10, heading("수입"));
  put(incomeSummary, 11, amount(report.income));
  put(incomeSummary + 1, 10, heading("총지출"));
  put(incomeSummary + 1, 11, amount(report.totalExpenses));
  put(netRow, 10, heading("합"));
  put(netRow, 11, amount(report.net));
  report.allocations.forEach((allocation, index) => {
    put(netRow + 1 + index * 3, 10, heading(`${allocation.recipient} (${allocation.basisPoints / 100}%)`));
    put(netRow + 1 + index * 3, 11, amount(allocation.amount));
  });
  ["현금지출", "카드지출", "기타지출", "총"].forEach((label, index) => {
    put(cashSummary + index, 6, heading(label, 2));
    put(
      cashSummary + index,
      8,
      amount([report.expenses.cash, report.expenses.card, report.expenses.other, report.totalExpenses][index]),
    );
  });
  const noteRow = Math.max(incomeEnd, cashSummary + 3, netRow + report.allocations.length * 3, otherEnd + 1) + 2;
  put(
    noteRow,
    1,
    text(
      `확인할 내역 ${report.pending}건 · ${closed ? "마감본 기준" : "잠정 금액: 미확정 분류 제안 포함"} · 통장 출금에서 연결된 별도 지출 금액 차감`,
      { columnSpan: 14, height: 30 },
    ),
  );
  put(
    noteRow + 1,
    1,
    text(
      report.allocations.length === 0
        ? "배분 설정 없음"
        : report.settings.rounding === "largest-remainder"
          ? "배분: 원 미만 절사 후 소수 잔여가 큰 순서로 1원씩 배분. 동률은 대상 순서. 음수는 손실 배분."
          : "배분: 원 미만 절사 후 잔여 금액을 마지막 대상에 배분. 음수는 손실 배분.",
      { columnSpan: 14, height: 30 },
    ),
  );
  const details: SheetData = [
    [
      "사용일",
      "정산월",
      "출처",
      "내용",
      "분류",
      "항목",
      "지출구분",
      "정산금액",
      "연결금액",
      "확정",
      "결제자",
      "검토 사유",
      "기록 ID",
    ].map(value => heading(value)),
  ];
  const labels = { income: "수입", expense: "지출", transfer: "이체", excluded: "정산 제외", unclassified: "미분류" };
  for (const row of report.entries)
    details.push([
      date(row.occurredOn),
      text(row.settlementMonth),
      text(row.source === "bank" ? "통장" : "별도 지출"),
      text(row.description),
      text(labels[row.direction]),
      text(row.categoryName),
      text({ cash: "현금", card: "카드", other: "기타" }[row.group]),
      row.amount === null ? null : amount(row.amount),
      amount(row.linkedAmount),
      text(row.confirmed ? "확인 완료" : "확인 필요"),
      text(row.paidBy),
      text(row.note),
      text(row.id),
    ]);
  return [
    {
      sheet: `${report.month.slice(2, 4)}.${report.month.slice(5)}`,
      data,
      showGridLines: false,
      columns: [15.875, 9.625, 10.625, 10.625, 18, 16.875, 16.875, 24, 18, 18, 24, 16.125, 14, 24].map(width => ({
        width,
      })),
      stickyRowsCount: 3,
    },
    {
      sheet: "정산 상세",
      data: details,
      columns: [16, 13, 15, 30, 14, 18, 13, 18, 18, 16, 20, 48, 38].map(width => ({ width })),
      stickyRowsCount: 1,
    },
  ];
}
