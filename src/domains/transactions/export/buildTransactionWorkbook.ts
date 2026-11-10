import type { Cell, SheetData } from "write-excel-file/node";
import type { TransactionExportSnapshot } from "@/shared/desktop/transactions";

const text = (value: string): Cell => ({ value, type: String, alignVertical: "center" });
const amount = (value: number | null): Cell =>
  value === null
    ? null
    : { value, type: Number, format: "#,##0;[Red]-#,##0;0", align: "right", alignVertical: "center" };
const headers = (labels: string[]): Cell[] =>
  labels.map(value => ({
    value,
    type: String,
    fontWeight: "bold",
    backgroundColor: "#262626",
    textColor: "#FFFFFF",
    align: "center",
    alignVertical: "center",
    height: 26,
  }));

export function buildTransactionWorkbook({ month, rows, summary }: TransactionExportSnapshot) {
  const transactions: SheetData = [
    headers([
      "거래일시",
      "계좌 이름",
      "출금(원)",
      "입금(원)",
      "거래 후 잔액(원)",
      "거래 내용",
      "메모",
      "상대 예금주",
      "상대은행",
      "거래구분",
      "상태",
      "확인 사항",
      "원본 파일",
      "원본 시트",
      "원본 행",
    ]),
  ];
  for (const row of rows) {
    transactions.push([
      { value: new Date(`${row.occurredAt.replace(" ", "T")}Z`), type: Date, format: "yyyy-mm-dd hh:mm:ss" },
      text(row.accountName),
      amount(row.withdrawal),
      amount(row.deposit),
      amount(row.balance),
      text(row.description),
      text(row.memo),
      text(row.counterparty),
      text(row.bank),
      text(row.kind),
      {
        value: row.issues.length ? "확인 필요" : "미분류",
        type: String,
        textColor: row.issues.length ? "#B91C1C" : "#262626",
      },
      { value: row.issues.join(" / "), type: String, wrap: true },
      text(row.fileName),
      text(row.sheetName),
      { value: row.sourceRow, type: Number, format: "0" },
    ]);
  }
  const summaryData: SheetData = [
    headers(["항목", "값", "설명"]),
    [text("정산월"), text(month), text("검색·필터·페이지와 관계없이 선택한 달의 전체 거래")],
    [text("전체 거래 수"), amount(summary.count), text("원본 거래 기준")],
    [text("확인 필요 거래 수"), amount(summary.needsReview), text("금액 또는 거래 내용 등을 확인해야 하는 거래")],
    [text("금액 미확인 거래 수"), amount(summary.missingAmounts), text("빈 금액·잘못된 금액은 0원으로 바꾸지 않음")],
    [
      text("입금 합계(원)"),
      amount(summary.deposits),
      text(summary.missingAmounts ? "확인된 금액만 합산한 부분 합계" : "통장 입금 합계"),
    ],
    [
      text("출금 합계(원)"),
      amount(summary.withdrawals),
      text(summary.missingAmounts ? "확인된 금액만 합산한 부분 합계" : "통장 출금 합계"),
    ],
    [
      text("입출금 차액(원)"),
      amount(summary.difference),
      text(summary.missingAmounts ? "금액 미확인 거래가 있어 차액을 표시하지 않음" : "입금 합계 - 출금 합계"),
    ],
    [text("금액 기준"), text("통장 거래"), text("수입·비용·배분금으로 확정한 정산 결과와 구분")],
  ];
  return [
    {
      sheet: "거래내역",
      data: transactions,
      columns: [22, 20, 18, 18, 22, 30, 30, 24, 18, 18, 16, 42, 38, 24, 12].map(width => ({ width })),
      stickyRowsCount: 1,
      stickyColumnsCount: 2,
    },
    { sheet: "월별 요약", data: summaryData, columns: [27, 22, 70].map(width => ({ width })), stickyRowsCount: 1 },
  ];
}
