import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import writeXlsxFile from "write-excel-file/node";
import { _electron as electron, expect } from "@playwright/test";

await mkdir("test-results", { recursive: true });
const profile = await mkdtemp(resolve("test-results/import-"));
await mkdir(join(profile, "storage"));
const databasePath = join(profile, "storage", "chagok.sqlite");
const seed = new DatabaseSync(databasePath);
seed.exec(
  "CREATE TABLE workspace_preferences (id INTEGER PRIMARY KEY, view TEXT NOT NULL, month TEXT NOT NULL) STRICT; INSERT INTO workspace_preferences VALUES (1,'transactions','2026-09'); PRAGMA user_version=1;",
);
seed.close();

const header = [
  "번호",
  "거래일시",
  "출금",
  "입금",
  "거래후 잔액",
  "거래내용",
  "메모",
  "상대계좌예금주명",
  "상대은행",
  "거래구분",
];
const rows = [
  [1, new Date("2026-09-01T10:30:00Z"), 0, 100000, 100000, "수업료 A", "9월", "입금자 A", "테스트은행", "이체"],
  [2, "2026-09-02 10:00:00", 25000, 0, 75000, "재료비", "", "문구점", "테스트은행", "이체"],
  [3, "2026-09-02 10:00:00", 25000, 0, 75000, "재료비", "", "문구점", "테스트은행", "이체"],
  [4, "2026-08-31 11:00:00", 0, 50000, 50000, "지난달 입금"],
  [5, "2026-09-03 12:00:00", null, null, null, "미확인 거래"],
  [6, "2026-09-04 12:00:00", 0, 0, 75000, "0원 거래"],
  [7, "2026-09-05 12:00:00", "1,200원", 0, 73800, "수수료"],
  [8, "2026-02-30 12:00:00", 100, 0, 73700, "잘못된 날짜"],
  [9, "2026-09-06 12:00:00", "금액 오류", 0, 73800, "금액 형식 오류"],
  [10, "2026-09-07 12:00:00", 0, 20000, -1000, "추가 입금"],
];
const fullFile = join(profile, "full.xlsx");
await writeXlsxFile([
  {
    sheet: "거래내역",
    dateFormat: "yyyy-mm-dd hh:mm:ss",
    data: [["은행 거래내역"], ["테스트용 합성 데이터"], header, ...rows, ["합계", null, 999999, 999999]],
  },
  { sheet: "안내", data: [["거래 양식이 아닌 시트"]] },
]).toFile(fullFile);
const overlapFile = join(profile, "overlap.xlsx");
await writeXlsxFile([header, rows[0], rows[1], rows[2], rows[4], [11, "2026-09-08 12:00:00", 0, 1000, 0, "새 거래"]], {
  sheet: "거래내역",
  dateFormat: "yyyy-mm-dd hh:mm:ss",
}).toFile(overlapFile);
const invalidFile = join(profile, "invalid.xlsx");
await writeFile(invalidFile, "not an excel file");
const wrongExtension = join(profile, "legacy.xls");
await copyFile(fullFile, wrongExtension);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const executableArgument = process.argv.slice(2).find(value => value.endsWith(".exe"));
const executablePath = executableArgument ? resolve(executableArgument) : undefined;
const args = [...(executablePath ? [] : ["."]), `--user-data-dir=${profile}`];
const launch = () => electron.launch({ executablePath, args, env, timeout: 30000 });
let app = await launch();
let db;
try {
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  assert.equal(resolve(await app.evaluate(({ app }) => app.getPath("userData"))), profile);
  db = new DatabaseSync(databasePath);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 2);
  assert.equal(db.prepare("SELECT month FROM workspace_preferences").get().month, "2026-09");
  const count = table => Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
  const choose = async path => {
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () =>
        path ? { canceled: false, filePaths: [path] } : { canceled: true, filePaths: [] };
    }, path);
    await page.getByRole("button", { name: "파일 가져오기", exact: true }).click();
  };
  const account = async () => page.getByLabel("계좌 이름", { exact: true }).fill("운영 계좌");

  await choose(null);
  await expect(page.getByRole("button", { name: "파일 가져오기", exact: true })).toBeEnabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await choose(wrongExtension);
  await expect(page.getByRole("alert")).toContainText(".xlsx");
  await choose(invalidFile);
  await expect(page.getByRole("alert")).toContainText("엑셀 파일을 읽지 못했습니다");
  assert.equal(count("bank_transactions"), 0);

  await choose(fullFile);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "거래내역 미리보기" })).toBeVisible();
  await expect(dialog).toContainText("선택한 거래 8건");
  await expect(dialog).toContainText("거래일시를 확인할 수 없는 1행");
  await expect(dialog).toContainText("안내");
  await page.screenshot({ path: "test-results/chagok-import-preview.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(count("transaction_imports"), 0);
  await choose(fullFile);
  await account();
  db.exec(
    "CREATE TRIGGER smoke_reject_import BEFORE INSERT ON bank_transactions WHEN NEW.description='재료비' BEGIN SELECT RAISE(ABORT,'test rollback'); END;",
  );
  await dialog.getByRole("button", { name: "8건 저장", exact: true }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "거래를 저장하지 못했습니다" })).toBeVisible();
  assert.equal(count("bank_transactions"), 0);
  assert.equal(count("transaction_imports"), 0);
  db.exec("DROP TRIGGER smoke_reject_import");
  await dialog.getByRole("button", { name: "8건 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "8건 저장했습니다" })).toBeVisible();
  assert.equal(count("bank_transactions"), 8);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bank_transactions WHERE description='재료비'").get().count, 2);
  const query = { month: "2026-09", search: "", filter: "all", page: 0 };
  const list = await page.evaluate(query => window.chagok.listTransactions(query), query);
  assert.equal(list.total, 8);
  assert.equal(list.summary.deposits, 120000);
  assert.equal(list.summary.withdrawals, 51200);
  assert.equal(list.summary.missingAmounts, 2);
  assert.equal(list.summary.difference, null);
  assert.equal(list.rows.find(row => row.description === "수업료 A").occurredAt, "2026-09-01 10:30:00");
  assert.equal(list.rows.find(row => row.description === "미확인 거래").withdrawal, null);
  assert.equal(list.rows.find(row => row.description === "0원 거래").withdrawal, 0);
  assert.equal(list.rows.find(row => row.description === "추가 입금").balance, -1000);

  await page.getByLabel("거래 내용 검색", { exact: true }).pressSequentially("재료비", { delay: 100 });
  await expect(page.getByLabel("거래 내용 검색")).toHaveValue("재료비");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
  await page.getByLabel("거래 내용 검색").fill("");
  await page.getByLabel("거래 필터").selectOption("review");
  await expect
    .poll(async () =>
      Number(
        (await page.evaluate(query => window.chagok.listTransactions(query), { ...query, filter: "review" })).total,
      ),
    )
    .toBe(2);
  await page.getByLabel("거래 필터").selectOption("all");
  await page.getByRole("button", { name: "거래 상세: 미확인 거래", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("빈 셀");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await choose(fullFile);
  await account();
  await dialog.getByRole("button", { name: "8건 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "중복 8건" })).toBeVisible();
  assert.equal(count("bank_transactions"), 8);

  await choose(fullFile);
  await account();
  await dialog.getByRole("checkbox", { name: /2026-08/ }).check();
  await dialog.getByRole("checkbox", { name: /2026-09/ }).uncheck();
  await dialog.getByRole("button", { name: "1건 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("정산월", { exact: true })).toHaveValue("2026-08");
  assert.equal(count("bank_transactions"), 9);
  await page.getByLabel("정산월", { exact: true }).fill("2026-09");

  await choose(overlapFile);
  await account();
  await dialog.getByRole("button", { name: "5건 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "2건 저장했습니다. 중복 3건" })).toBeVisible();
  assert.equal(count("bank_transactions"), 11);

  await choose(fullFile);
  await page.getByLabel("계좌 이름", { exact: true }).fill("다른 계좌");
  await dialog.getByRole("button", { name: "8건 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  assert.equal(count("bank_transactions"), 19);
  await page.screenshot({ path: "test-results/chagok-transactions.png", animations: "disabled", fullPage: true });

  const pagesFile = join(profile, "pages.xlsx");
  await writeXlsxFile(
    [
      header,
      ...Array.from({ length: 55 }, (_, index) => [
        index + 1,
        `2026-09-15 10:${String(index).padStart(2, "0")}:00`,
        0,
        1,
        index + 100,
        `페이지 검증 ${index + 1}`,
      ]),
    ],
    { sheet: "거래내역" },
  ).toFile(pagesFile);
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
  }, pagesFile);
  const pagingPreview = await page.evaluate(() => window.chagok.previewTransactionImport());
  const pagingSaved = await page.evaluate(request => window.chagok.commitTransactionImport(request), {
    token: pagingPreview.token,
    sheetId: pagingPreview.sheets[0].sheetId,
    accountName: "페이지 검증",
    months: ["2026-09"],
  });
  assert.equal(pagingSaved.inserted, 55);
  const firstPage = await page.evaluate(query => window.chagok.listTransactions(query), query);
  const secondPage = await page.evaluate(query => window.chagok.listTransactions(query), { ...query, page: 1 });
  assert.equal(firstPage.total, 73);
  assert.equal(firstPage.rows.length, 50);
  assert.equal(secondPage.rows.length, 23);
  assert.equal(new Set([...firstPage.rows, ...secondPage.rows].map(row => row.id)).size, 73);
  await page.reload();
  await expect(page.getByRole("button", { name: "다음 페이지", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "다음 페이지", exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(24);

  // Optional real attachment verification stays in this isolated profile and never enters Git.
  if (process.env.CHAGOK_EXAMPLE_XLSX) {
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, process.env.CHAGOK_EXAMPLE_XLSX);
    const preview = await page.evaluate(() => window.chagok.previewTransactionImport());
    assert.equal(preview.sheets[0].total, 125);
    assert.deepEqual(
      preview.sheets[0].months.map(({ month, count }) => ({ month, count })),
      [
        { month: "2026-08", count: 37 },
        { month: "2026-09", count: 88 },
      ],
    );
    const saved = await page.evaluate(request => window.chagok.commitTransactionImport(request), {
      token: preview.token,
      sheetId: preview.sheets[0].sheetId,
      accountName: "첨부 검증",
      months: ["2026-08", "2026-09"],
    });
    assert.equal(saved.inserted, 125);
    const stored = db
      .prepare(
        "SELECT COUNT(*) AS count, SUM(1-amount_complete) AS missing FROM bank_transactions WHERE account_name='첨부 검증'",
      )
      .get();
    assert.equal(stored.count, 125);
    assert.equal(stored.missing, 124);
    console.log("PASS: actual attachment 125 rows, two months, 124 missing amounts retained");
  }

  const expected = count("bank_transactions");
  db.close();
  db = undefined;
  await app.close();
  app = undefined;
  app = await launch();
  const restarted = await app.firstWindow();
  await expect(restarted.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  const restored = await restarted.evaluate(query => window.chagok.listTransactions(query), query);
  assert.equal(restored.total, process.env.CHAGOK_EXAMPLE_XLSX ? 161 : 73);
  db = new DatabaseSync(databasePath);
  assert.equal(count("bank_transactions"), expected);
  console.log(
    "PASS: v1 migration, XLSX preview, cancel, validation, atomic rollback/retry, null vs zero, dates, account-scoped dedup, overlapping files, month selection, search, details and restart",
  );
} finally {
  db?.close();
  await app?.close();
}
