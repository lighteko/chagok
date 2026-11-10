import type { LedgerWorkspace } from "@/shared/desktop/ledger";
import { formatMoney } from "@/shared/utils/money";

export const tutorialSteps = [
  {
    id: "month",
    title: "정산할 월을 선택하세요",
    shortTitle: "정산월 선택",
    description: "현재 장부에서 실제 자료로 따라 하는 안내입니다. 먼저 작업할 정산월을 선택하세요.",
    instructions: [
      "월 입력란이나 양쪽 화살표로 정산할 연도와 월을 선택하세요.",
      "거래내역·별도 지출·월별 정산은 같은 정산월을 함께 사용합니다.",
    ],
    action: "정산월 선택으로 이동",
  },
  {
    id: "import",
    title: "은행 거래내역을 가져오세요",
    shortTitle: "엑셀 가져오기",
    description: "은행에서 내려받은 .xlsx 파일을 선택하고 미리보기를 확인합니다.",
    instructions: [
      "파일을 선택한 뒤 같은 통장에는 항상 같은 계좌 이름을 입력하세요.",
      "시트와 가져올 월을 고르고, 누락 금액·제외 행 안내를 읽은 뒤 저장하세요.",
      "실제 거래일로 월을 나누며, 가져온 뒤 마지막 거래월로 이동합니다. 다시 가져온 같은 계좌의 중복 거래는 제외합니다.",
    ],
    action: "거래내역 파일 선택",
  },
  {
    id: "classify",
    title: "거래의 금액과 분류를 확인하세요",
    shortTitle: "거래 확인",
    description: "확인할 통장 거래를 하나 열어 실제 자료와 대조합니다.",
    instructions: [
      "수입·지출·이체·정산 제외를 선택하고 정산 항목과 정산월을 지정하세요. 정산 제외에는 사유가 필요합니다.",
      "빈 입출금 금액을 실제 자료로 보정하고 검토 사유를 적은 뒤 ‘금액과 분류를 확인했습니다’를 선택해 저장하세요.",
      "여러 건은 분류·확인 목록에서 선택해 일괄 처리합니다. 항목·분류 규칙에 저장한 반복 조건은 다음 가져오기에서 제안됩니다.",
    ],
    action: "확인할 거래 열기",
  },
  {
    id: "expenses",
    title: "통장 밖의 지출을 추가하세요",
    shortTitle: "별도 지출",
    description: "통장에 없는 현금·카드·기타 지출이 있을 때 기록합니다.",
    instructions: [
      "사용일·정산월·금액·내용·정산 항목을 입력하고, 현금·카드·기타 중 지출 구분을 선택하세요.",
      "결제자와 결제수단을 적고 저장하세요. 사용일과 비용을 반영할 정산월은 따로 지정할 수 있습니다.",
      "저장한 지출의 ‘영수증’에서 이미지나 PDF를 첨부합니다. 별도 지출이 없으면 다음 단계로 넘어가세요.",
    ],
    action: "별도 지출 입력 열기",
  },
  {
    id: "links",
    title: "같은 지출이 두 번 잡히지 않게 연결하세요",
    shortTitle: "통장 출금 연결",
    description: "직접 입력한 카드 사용액 등이 통장 출금에도 포함되어 있을 때 연결합니다.",
    instructions: [
      "먼저 해당 통장 출금을 지출로 분류하고 금액을 보정하세요. 별도 지출의 ‘연결’에서 출금 거래를 선택합니다.",
      "여러 카드 사용 건을 카드대금 한 건에 연결하거나 일부 금액만 연결할 수 있습니다. 각 지출과 출금 금액을 초과하는 연결은 저장할 수 없습니다.",
      "예를 들어 카드 사용 9만원을 통장 카드대금 10만원에 연결하면, 통장 쪽에는 잔여 1만원만 비용으로 반영합니다. 연결할 지출이 없으면 건너뛰세요.",
    ],
    action: "통장 출금 연결 열기",
  },
  {
    id: "settlement",
    title: "정산 결과와 배분 설정을 확인하세요",
    shortTitle: "정산·배분",
    description: "정산 수입에서 현금·카드·기타 지출을 뺀 금액이 정산 잔액입니다.",
    instructions: [
      "월별 정산에서 수입·지출·잔액을 확인하세요. 거래내역 화면의 통장 입출금 요약과는 계산 기준이 다릅니다.",
      "‘배분 설정’에서 업무에 맞는 대상명과 비율을 입력하세요. 비율 합계는 100%이며, 원 미만 처리 방식도 선택할 수 있습니다.",
      "일별·항목별 차트의 막대를 누르면 아래 내역이 좁혀지고, 월별 막대를 누르면 해당 정산월로 이동합니다.",
    ],
    action: "배분 설정 열기",
  },
  {
    id: "closing",
    title: "확인을 마친 달을 마감하고 출력하세요",
    shortTitle: "마감·엑셀 출력",
    description: "월 마감은 그 시점의 내역·계산 기준·배분액을 보관하는 작업입니다.",
    instructions: [
      "확인할 내역을 모두 처리하면 ‘이번 달 마감’이 활성화됩니다. 눌러 내용을 확인한 뒤 마감을 확정하세요.",
      "‘정산표 엑셀 출력’에서 기존 정산표 배치로 저장합니다. 미확정 자료가 있으면 잠정 정산표로 출력됩니다.",
      "마감 후 수정하려면 ‘마감 재개방’에서 사유를 기록하세요. 마감·수정 이력에서 이전 마감본과 변경 전후를 확인할 수 있습니다.",
    ],
    action: "마감·출력 위치 보기",
  },
  {
    id: "backup",
    title: "전체 장부를 백업하세요",
    shortTitle: "백업·복원",
    description: "거래·분류·지출·영수증·설정·마감본을 .chagok 파일 하나에 보관합니다.",
    instructions: [
      "‘백업·복원 → 전체 장부 백업’을 누르고 저장 위치를 선택하세요. 다른 드라이브나 외부 저장장치에도 보관하면 좋습니다.",
      "복원할 때는 ‘백업 파일에서 복원’을 선택하세요. 파일 검증 후 백업 시각과 자료 수를 보여주며, 최종 확인 후 현재 장부를 교체합니다.",
      "매달 같은 순서로 작업할 수 있습니다. 왼쪽 아래의 ‘사용 안내’에서 필요한 단계를 다시 열어보세요.",
    ],
    action: "백업·복원 열기",
  },
] as const;

export type TutorialStepId = (typeof tutorialSteps)[number]["id"];
export interface TutorialContext {
  month: string;
  ledger: LedgerWorkspace | null;
  transactionCount: number | null;
  backedUp: boolean;
  transactionError?: boolean;
  ledgerError?: boolean;
}

export function tutorialStatus(step: TutorialStepId, context: TutorialContext): string {
  const { month, ledger, transactionCount, backedUp } = context;
  if (step === "month") return `현재 정산월: ${month}`;
  if (step === "import")
    return context.transactionError
      ? "거래내역을 불러오지 못했습니다. 화면의 다시 불러오기를 눌러 주세요."
      : transactionCount === null
        ? "거래내역을 불러오는 중입니다."
        : `${month} 통장 거래 ${transactionCount.toLocaleString()}건`;
  if (step === "backup")
    return backedUp ? "이번 실행에서 전체 장부 백업 파일을 저장했습니다." : "백업 창에서 저장 위치를 선택해 보세요.";
  if (context.ledgerError) return "정산 자료를 불러오지 못했습니다. 화면의 다시 불러오기를 눌러 주세요.";
  if (!ledger) return "정산 자료를 불러오는 중입니다.";
  const expenses = ledger.expenses.filter(row => row.settlementMonth === month);
  const banks = ledger.report.entries.filter(row => row.source === "bank");
  if (step === "classify") {
    if (!banks.length) return "이번 달 정산에 포함된 통장 거래가 없습니다. 먼저 거래내역을 가져오세요.";
    const pending = banks.filter(row => !row.confirmed).length;
    return pending
      ? `통장 거래 ${banks.length.toLocaleString()}건 중 확인할 거래 ${pending.toLocaleString()}건`
      : `통장 거래 ${banks.length.toLocaleString()}건의 분류를 확인했습니다.`;
  }
  if (step === "expenses")
    return ledger.closed
      ? "마감된 달입니다. 수정하려면 마감·출력 단계에서 재개방하세요."
      : `이번 달 별도 지출 ${expenses.length.toLocaleString()}건 · 필요한 지출만 추가하세요.`;
  if (step === "links") {
    if (ledger.closed) return "마감된 달의 연결은 수정할 수 없습니다. 마감·출력 단계에서 재개방하세요.";
    if (!expenses.length) return "이번 달 별도 지출이 없습니다. 연결 단계는 건너뛸 수 있습니다.";
    const linked = expenses.filter(expense => ledger.links.some(link => link.expenseId === expense.id)).length;
    return `별도 지출 ${expenses.length.toLocaleString()}건 중 ${linked.toLocaleString()}건에 통장 출금이 연결되어 있습니다.`;
  }
  if (step === "settlement")
    return `정산 잔액 ${formatMoney(ledger.report.net)}원 · 확인할 내역 ${ledger.report.pending}건${ledger.closed ? " · 마감본" : " · 잠정 금액"}`;
  if (ledger.closed) return `${month}은 마감되어 있습니다. 이전 마감본은 이력에서 볼 수 있습니다.`;
  return ledger.report.pending
    ? `확인할 내역 ${ledger.report.pending}건을 처리하면 마감할 수 있습니다.`
    : ledger.report.entries.length
      ? "확인할 내역이 없습니다. 마감 전에 계산 결과를 검토하세요."
      : "정산 자료가 없는 달은 마감할 수 없습니다.";
}
