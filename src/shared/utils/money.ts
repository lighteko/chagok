export function formatMoney(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("ko-KR").format(value);
}
