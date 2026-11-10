import type { ParsedSheet, ParsedTransaction, RawCell } from "@/shared/desktop/transactions";

const aliases = {
  date: ["거래일시", "거래일자", "거래일", "일시"],
  withdrawal: ["출금", "출금액", "출금금액"],
  deposit: ["입금", "입금액", "입금금액"],
  balance: ["거래후잔액", "잔액"],
  description: ["거래내용", "내용", "적요"],
  memo: ["메모", "비고"],
  counterparty: ["상대계좌예금주명", "예금주명", "거래처"],
  bank: ["상대은행", "은행"],
  kind: ["거래구분"],
};
const text = (value: unknown) => (value == null ? "" : String(value).normalize("NFC").trim());
const heading = (value: unknown) => text(value).replace(/\s+/g, "");

function dateTime(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return dateTime(value.toISOString().slice(0, 19).replace("T", " "));
  const match = text(value).match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const parts = match.slice(1).map(value => Number(value ?? 0));
  const [year, month, day, hour, minute, second] = parts;
  if (year < 1900 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  )
    return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function money(value: unknown, signed = false): { value: number | null; invalid: boolean } {
  const string = text(value)
    .replace(/^₩\s*/, "")
    .replace(/\s*원$/, "");
  if (!string || string === "-") return { value: null, invalid: false };
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?$/.test(string)) return { value: null, invalid: true };
  const number = Number(string.replaceAll(",", ""));
  const valid = Number.isSafeInteger(number) && (signed || number >= 0);
  return { value: valid ? number : null, invalid: !valid };
}

export function parseBankSheet(data: unknown[][], sheetName: string, sheetId: string): ParsedSheet | null {
  const headerIndex = data
    .slice(0, 100)
    .findIndex(row =>
      ["date", "withdrawal", "deposit"].every(key =>
        aliases[key as keyof typeof aliases].some(name => row.some(cell => heading(cell) === name)),
      ),
    );
  if (headerIndex < 0) return null;
  const headers = data[headerIndex].map(heading);
  const columns = Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [key, headers.findIndex(cell => names.includes(cell))]),
  );
  if (
    ["date", "withdrawal", "deposit"].some(
      key => headers.filter(cell => aliases[key as keyof typeof aliases].includes(cell)).length !== 1,
    )
  )
    throw new Error(`${sheetName}: 필수 열 이름이 중복되어 있습니다.`);
  if (data.length > 20000 || headers.length > 64) throw new Error("시트당 20,000행, 64열 이하의 파일을 선택해 주세요.");
  const result: ParsedSheet = { sheetId, sheetName, rows: [], rejected: [], warnings: [] };
  let controlWithdrawal: number | null = null,
    controlDeposit: number | null = null;
  for (let index = headerIndex + 1; index < data.length; index += 1) {
    const row = data[index];
    if (row.every(cell => !text(cell))) continue;
    if (row.slice(0, 2).some(cell => ["합계", "총계"].includes(heading(cell)))) {
      controlWithdrawal = money(row[columns.withdrawal]).value;
      controlDeposit = money(row[columns.deposit]).value;
      continue;
    }
    if (heading(row[columns.date]) === headers[columns.date]) continue;
    const occurredAt = dateTime(row[columns.date]);
    if (!occurredAt) {
      result.rejected.push({ row: index + 1, message: "거래일시를 확인할 수 없습니다." });
      continue;
    }
    const withdrawal = money(row[columns.withdrawal]),
      deposit = money(row[columns.deposit]),
      balance = money(row[columns.balance], true);
    const issues: string[] = [];
    if (withdrawal.invalid) issues.push("출금 금액 형식 오류");
    if (deposit.invalid) issues.push("입금 금액 형식 오류");
    if (balance.invalid) issues.push("잔액 형식 오류");
    const amountComplete =
      !withdrawal.invalid &&
      !deposit.invalid &&
      ((withdrawal.value !== null && deposit.value !== null) ||
        (withdrawal.value ?? 0) > 0 ||
        (deposit.value ?? 0) > 0) &&
      !((withdrawal.value ?? 0) > 0 && (deposit.value ?? 0) > 0);
    if (!amountComplete) issues.push("입출금 금액 확인 필요");
    if (!text(row[columns.description])) issues.push("거래 내용 누락");
    const rawCells: RawCell[] = row.map((cell, column) => ({
      column: text(data[headerIndex][column]) || `열 ${column + 1}`,
      value:
        cell instanceof Date
          ? cell.toISOString()
          : typeof cell === "number" || typeof cell === "boolean"
            ? cell
            : cell == null
              ? null
              : String(cell),
    }));
    const transaction: ParsedTransaction = {
      sourceRow: index + 1,
      occurredAt,
      withdrawal: withdrawal.value,
      deposit: deposit.value,
      balance: balance.value,
      description: text(row[columns.description]),
      memo: text(row[columns.memo]),
      counterparty: text(row[columns.counterparty]),
      bank: text(row[columns.bank]),
      kind: text(row[columns.kind]),
      issues,
      amountComplete,
      rawCells,
    };
    result.rows.push(transaction);
  }
  if (!result.rows.length) {
    result.warnings.push("저장할 수 있는 거래가 없습니다.");
    return result;
  }
  if (result.rows.some(row => !row.amountComplete))
    result.warnings.push("금액을 확인할 수 없는 거래가 있습니다. 누락 금액은 0원으로 바꾸지 않고 저장합니다.");
  if (result.rows.some(row => !row.amountComplete || row.balance === null))
    result.warnings.push("금액 또는 잔액이 불완전한 거래는 다른 파일과 자동으로 중복 제외하지 않습니다.");
  if (controlWithdrawal !== null || controlDeposit !== null) {
    if (result.rows.some(row => !row.amountComplete))
      result.warnings.push("금액 누락으로 파일 하단 합계와 상세 거래를 대조할 수 없습니다.");
    else if (
      (controlWithdrawal !== null &&
        controlWithdrawal !== result.rows.reduce((sum, row) => sum + (row.withdrawal ?? 0), 0)) ||
      (controlDeposit !== null && controlDeposit !== result.rows.reduce((sum, row) => sum + (row.deposit ?? 0), 0))
    )
      result.warnings.push("파일 하단 합계와 상세 거래 합계가 다릅니다.");
  }
  return result;
}
