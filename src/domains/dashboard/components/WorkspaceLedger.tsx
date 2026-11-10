import { FileSpreadsheet, Receipt, Search, SlidersHorizontal, Upload } from "lucide-react";
import { Button } from "@/atomics/atoms/Button";

export function WorkspaceLedger({ mode }: { mode: "transactions" | "expenses" }) {
  const expenses = mode === "expenses";
  const columns = expenses
    ? ["사용일", "지출 내용", "지출 구분", "결제자", "금액"]
    : ["거래일시", "거래 내용", "분류", "출금", "입금", "정산 반영"];
  const Icon = expenses ? Receipt : FileSpreadsheet;
  return (
    <section
      aria-label={expenses ? "별도 지출 목록" : "거래 목록"}
      className="flex min-h-[380px] flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[13px] font-semibold">{expenses ? "별도 지출" : "전체 거래"}</h2>
          <span className="rounded bg-background px-1.5 py-0.5 text-[11px] text-muted">0건</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-muted">
            <Search
              size={14}
              aria-hidden="true"
            />
            <input
              aria-label={expenses ? "지출 내용 검색" : "거래 내용 검색"}
              placeholder={expenses ? "지출 내용 검색" : "거래 내용 검색"}
              disabled
              className="w-36 border-0 bg-transparent text-[12px] outline-none disabled:cursor-not-allowed"
            />
          </label>
          <Button
            variant="secondary"
            disabled
            className="h-8 px-2.5"
            aria-label="분류 필터"
          >
            <SlidersHorizontal
              size={13}
              aria-hidden="true"
            />
            <span className="text-[12px]">전체 분류</span>
          </Button>
        </div>
      </div>
      <div className="shrink-0 overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed text-left text-[12px]">
          <caption className="sr-only">선택한 정산월의 {expenses ? "별도 지출" : "통장 거래"}</caption>
          <thead className="border-b border-line bg-background/60 text-[11px] font-normal text-muted">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`${index === 1 ? "w-[28%]" : ""} px-5 py-3 font-medium ${column === "출금" || column === "입금" || column === "금액" ? "text-right" : ""}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
      <div className="flex min-h-[210px] flex-1 flex-col items-center justify-center px-5 py-4 text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon
            size={21}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <h3 className="mt-3 text-[14px] font-medium">
          {expenses ? "등록된 별도 지출이 없습니다" : "이 달의 거래내역이 없습니다"}
        </h3>
        <p className="mt-1.5 max-w-sm whitespace-pre-line text-[12px] leading-5 text-muted">
          {expenses
            ? "통장에 없는 현금·카드 지출을 기록하는 곳입니다."
            : "통장에서 내려받은 거래내역 파일을 가져오면\n이곳에서 거래를 확인하고 분류할 수 있습니다."}
        </p>
        {!expenses && (
          <Button
            className="mt-4"
            disabled
            title="엑셀 가져오기 기능은 아직 지원하지 않습니다."
          >
            <Upload
              size={14}
              aria-hidden="true"
            />
            거래내역 가져오기
          </Button>
        )}
      </div>
      <div className="flex shrink-0 justify-between border-t border-line px-5 py-3 text-[11px] text-muted">
        <span>{expenses ? "직접 입력한 지출 0건" : "가져온 거래 0건"}</span>
        <span>{expenses ? "통장 거래와 별도로 관리" : "불러온 파일 없음"}</span>
      </div>
    </section>
  );
}
