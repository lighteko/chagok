import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, readFile, readdir, rename } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { resolve, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import writeXlsx from "write-excel-file/node";
import readXlsx from "read-excel-file/node";
import { _electron as electron, expect } from "@playwright/test";

await mkdir("test-results", { recursive: true });
const profile = await mkdtemp(resolve("test-results/ledger-")),
  fixture = join(profile, "ledger.xlsx");
await writeXlsx(
  [
    ["거래일시", "출금", "입금", "거래후 잔액", "거래내용"],
    ["2026-09-01 12:00:00", 0, 1000001, 1000001, "수업료"],
    ["2026-10-05 12:00:00", 100000, 0, 900001, "카드대금"],
    ["2026-09-03 12:00:00", 200000, 0, 800001, "임차료"],
    ["2026-09-04 12:00:00", null, null, null, "누락 금액"],
    ["2026-09-05 12:00:00", 0, 20000, 820001, "계좌 간 이체"],
  ],
  { sheet: "거래내역" },
).toFile(fixture);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const executable = process.argv.slice(2).find(v => v.endsWith(".exe"));
let app = await electron.launch({
  executablePath: executable ? resolve(executable) : undefined,
  args: [...(executable ? [] : ["."]), `--user-data-dir=${profile}`],
  env,
});
let inspection;
try {
  let page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  const api = (method, ...args) =>
    page.evaluate(({ method, args }) => window.chagok[method](...args), { method, args });
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
  }, fixture);
  const preview = await api("previewTransactionImport");
  await api("commitTransactionImport", {
    token: preview.token,
    sheetId: preview.sheets[0].sheetId,
    accountName: "정산계좌",
    months: ["2026-09", "2026-10"],
  });
  let september = await api("listTransactions", { month: "2026-09", search: "", filter: "all", page: 0 });
  const bank = description => september.rows.find(row => row.description === description);
  const categories = (await api("getLedger", "2026-09")).categories;
  const category = name => categories.find(row => row.name === name).id;
  const classify = (row, direction, categoryId = null, extra = {}) =>
    api("classifyTransaction", {
      transactionId: row.id,
      direction,
      categoryId,
      group: "other",
      settlementMonth: row.occurredAt.slice(0, 7),
      withdrawal: row.withdrawal,
      deposit: row.deposit,
      description: row.description,
      note: "검증 자료와 대사",
      confirmed: true,
      ruleId: null,
      ...extra,
    });
  await assert.rejects(api("closePeriod", "2026-09"), /확인/);
  await classify(bank("수업료"), "income", category("수업료"));
  await classify(bank("임차료"), "expense", category("임차료"));
  await classify(bank("계좌 간 이체"), "transfer");
  await assert.rejects(classify(bank("누락 금액"), "expense", category("기타지출")), /누락/);
  await classify(bank("누락 금액"), "expense", category("기타지출"), { withdrawal: 10000, deposit: 0 });
  assert.equal((await api("getTransaction", bank("누락 금액").id)).withdrawal, null, "raw values preserved");
  const october = (await api("listTransactions", { month: "2026-10", search: "", filter: "all", page: 0 })).rows[0];
  await classify(october, "expense", category("기타지출"), { group: "card" });
  const expense = {
    id: crypto.randomUUID(),
    occurredOn: "2026-09-08",
    settlementMonth: "2026-09",
    amount: 60000,
    description: "수업 재료 카드 사용",
    group: "card",
    categoryId: category("재료비"),
    paidBy: "담당자",
    paymentMethod: "개인 카드",
    note: "합성 검증 자료",
  };
  await api("saveExpense", expense);
  const second = { ...expense, id: crypto.randomUUID(), amount: 30000, description: "두 번째 카드 사용" };
  await api("saveExpense", second);
  await api("savePaymentLink", { expenseId: expense.id, transactionId: october.id, amount: 60000 });
  await api("savePaymentLink", { expenseId: second.id, transactionId: october.id, amount: 30000 });
  await assert.rejects(
    api("savePaymentLink", { expenseId: second.id, transactionId: october.id, amount: 50000 }),
    /초과/,
  );
  const third = { ...expense, id: crypto.randomUUID(), amount: 20000 };
  await api("saveExpense", third);
  await assert.rejects(
    api("savePaymentLink", { expenseId: third.id, transactionId: october.id, amount: 20000 }),
    /초과/,
  );
  await api("deleteExpense", third.id);
  await assert.rejects(api("saveExpense", { ...expense, amount: 59999 }), /연결/);
  let ledger = await api("getLedger", "2026-09");
  assert.equal(ledger.report.income, 1000001);
  assert.equal(ledger.report.totalExpenses, 300000);
  assert.equal(ledger.report.expenses.card, 90000);
  assert.equal(ledger.report.net, 700001);
  assert.equal(ledger.report.pending, 0);
  assert.deepEqual(
    ledger.report.allocations.map(row => row.amount),
    [560001, 140000],
  );
  assert.equal((await api("getLedger", "2026-10")).report.totalExpenses, 10000, "aggregate bill residual only");
  await assert.rejects(
    api("saveSettlementSettings", "2026-09", {
      allocations: [{ id: "bad", recipient: "대상", basisPoints: 9000 }],
      rounding: "largest-remainder",
    }),
    /100%/,
  );
  await api("saveSettlementSettings", "2026-09", {
    allocations: [
      { id: "a", recipient: "대상 A", basisPoints: 5000 },
      { id: "b", recipient: "대상 B", basisPoints: 5000 },
    ],
    rounding: "last-recipient",
  });
  assert.deepEqual(
    (await api("getLedger", "2026-09")).report.allocations.map(row => row.amount),
    [350000, 350001],
  );
  const snapshot = await api("closePeriod", "2026-09");
  assert.equal(snapshot.report.net, 700001);
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
  }, fixture);
  const closedPreview = await api("previewTransactionImport");
  await assert.rejects(
    api("commitTransactionImport", {
      token: closedPreview.token,
      sheetId: closedPreview.sheets[0].sheetId,
      accountName: "정산계좌",
      months: ["2026-09"],
    }),
    /마감/,
  );
  await api("cancelTransactionImport", closedPreview.token);
  await assert.rejects(api("saveExpense", { ...expense, amount: 61000 }), /마감/);
  await assert.rejects(
    api("savePaymentLink", { expenseId: expense.id, transactionId: october.id, amount: 50000 }),
    /마감/,
  );
  await assert.rejects(classify(october, "expense", category("기타지출"), { withdrawal: 110000 }), /마감/);
  await assert.rejects(api("reopenPeriod", "2026-09", ""), /사유/);
  await api("reopenPeriod", "2026-09", "금액 대사 후 수정");
  await api("saveExpense", { ...expense, amount: 61000 });
  ledger = await api("getLedger", "2026-09");
  assert.equal(ledger.report.net, 699001);
  assert.equal(ledger.snapshots[0].report.net, 700001);
  assert.ok(ledger.audit.some(row => row.action === "월 재개방"));
  // Whole-batch failure must not partially change previously confirmed records.
  const before = ledger.classifications.find(row => row.transactionId === bank("수업료").id);
  await assert.rejects(
    api("bulkClassifyTransactions", {
      ids: [bank("수업료").id, "missing-id"],
      direction: "excluded",
      categoryId: null,
      group: "other",
      settlementMonth: "2026-09",
      note: "일괄 제외",
      confirmed: true,
    }),
  );
  assert.deepEqual(
    (await api("getLedger", "2026-09")).classifications.find(row => row.transactionId === bank("수업료").id),
    before,
  );
  const rule = {
    id: "rent-rule",
    name: "임차료 자동 제안",
    field: "description",
    contains: "임차료",
    direction: "expense",
    categoryId: category("임차료"),
    group: "other",
    enabled: true,
  };
  await api("saveClassificationRule", rule);
  assert.equal(await api("suggestClassificationRules", "2026-09"), 0, "manual classification not overwritten");
  const recurring = join(profile, "recurring.xlsx");
  await writeXlsx(
    [
      ["거래일시", "출금", "입금", "거래후 잔액", "거래내용"],
      ["2026-12-01 10:00:00", 1000, 0, 9000, "12월 임차료"],
    ],
    { sheet: "거래내역" },
  ).toFile(recurring);
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
  }, recurring);
  const nextPreview = await api("previewTransactionImport");
  await api("commitTransactionImport", {
    token: nextPreview.token,
    sheetId: nextPreview.sheets[0].sheetId,
    accountName: "정산계좌",
    months: ["2026-12"],
  });
  const suggested = (await api("getLedger", "2026-12")).classifications.find(row => row.settlementMonth === "2026-12");
  assert.equal(suggested.ruleId, rule.id);
  assert.equal(suggested.confirmed, false);
  // Native receipt picker, copy integrity, cancellation and file-type validation.
  const receiptPath = join(profile, "receipt.png"),
    receiptBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ2kAAAAASUVORK5CYII=",
      "base64",
    );
  await writeFile(receiptPath, receiptBytes);
  const choose = async path =>
    app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: !path, filePaths: path ? [path] : [] });
    }, path);
  const saveTo = async path =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: !path, filePath: path });
    }, path);
  await choose(receiptPath);
  const receipts = await api("addReceipt", expense.id);
  assert.equal(receipts.length, 1);
  const receiptDb = new DatabaseSync(join(profile, "storage/chagok.sqlite"));
  const storedName = receiptDb.prepare("SELECT stored_name FROM receipts WHERE id=?").get(receipts[0].id).stored_name;
  receiptDb.close();
  assert.deepEqual(await readFile(join(profile, "storage/receipts", storedName)), receiptBytes);
  await choose(null);
  assert.equal(await api("addReceipt", expense.id), null);
  const invalidReceipt = join(profile, "invalid.png");
  await writeFile(invalidReceipt, "not an image");
  await choose(invalidReceipt);
  await assert.rejects(api("addReceipt", expense.id), /정상적인/);
  // The existing template's four side-by-side sections and exact totals.
  const reportPath = join(profile, "settlement.xlsx");
  await saveTo(reportPath);
  await api("exportSettlement", "2026-09");
  const workbook = await readXlsx(reportPath),
    sheet = workbook[0].data,
    cell = (row, col) => sheet[row - 1]?.[col - 1];
  assert.equal(workbook[0].sheet, "26.09");
  assert.equal(cell(2, 1), "9월수입.");
  assert.equal(cell(2, 6), "현금지출");
  assert.equal(cell(2, 9), "카드지출");
  assert.equal(cell(2, 12), "기타지출");
  assert.equal(cell(29, 11), 1000001);
  assert.equal(cell(30, 11), 301000);
  assert.equal(cell(32, 11), 699001);
  assert.equal(cell(33, 11), 349500);
  assert.equal(cell(36, 11), 349501);
  assert.equal(cell(39, 8), 301000);
  assert.equal(cell(27, 11), 91000);
  assert.equal(cell(20, 14), 210000);
  assert.equal(workbook[1].data.length, 7);
  await saveTo(join(profile, "old-snapshot.xlsx"));
  await api("exportSettlement", "2026-09", snapshot.id);
  assert.equal((await readXlsx(join(profile, "old-snapshot.xlsx")))[0].data[31][10], 700001);
  // Full backup includes receipts, snapshots and WAL transactions. Reject corruption without changing live data.
  const backupPath = join(profile, "whole.chagok");
  await saveTo(backupPath);
  assert.equal((await api("createBackup")).receipts, 1);
  const envelope = JSON.parse(gunzipSync(await readFile(backupPath)).toString());
  assert.equal(envelope.receipts.length, 1);
  await writeFile(join(profile, "storage/receipts", storedName), Buffer.from("changed"));
  await assert.rejects(api("createBackup"), /손상/);
  assert.deepEqual(JSON.parse(gunzipSync(await readFile(backupPath)).toString()), envelope);
  await writeFile(join(profile, "storage/receipts", storedName), receiptBytes);
  const changed = { ...expense, amount: 62000 };
  await api("saveExpense", changed);
  const corruptPath = join(profile, "corrupt.chagok");
  const corrupt = structuredClone(envelope);
  corrupt.database.sha256 = "0".repeat(64);
  await writeFile(corruptPath, gzipSync(JSON.stringify(corrupt)));
  await choose(corruptPath);
  await assert.rejects(api("restoreBackup"), /검사/);
  assert.equal((await api("getLedger", "2026-09")).report.net, 698001);
  const traversal = structuredClone(envelope);
  traversal.receipts[0].name = "../escape.png";
  const traversalPath = join(profile, "traversal.chagok");
  await writeFile(traversalPath, gzipSync(JSON.stringify(traversal)));
  await choose(traversalPath);
  await assert.rejects(api("restoreBackup"), /이름/);
  await choose(backupPath);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
  });
  assert.equal(await api("restoreBackup"), null);
  assert.equal((await api("getLedger", "2026-09")).report.net, 698001);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  });
  await api("restoreBackup").catch(error => {
    if (!/context was destroyed|closed|navigation/i.test(error.message)) throw error;
  });
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  assert.equal((await api("getLedger", "2026-09")).report.net, 699001);
  const restored = await api("getLedger", "2026-09");
  assert.equal(restored.links.length, 2);
  assert.equal(restored.snapshots[0].report.net, 700001);
  assert.equal(restored.rules[0].id, rule.id);
  assert.equal(restored.report.settings.rounding, "last-recipient");
  assert.equal((await api("listReceipts", expense.id)).length, 1);
  assert.deepEqual(await readFile(join(profile, "storage/receipts", storedName)), receiptBytes);
  assert.ok((await readdir(profile)).some(name => name.startsWith("before-restore-")));
  // Verify app UI uses actual persisted ledger and links.
  await page.getByRole("textbox", { name: "정산월", exact: true }).fill("2026-09");
  await page.getByRole("button", { name: "별도 지출", exact: true }).click();
  await expect(page.getByText("수업 재료 카드 사용", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "지출 추가", exact: true }).click();
  await page.getByLabel("사용일", { exact: true }).fill("2026-09-15");
  await page.getByLabel("내용", { exact: true }).fill("화면으로 입력한 지출");
  await page.getByLabel("금액 (원)", { exact: true }).fill("7");
  await page.getByLabel("결제자", { exact: true }).fill("화면 테스트");
  await page.getByRole("button", { name: "지출 저장", exact: true }).click();
  const uiExpenseRow = page.getByRole("row").filter({ hasText: "화면으로 입력한 지출" });
  await expect(uiExpenseRow).toBeVisible();
  await uiExpenseRow.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel("금액 (원)", { exact: true }).fill("8");
  await page.getByRole("button", { name: "지출 저장", exact: true }).click();
  await expect(uiExpenseRow.getByText("8원", { exact: true })).toBeVisible();
  await choose(receiptPath);
  await uiExpenseRow.getByRole("button", { name: "영수증", exact: true }).click();
  await page.getByRole("button", { name: "영수증 첨부", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("receipt.png", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "제거", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("첨부된 영수증이 없습니다.")).toBeVisible();
  await page.keyboard.press("Escape");
  await uiExpenseRow.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "지출 삭제", exact: true }).click();
  await expect(uiExpenseRow).toHaveCount(0);
  const linkedExpenseRow = page.getByRole("row").filter({ hasText: "두 번째 카드 사용" });
  await linkedExpenseRow.getByRole("button", { name: "연결", exact: true }).click();
  await page.getByRole("button", { name: "연결 해제", exact: true }).click();
  await expect(linkedExpenseRow).toContainText("미연결");
  await linkedExpenseRow.getByRole("button", { name: "연결", exact: true }).click();
  await page.getByLabel("지출로 분류한 통장 출금").selectOption(october.id);
  await page.getByLabel("이번 지출에 연결할 금액 (원)").fill("30000");
  await page.getByRole("button", { name: "연결 저장", exact: true }).click();
  await expect(linkedExpenseRow).toContainText("전체 연결");
  await page.getByRole("button", { name: "거래내역", exact: true }).click();
  await page.getByRole("button", { name: "거래 상세: 누락 금액", exact: true }).click();
  await page.getByLabel("출금 보정 (원)").fill("11000");
  await page.getByLabel("검토·보정·제외 사유").fill("화면에서 금액 보정 검증");
  await page.getByRole("button", { name: "분류·보정 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  assert.equal((await api("getLedger", "2026-09")).report.net, 698001);
  await page.getByRole("button", { name: "거래 상세: 누락 금액", exact: true }).click();
  await page.getByLabel("출금 보정 (원)").fill("10000");
  await page.getByRole("button", { name: "분류·보정 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "월별 정산", exact: true }).click();
  await expect(page.getByText("699,001원", { exact: true })).toBeVisible();
  const categoryChart = page.locator('[data-slot="card"]').filter({ hasText: "지출 항목별 구성" });
  await categoryChart.locator(".recharts-bar-rectangle").first().click();
  await expect(page.getByRole("button", { name: /차트 선택 해제/ })).toBeVisible();
  await expect(page.getByText("정산 내역 1건", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("임차료");
  await page.getByRole("button", { name: /차트 선택 해제/ }).click();
  const dailyChart = page.locator('[data-slot="card"]').filter({ hasText: "일별 수입·지출" });
  await dailyChart.locator(".recharts-bar-rectangle").first().click();
  await expect(page.getByRole("button", { name: /차트 선택 해제 2026-09-01/ })).toBeVisible();
  await expect(page.getByText("정산 내역 1건", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /차트 선택 해제/ }).click();
  // Confirm a rule suggestion in bulk, close, then reopen through the actual dialogs.
  await page.getByRole("textbox", { name: "정산월", exact: true }).fill("2026-12");
  await page.getByRole("tab", { name: "분류·확인", exact: true }).click();
  await page.getByRole("checkbox", { name: "현재 페이지 통장 거래 모두 선택" }).check();
  await page.getByRole("combobox", { name: "일괄 정산 항목" }).selectOption(category("임차료"));
  await page.getByRole("textbox", { name: "일괄 검토 사유" }).fill("규칙 제안을 원본과 대사");
  await page.getByRole("checkbox", { name: "선택 거래의 금액과 분류를 모두 확인했습니다" }).check();
  await page.getByRole("button", { name: "선택 거래에 적용", exact: true }).click();
  await expect(page.getByRole("button", { name: "이번 달 마감", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "이번 달 마감", exact: true }).click();
  await page.getByRole("button", { name: "마감 확정", exact: true }).click();
  await expect(page.getByText("마감됨", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "마감 재개방", exact: true }).click();
  await page.getByLabel("재개방 사유", { exact: true }).fill("화면 마감·재개방 검증");
  await page.getByRole("button", { name: "사유 기록 후 재개방", exact: true }).click();
  await expect(page.getByText("잠정 정산", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "대시보드", exact: true }).click();
  const monthChart = page.locator('[data-slot="card"]').filter({ hasText: "최근 6개월 비교" });
  await expect(monthChart.getByRole("button", { name: "2026-10", exact: true })).toBeVisible();
  await expect(monthChart.locator(".recharts-bar-rectangle")).toHaveCount(4);
  await monthChart.locator(".recharts-bar-rectangle").nth(2).click();
  await expect(page.getByRole("textbox", { name: "정산월", exact: true })).toHaveValue("2026-10");
  await expect(page.getByText("10,000원", { exact: true }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "정산월", exact: true }).fill("2026-09");
  await expect(page.getByText("699,001원", { exact: true })).toBeVisible();
  const decemberRow = (await api("listTransactions", { month: "2026-12", search: "", filter: "all", page: 0 })).rows[0];
  await classify(decemberRow, "excluded", null, { note: "정산 대상이 아닌 출금임을 확인" });
  assert.equal((await api("getLedger", "2026-12")).report.totalExpenses, 0);
  assert.equal((await api("getLedger", "2026-12")).report.pending, 0);
  await page.getByRole("button", { name: "백업·복원", exact: true }).click();
  await saveTo(join(profile, "ui-backup.chagok"));
  await page.getByRole("button", { name: "전체 장부 백업", exact: true }).click();
  await expect(page.getByText(/ui-backup.chagok에 전체 장부/)).toBeVisible();
  await page.keyboard.press("Escape");
  // Grow all sections beyond the original template capacities and check loss allocation.
  for (const [group, count, amount] of [
    ["cash", 40, 1],
    ["card", 30, 2],
    ["other", 21, 3],
  ])
    for (let i = 0; i < count; i++)
      await api("saveExpense", {
        ...expense,
        id: crypto.randomUUID(),
        settlementMonth: "2026-07",
        occurredOn: "2026-07-01",
        group,
        amount,
        description: `${group} 사용 ${i + 1}`,
      });
  const expanded = await api("getLedger", "2026-07");
  assert.equal(expanded.report.totalExpenses, 163);
  assert.deepEqual(
    expanded.report.allocations.map(row => row.amount),
    [-130, -33],
  );
  const expandedPath = join(profile, "expanded.xlsx");
  await saveTo(expandedPath);
  await api("exportSettlement", "2026-07");
  const expandedSheet = (await readXlsx(expandedPath))[0].data;
  assert.equal(expandedSheet[42][6], 1);
  assert.equal(expandedSheet[32][9], 2);
  assert.equal(expandedSheet[23][12], 3);
  assert.equal(expandedSheet[47][7], 163);
  assert.equal(expandedSheet[33][10], 60);
  assert.equal(expandedSheet[24][13], 63);
  assert.equal(expandedSheet[38][10], -163);
  const firstAudit = await api("getLedgerAudit", "2026-07", 0),
    secondAudit = await api("getLedgerAudit", "2026-07", 1);
  assert.ok(firstAudit.total >= 91);
  assert.equal(firstAudit.rows.length, 50);
  assert.ok(secondAudit.rows.length > 0);
  assert.ok(!firstAudit.rows.some(row => secondAudit.rows.some(other => other.id === row.id)));
  await assert.rejects(api("getLedgerAudit", "2026-07", -1));
  await page.getByRole("textbox", { name: "정산월", exact: true }).fill("2026-07");
  await page.getByRole("tab", { name: "마감·수정 이력", exact: true }).click();
  await page.getByRole("button", { name: "이전 이력", exact: true }).click();
  await expect(page.getByRole("button", { name: "최근 이력", exact: true })).toBeEnabled();
  await page.getByRole("textbox", { name: "정산월", exact: true }).fill("2026-09");
  await expect(page.getByText("699,001원", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 900, height: 640 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: "test-results/chagok-settlement-narrow.png" });
  await page.setViewportSize({ width: 1240, height: 820 });
  await page.screenshot({ path: "test-results/chagok-settlement.png", fullPage: true });
  await app.close();
  const interruptedDirectory = `before-restore-${crypto.randomUUID()}`;
  await rename(join(profile, "storage"), join(profile, interruptedDirectory));
  await writeFile(join(profile, "restore-journal.json"), JSON.stringify({ previous: interruptedDirectory }));
  app = await electron.launch({
    executablePath: executable ? resolve(executable) : undefined,
    args: [...(executable ? [] : ["."]), `--user-data-dir=${profile}`],
    env,
  });
  page = await app.firstWindow();
  await expect(page.getByText("699,001원", { exact: true })).toBeVisible();
  inspection = new DatabaseSync(join(profile, "storage/chagok.sqlite"));
  assert.equal(inspection.prepare("PRAGMA user_version").get().user_version, 3);
  assert.equal(inspection.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  console.log(
    "Ledger smoke passed: correction, many-to-one/cross-month links, rounding, snapshots, close/reopen, batch rollback, rules, receipts, template export, full backup/restore, corruption/path rejection, UI and restart.",
  );
} finally {
  inspection?.close();
  await app.close();
}
