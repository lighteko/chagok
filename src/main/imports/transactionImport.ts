import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import readXlsxFile from "read-excel-file/node";
import { parseBankSheet } from "@/domains/transactions/import/parseBankSheet";
import type { CommitTransactionImport, ParsedSheet, TransactionImportPreview } from "@/shared/desktop/transactions";
import type { TransactionRepository } from "../storage/transactions";

interface PendingImport {
  fileName: string;
  hash: string;
  sheets: ParsedSheet[];
  expires: number;
}

export class TransactionImportService {
  private readonly pending = new Map<string, PendingImport>();
  constructor(private readonly repository: TransactionRepository) {}

  async preview(path: string): Promise<TransactionImportPreview> {
    if (extname(path).toLowerCase() !== ".xlsx") throw new Error(".xlsx 형식의 거래내역 파일을 선택해 주세요.");
    const info = await stat(path);
    if (!info.isFile() || info.size > 10 * 1024 * 1024) throw new Error("10MB 이하의 엑셀 파일을 선택해 주세요.");
    const buffer = await readFile(path);
    if (buffer.byteLength > 10 * 1024 * 1024) throw new Error("10MB 이하의 엑셀 파일을 선택해 주세요.");
    let workbook;
    try {
      workbook = await readXlsxFile(buffer);
    } catch {
      throw new Error("엑셀 파일을 읽지 못했습니다. 암호가 없는 정상적인 .xlsx 파일인지 확인해 주세요.");
    }
    if (workbook.length > 20) throw new Error("시트가 20개 이하인 파일을 선택해 주세요.");
    const sheets: ParsedSheet[] = [],
      skippedSheets: string[] = [];
    workbook.forEach((sheet, index) => {
      const parsed = parseBankSheet(sheet.data, sheet.sheet, String(index));
      if (parsed?.rows.length) sheets.push(parsed);
      else skippedSheets.push(sheet.sheet);
    });
    if (!sheets.length)
      throw new Error("거래일시·출금·입금 열과 유효한 거래를 찾지 못했습니다. 은행 거래내역 파일인지 확인해 주세요.");
    const token = randomUUID(),
      fileName = basename(path);
    this.pending.clear();
    this.pending.set(token, {
      fileName,
      hash: createHash("sha256").update(buffer).digest("hex"),
      sheets,
      expires: Date.now() + 30 * 60 * 1000,
    });
    return {
      token,
      fileName,
      skippedSheets,
      sheets: sheets.map(sheet => {
        const months = [...new Set(sheet.rows.map(row => row.occurredAt.slice(0, 7)))].sort().map(month => ({
          month,
          count: sheet.rows.filter(row => row.occurredAt.startsWith(month)).length,
          needsReview: sheet.rows.filter(row => row.occurredAt.startsWith(month) && row.issues.length).length,
        }));
        return {
          ...sheet,
          rows: months.flatMap(({ month }) => sheet.rows.filter(row => row.occurredAt.startsWith(month)).slice(0, 5)),
          rejected: sheet.rejected.slice(0, 20),
          rejectedCount: sheet.rejected.length,
          total: sheet.rows.length,
          months,
        };
      }),
    };
  }

  commit(value: unknown) {
    if (!value || typeof value !== "object") throw new Error("가져오기 요청을 확인해 주세요.");
    const request = value as CommitTransactionImport;
    const pending = typeof request.token === "string" ? this.pending.get(request.token) : undefined;
    if (!pending || pending.expires < Date.now())
      throw new Error("미리보기 시간이 지났습니다. 파일을 다시 선택해 주세요.");
    const sheet = pending.sheets.find(sheet => sheet.sheetId === request.sheetId);
    if (
      !sheet ||
      !Array.isArray(request.months) ||
      !request.months.length ||
      request.months.length > 2400 ||
      request.months.some(
        month => typeof month !== "string" || !sheet.rows.some(row => row.occurredAt.slice(0, 7) === month),
      )
    )
      throw new Error("저장할 시트와 정산월을 선택해 주세요.");
    if (typeof request.accountName !== "string") throw new Error("계좌 이름을 입력해 주세요.");
    const accountName = request.accountName.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!accountName || accountName.length > 80) throw new Error("계좌 이름은 1~80자로 입력해 주세요.");
    const result = this.repository.import(
      sheet,
      pending.fileName,
      pending.hash,
      accountName,
      [...new Set(request.months)].sort(),
    );
    this.pending.delete(request.token);
    return result;
  }

  cancel(token: unknown) {
    if (typeof token === "string") this.pending.delete(token);
  }
}
