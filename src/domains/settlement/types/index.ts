export interface AllocationRule {
  id: string;
  recipient: string;
  /** 정수 basis points. 예: 80% = 8000. 전체 수혜자 합계 10000으로 검증합니다. */
  basisPoints: number;
}

export interface SettlementPeriod {
  month: string;
  status: "draft" | "closed";
  allocationRules: AllocationRule[];
  closedAt: string | null;
}
