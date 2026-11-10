export type { TransactionRecord as BankTransaction } from "@/shared/desktop/transactions";
export type TransactionDirection = "income" | "expense" | "transfer";

/** 원본 거래와 정산 분류를 분리해 원본 보존 및 재분류를 지원합니다. */
export interface TransactionClassification {
  transactionId: string;
  direction: TransactionDirection;
  categoryId: string | null;
  settlementMonth: string;
  excluded: boolean;
  exclusionReason: string | null;
}
