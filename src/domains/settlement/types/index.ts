export type { Allocation as AllocationRule, SettlementReport, PeriodSnapshot } from "@/shared/desktop/ledger";

import type { Allocation } from "@/shared/desktop/ledger";

export interface SettlementNavigation {
  tab: "overview" | "entries" | "rules" | "history";
  pendingOnly?: boolean;
  openSettings?: boolean;
}

export interface SettlementPeriod {
  month: string;
  status: "draft" | "closed";
  allocationRules: Allocation[];
  closedAt: string | null;
}
