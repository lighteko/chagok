import { ClipboardList } from "lucide-react";

export function SettlementWorkspace() {
  return (
    <section
      aria-label="월별 정산 내역"
      className="grid min-h-[350px] flex-1 grid-cols-[minmax(0,1fr)_260px] overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-col">
        <div className="border-b border-line px-5 py-4 text-[13px] font-semibold">정산 내역</div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ClipboardList
              size={23}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
          <h2 className="mt-5 text-[14px] font-medium">정산할 내역이 없습니다</h2>
          <p className="mt-2 max-w-xs text-[12px] leading-6 text-muted">
            이 달의 거래와 별도 지출을 모아
            <br />
            정산 금액과 배분 내역을 확인하는 곳입니다.
          </p>
        </div>
      </div>
      <aside className="border-l border-line bg-background/40">
        <h2 className="border-b border-line px-5 py-4 text-[13px] font-semibold">지출 구분</h2>
        <dl className="space-y-5 px-5 py-6 text-[12px]">
          {["현금 지출", "카드 지출", "기타 지출"].map(label => (
            <div
              key={label}
              className="flex justify-between"
            >
              <dt className="text-muted">{label}</dt>
              <dd>— 원</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-5 font-medium">
            <dt>총 지출</dt>
            <dd>— 원</dd>
          </div>
        </dl>
        <p className="px-5 text-[11px] leading-5 text-muted">
          금액은 정산 대상 내역이
          <br />
          등록된 뒤 표시됩니다.
        </p>
      </aside>
    </section>
  );
}
