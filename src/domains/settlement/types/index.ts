export type { Allocation as AllocationRule, SettlementReport, PeriodSnapshot } from "@/shared/desktop/ledger";

import type { Allocation } from "@/shared/desktop/ledger";

export interface SettlementPeriod {
  month: string;
  status: "draft" | "closed";
  allocationRules: Allocation[];
  closedAt: string | null;
}
