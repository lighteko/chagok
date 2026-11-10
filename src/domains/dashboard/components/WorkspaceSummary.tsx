import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

const metrics = [
  { label: "수입", icon: ArrowDownLeft, description: "정산 대상 입금" },
  { label: "지출", icon: ArrowUpRight, description: "정산에 반영한 지출" },
  { label: "정산 잔액", icon: Wallet, description: "수입 − 정산 대상 지출" },
];

export function WorkspaceSummary() {
  return (
    <section
      aria-label="월별 요약"
      className="grid grid-cols-3 gap-4"
    >
      {metrics.map(({ label, icon: Icon, description }) => (
        <div
          key={label}
          className="rounded-lg border border-line bg-surface px-5 py-4"
        >
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>{label}</span>
            <Icon
              size={15}
              strokeWidth={1.6}
              aria-hidden="true"
            />
          </div>
          <div
            className="mt-3 text-[25px] leading-none font-medium tracking-tight"
            aria-label={`${label}: 집계할 내역 없음`}
          >
            —<span className="ml-1.5 text-[12px] font-normal text-muted">원</span>
          </div>
          <p className="mt-3 text-[11px] text-muted">{description}</p>
        </div>
      ))}
    </section>
  );
}
