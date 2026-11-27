import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import writeXlsx from "write-excel-file/node";
import { _electron as electron, expect } from "@playwright/test";

await mkdir("test-results", { recursive: true });
const profile = await mkdtemp(resolve("test-results/tutorial-"));
const fixture = join(profile, "tutorial.xlsx");
await writeXlsx(
  [
    ["거래일시", "출금", "입금", "거래후 잔액", "거래내용"],
    ["2026-09-01 10:00:00", 0, 100000, 100000, "수업료 입금"],
    ["2026-09-02 10:00:00", 15000, 0, 85000, "카드대금 출금"],
  ],
  { sheet: "거래내역" },
).toFile(fixture);
const receipt = join(profile, "receipt.png");
await writeFile(
  receipt,
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ2kAAAAASUVORK5CYII=", "base64"),
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const executable = process.argv.slice(2).find(arg => arg.endsWith(".exe"));
const launch = () =>
  electron.launch({
    executablePath: executable ? resolve(executable) : undefined,
    args: [...(executable ? [] : ["."]), `--user-data-dir=${profile}`],
    env,
  });
let app = await launch();
try {
  assert.equal(
    resolve(await app.evaluate(({ app }) => app.getPath("userData"))),
    profile,
    "Tutorial test must use its isolated profile",
  );
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const api = (method, ...args) =>
    page.evaluate(({ method, args }) => window.chagok[method](...args), { method, args });
  const guide = page.getByRole("region", { name: "차곡 사용 안내", exact: true });
  const step = async number => expect(guide.getByText(`사용 안내 ${number} / 8`, { exact: true })).toBeVisible();
  const expand = async () => {
    const button = guide.getByRole("button", { name: "안내 펼치기", exact: true });
    if (await button.count()) await button.click();
  };
  const next = async () => {
    await expand();
    await guide.getByRole("button", { name: "다음 단계", exact: true }).click();
  };
  const choose = path =>
    app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: !path, filePaths: path ? [path] : [] });
    }, path);
  const saveTo = path =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, path);
  await expect(page.getByRole("heading", { name: "거래내역", exact: true })).toBeVisible();
  await expect(guide).toHaveCount(0);
  await page.getByRole("button", { name: "사용 안내", exact: true }).click();
  await step(1);
  await guide.getByRole("button", { name: "정산월 선택으로 이동", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "정산월", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "정산월", exact: true }).fill("2026-09");
  await expand();
  await expect(guide.getByRole("status")).toContainText("2026-09");
  // Browse any step without implicitly creating or closing financial records.
  await guide.getByRole("button", { name: "사용 안내 목차", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^3\s+거래 확인/ })
    .click();
  await step(3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "분류·확인", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(guide.getByRole("button", { name: "확인할 거래 열기", exact: true })).toBeDisabled();
  assert.equal((await api("getLedger", "2026-09")).report.entries.length, 0);
  await page.setViewportSize({ width: 900, height: 640 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "test-results/chagok-tutorial-narrow.png" });
  await page.setViewportSize({ width: 1240, height: 820 });
  await guide.getByRole("button", { name: "사용 안내 닫기", exact: true }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole("button", { name: "사용 안내", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "사용 안내", exact: true }).click();
  await step(3);
  await guide.getByRole("button", { name: "이전", exact: true }).click();
  await step(2);
  await choose(null);
  await guide.getByRole("button", { name: "거래내역 파일 선택", exact: true }).click();
  await step(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expand();
  await choose(fixture);
  await guide.getByRole("button", { name: "거래내역 파일 선택", exact: true }).click();
  await expect(page.getByRole("heading", { name: "거래내역 미리보기", exact: true })).toBeVisible();
  await page.getByLabel("계좌 이름", { exact: true }).fill("튜토리얼 운영계좌");
  await page.getByRole("button", { name: "2건 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expand();
  await expect(guide.getByRole("status")).toContainText("통장 거래 2건");
  await next();
  await step(3);
  await guide.getByRole("button", { name: "확인할 거래 열기", exact: true }).click();
  await page.getByRole("combobox", { name: "정산 항목", exact: true }).selectOption({ label: "수업료" });
  await page.getByRole("checkbox", { name: "금액과 분류를 확인했습니다", exact: true }).check();
  await page.getByRole("button", { name: "분류·보정 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expand();
  await expect(guide.getByRole("status")).toContainText("확인할 거래 1건");
  await guide.getByRole("button", { name: "확인할 거래 열기", exact: true }).click();
  await page.getByRole("combobox", { name: "정산 항목", exact: true }).selectOption({ label: "기타지출" });
  await page.getByRole("combobox", { name: "지출 구분", exact: true }).selectOption("card");
  await page.getByRole("checkbox", { name: "금액과 분류를 확인했습니다", exact: true }).check();
  await page.getByRole("button", { name: "분류·보정 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expand();
  await expect(guide.getByRole("status")).toContainText("분류를 확인했습니다");
  await next();
  await step(4);
  await guide.getByRole("button", { name: "별도 지출 입력 열기", exact: true }).click();
  await page.getByLabel("사용일", { exact: true }).fill("2026-09-05");
  await page.getByLabel("내용", { exact: true }).fill("튜토리얼 카드 사용");
  await page.getByLabel("금액 (원)", { exact: true }).fill("10000");
  await page.getByRole("combobox", { name: "지출 구분", exact: true }).selectOption("card");
  await page.getByLabel("결제자", { exact: true }).fill("담당자");
  await page.getByLabel("결제수단", { exact: true }).fill("개인 카드");
  await page.getByRole("button", { name: "지출 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expand();
  await expect(guide.getByRole("status")).toContainText("별도 지출 1건");
  await guide.getByRole("button", { name: "영수증 첨부 위치 열기", exact: true }).click();
  await choose(receipt);
  await page.getByRole("dialog").getByRole("button", { name: "영수증 첨부", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("receipt.png", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await next();
  await step(5);
  await guide.getByRole("button", { name: "통장 출금 연결 열기", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/튜토리얼 카드 사용/)).toBeVisible();
  const rows = await api("listTransactions", { month: "2026-09", search: "", filter: "all", page: 0 });
  const bill = rows.rows.find(row => row.description === "카드대금 출금");
  await page.getByLabel("지출로 분류한 통장 출금").selectOption(bill.id);
  await page.getByRole("button", { name: "연결 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expand();
  await expect(guide.getByRole("status")).toContainText("1건에 통장 출금이 연결");
  await next();
  await step(6);
  await expect(guide.getByRole("status")).toContainText("85,000원");
  await guide.getByRole("button", { name: "배분 설정 열기", exact: true }).click();
  await expect(page.getByLabel("대상 1", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("대상 2", { exact: true })).toHaveValue("");
  await page.getByLabel("대상 1", { exact: true }).fill("담당자 A");
  await page.getByLabel("대상 2", { exact: true }).fill("담당자 B");
  const percentages = page.getByRole("dialog").getByRole("spinbutton");
  await percentages.nth(0).fill("75");
  await percentages.nth(1).fill("25");
  await page.getByRole("button", { name: "이번 달 배분 설정 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("담당자 A · 75%", { exact: true })).toBeVisible();
  await next();
  await step(7);
  await guide.getByRole("button", { name: "마감·출력 위치 보기", exact: true }).click();
  assert.equal((await api("getLedger", "2026-09")).closed, false);
  await expect(page.getByRole("button", { name: "이번 달 마감", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "이번 달 마감", exact: true }).click();
  await page.getByRole("button", { name: "마감 확정", exact: true }).click();
  await expect(page.getByText("마감됨", { exact: true })).toBeVisible();
  const output = join(profile, "tutorial-settlement.xlsx");
  await saveTo(output);
  await page.getByRole("button", { name: "정산표 엑셀 출력", exact: true }).click();
  await expect(page.getByText(/tutorial-settlement.xlsx에 정산표를 저장/)).toBeVisible();
  assert.ok((await stat(output)).size > 0);
  await expand();
  await expect(guide.getByRole("status")).toContainText("마감되어 있습니다");
  await next();
  await step(8);
  await guide.getByRole("button", { name: "백업·복원 열기", exact: true }).click();
  const backup = join(profile, "tutorial.chagok");
  await saveTo(backup);
  await page.getByRole("button", { name: "전체 장부 백업", exact: true }).click();
  await expect(page.getByText(/tutorial.chagok에 전체 장부/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expand();
  await expect(guide.getByRole("status")).toContainText("백업 파일을 저장했습니다");
  await page.screenshot({ path: "test-results/chagok-tutorial-complete.png" });
  await guide.getByRole("button", { name: "안내 마치기", exact: true }).click();
  await expect(guide).toHaveCount(0);
  await page.getByRole("button", { name: "사용 안내", exact: true }).click();
  await step(1);
  await page.getByRole("textbox", { name: "정산월", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "test-results/chagok-tutorial.png" });
  const ledger = await api("getLedger", "2026-09");
  assert.equal(ledger.expenses.length, 1);
  assert.equal(ledger.links.length, 1);
  assert.equal(ledger.snapshots.length, 1);
  assert.equal(ledger.report.net, 85000);
  assert.deepEqual(
    ledger.report.allocations.map(row => row.amount),
    [63750, 21250],
  );
  assert.deepEqual(errors, []);
  await app.close();
  app = await launch();
  const restarted = await app.firstWindow();
  await expect(restarted.getByRole("button", { name: "사용 안내", exact: true })).toBeVisible();
  await expect(restarted.getByRole("region", { name: "차곡 사용 안내", exact: true })).toHaveCount(0);
  await restarted.getByRole("button", { name: "사용 안내", exact: true }).click();
  await expect(restarted.getByText("사용 안내 1 / 8", { exact: true })).toBeVisible();
  assert.equal((await restarted.evaluate(() => window.chagok.getLedger("2026-09"))).report.net, 85000);
  console.log(
    "PASS: opt-in 8-step tutorial, empty-state guards, pause/resume, contents, real import/classification/expense/receipt/link/settings/close/export/backup, final restart of guide and 900px layout.",
  );
} finally {
  await app.close();
}
