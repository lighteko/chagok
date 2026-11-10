export const MIN_MONTH = "1900-01";
export const MAX_MONTH = "2100-12";

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= MIN_MONTH && value <= MAX_MONTH;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(value: string, offset: number): string {
  const [year, month] = value.split("-").map(Number);
  const index = year * 12 + month - 1 + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthRange(value: string): string {
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const prefix = value.replace("-", ".");
  return `${prefix}.01 – ${prefix}.${lastDay}`;
}
