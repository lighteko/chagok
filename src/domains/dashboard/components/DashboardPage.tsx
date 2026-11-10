import { ArrowLeftRight, Calculator, Download, Plus, Receipt, Upload } from "lucide-react";
import { Button } from "@/atomics/atoms/Button";
import { MonthPicker } from "@/atomics/molecules/MonthPicker";
import { MainLayout } from "@/atomics/templates/MainLayout";
import { SettlementWorkspace } from "@/domains/dashboard/components/SettlementWorkspace";
import { WorkspaceLedger } from "@/domains/dashboard/components/WorkspaceLedger";
import { WorkspaceSummary } from "@/domains/dashboard/components/WorkspaceSummary";
import { useAppInfo } from "@/domains/dashboard/hooks/useAppInfo";
import { isWorkspaceView, useWorkspaceState } from "@/domains/dashboard/hooks/useWorkspaceState";
import { monthRange } from "@/shared/utils/month";

const navigation = [
  {
    id: "transactions",
    label: "거래내역",
    icon: (
      <ArrowLeftRight
        size={17}
        strokeWidth={1.6}
        aria-hidden="true"
      />
    ),
  },
  {
    id: "expenses",
    label: "별도 지출",
    icon: (
      <Receipt
        size={17}
        strokeWidth={1.6}
        aria-hidden="true"
      />
    ),
  },
  {
    id: "settlement",
    label: "월별 정산",
    icon: (
      <Calculator
        size={17}
        strokeWidth={1.6}
        aria-hidden="true"
      />
    ),
  },
];
const descriptions = {
  transactions: "통장 거래를 확인하고 정산 항목으로 분류합니다.",
  expenses: "통장에 없는 지출을 기록하고 정산에 반영합니다.",
  settlement: "한 달의 수입과 지출을 확인하고 정산합니다.",
};

export function DashboardPage() {
  const { data } = useAppInfo();
  const { view, month, setView, setMonth } = useWorkspaceState();
  const title = navigation.find(item => item.id === view)?.label ?? "거래내역";
  return (
    <MainLayout
      navigation={navigation}
      activeItem={view}
      onNavigate={id => {
        if (isWorkspaceView(id)) setView(id);
      }}
      footer={
        <div className="flex items-center justify-between">
          <span>CHAGOK</span>
          <span>{data ? `v${data.version}` : ""}</span>
        </div>
      }
    >
      <header className="flex min-h-[76px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-7 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
          <span className="rounded border border-line px-2 py-0.5 text-[10px] text-muted">내역 없음</span>
        </div>
        <MonthPicker
          value={month}
          onChange={setMonth}
        />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 p-6 lg:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] text-muted">{descriptions[view]}</p>
            <p className="mt-1.5 text-[11px] text-muted">{monthRange(month)}</p>
          </div>
          <div className="flex items-center gap-2">
            {view === "settlement" ? (
              <Button
                variant="secondary"
                disabled
                title="정산 내역이 등록된 뒤 내보낼 수 있습니다."
              >
                <Download
                  size={14}
                  aria-hidden="true"
                />
                엑셀 내보내기
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled
                  title="지출 입력 기능은 아직 지원하지 않습니다."
                >
                  <Plus
                    size={14}
                    aria-hidden="true"
                  />
                  지출 추가
                </Button>
                <Button
                  disabled
                  title="엑셀 가져오기 기능은 아직 지원하지 않습니다."
                >
                  <Upload
                    size={14}
                    aria-hidden="true"
                  />
                  파일 가져오기
                </Button>
              </>
            )}
          </div>
        </div>
        <WorkspaceSummary />
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>{view === "transactions" ? "통장 거래" : view === "expenses" ? "통장 외 지출" : "정산 대상 내역"}</span>
          <span>등록된 내역이 없어 금액을 표시하지 않습니다.</span>
        </div>
        {view === "settlement" ? <SettlementWorkspace /> : <WorkspaceLedger mode={view} />}
      </div>
    </MainLayout>
  );
}
