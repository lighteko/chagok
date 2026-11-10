import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import writeXlsxFile from "write-excel-file/node";
import { buildTransactionWorkbook } from "@/domains/transactions/export/buildTransactionWorkbook";
import type { TransactionExportSnapshot, TransactionExportResult } from "@/shared/desktop/transactions";

export async function saveTransactionExport(
  snapshot: TransactionExportSnapshot,
  selectedPath: string,
): Promise<TransactionExportResult> {
  const destination = extname(selectedPath) ? selectedPath : `${selectedPath}.xlsx`;
  if (extname(destination).toLowerCase() !== ".xlsx") throw new Error(".xlsx 확장자로 저장해 주세요.");
  const buffer = await writeXlsxFile(buildTransactionWorkbook(snapshot), {
    fontFamily: "Arial",
    fontSize: 11,
  }).toBuffer();
  const temporary = join(dirname(destination), `.chagok-export-${randomUUID()}.tmp`);
  let handle;
  let created = false;
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
  return { month: snapshot.month, count: snapshot.rows.length, fileName: basename(destination) };
}
