export type TransactionDirection = "income" | "expense" | "transfer";

/** 원본 거래와 정산 분류를 분리해 원본 보존 및 재분류를 지원합니다. */
export interface BankTransaction {
  id: string;
  importId: string;
  sourceRow: number;
  occurredAt: string;
  withdrawal: number | null;
  deposit: number | null;
  balance: number | null;
  description: string;
  memo: string;
}

export interface TransactionClassification {
  transactionId: string;
  direction: TransactionDirection;
  categoryId: string | null;
  settlementMonth: string;
  excluded: boolean;
  exclusionReason: string | null;
}
