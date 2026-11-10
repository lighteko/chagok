import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { LedgerRepository } from "../storage/ledger";

export function validReceiptName(name: string) {
  return /^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|pdf)$/.test(name);
}
function matchesType(buffer: Buffer, ext: string) {
  if (ext === ".pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (ext === ".png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === ".jpg" || ext === ".jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (ext === ".webp")
    return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  return false;
}
export class ReceiptService {
  constructor(
    private readonly directory: string,
    private readonly ledger: LedgerRepository,
  ) {}
  async add(expenseId: string, path: string) {
    this.ledger.assertExpenseOpen(expenseId);
    const info = await stat(path),
      ext = extname(path).toLowerCase();
    if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error("20MB 이하의 영수증을 선택해 주세요.");
    const buffer = await readFile(path);
    if (buffer.length > 20 * 1024 * 1024 || !matchesType(buffer, ext))
      throw new Error("정상적인 PNG·JPEG·WebP 이미지 또는 PDF 영수증을 선택해 주세요.");
    const id = randomUUID(),
      storedName = `${id}${ext}`,
      target = join(this.directory, storedName);
    await mkdir(this.directory, { recursive: true });
    await writeFile(target, buffer, { flag: "wx" });
    try {
      this.ledger.addReceipt({
        id,
        expenseId,
        fileName: basename(path),
        storedName,
        size: buffer.length,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      });
    } catch (error) {
      await unlink(target).catch(() => {});
      throw error;
    }
    return this.ledger.receipts(expenseId);
  }
  async path(id: string) {
    const row = this.ledger.receipt(id);
    if (!validReceiptName(row.storedName)) throw new Error("저장된 영수증 경로를 확인할 수 없습니다.");
    const path = join(this.directory, row.storedName),
      buffer = await readFile(path);
    if (buffer.length !== row.size || createHash("sha256").update(buffer).digest("hex") !== row.sha256)
      throw new Error("영수증 파일이 손상되었거나 변경되었습니다. 백업을 확인해 주세요.");
    return path;
  }
  async remove(id: string) {
    const row = this.ledger.deleteReceipt(id);
    if (validReceiptName(row.storedName)) await unlink(join(this.directory, row.storedName)).catch(() => {});
  }
}
