import { basename, extname, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import writeXlsx from "write-excel-file/node";
import type { SettlementReport } from "@/shared/desktop/ledger";
import { buildSettlementWorkbook } from "@/domains/settlement/export/buildSettlementWorkbook";

export async function saveSettlementExport(report: SettlementReport, closed: boolean, path: string) {
  const destination = extname(path) ? path : `${path}.xlsx`;
  if (extname(destination).toLowerCase() !== ".xlsx") throw new Error(".xlsx 확장자로 저장해 주세요.");
  const buffer = await writeXlsx(buildSettlementWorkbook(report, closed), {
    fontFamily: "맑은 고딕",
    fontSize: 10,
  }).toBuffer();
  const temporary = join(dirname(destination), `.chagok-settlement-${randomUUID()}.tmp`);
  let handle,
    created = false;
  try {
    handle = await open(temporary, "wx", 0o600);
    created = true;
    await handle.writeFile(buffer);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, destination);
  } catch (error) {
    await handle?.close().catch(() => {});
    if (created) await unlink(temporary).catch(() => {});
    throw error;
  }
  return { month: report.month, count: report.entries.length, fileName: basename(destination) };
}
