import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { get } from "node:http";
import { join, resolve } from "node:path";
import { _electron as electron, expect } from "@playwright/test";
import writeXlsx from "write-excel-file/node";

await mkdir("test-results", { recursive: true });
const profile = await mkdtemp(resolve("test-results/mcp-"));
const fixture = join(profile, "mcp.xlsx");
await writeXlsx(
  [
    ["거래일시", "출금", "입금", "거래후 잔액", "거래내용"],
    ...Array.from({ length: 51 }, (_, index) => [
      `2026-09-01 12:00:${String(index).padStart(2, "0")}`,
      0,
      1000,
      (index + 1) * 1000,
      "입금 시험",
    ]),
    ["2026-09-02 12:00:00", 1000, 0, 50000, "출금 시험"],
    ["2026-10-01 12:00:00", 0, 20000, 70000, "수업료"],
    ["2026-11-01 12:00:00", 0, 4500, 74500, "검증 수업료"],
    ["2026-11-02 12:00:00", null, null, null, "검증 수업료"],
  ],
  { sheet: "거래내역" },
).toFile(fixture);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const executable = process.argv.slice(2).find(argument => argument.endsWith(".exe"));
const launch = () =>
  electron.launch({
    executablePath: executable ? resolve(executable) : undefined,
    args: [...(executable ? [] : ["."]), `--user-data-dir=${profile}`],
    env,
  });

let id = 0;
function post(url, token, method, params = {}, extraHeaders = {}) {
  const version = params._meta?.["io.modelcontextprotocol/protocolVersion"] ?? "2025-11-25";
  return fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": version,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      ...(method.startsWith("notifications/") ? {} : { id: ++id }),
      method,
      params,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function rpc(...args) {
  const response = await post(...args);
  const body = await response.text();
  assert.equal(response.status, 200, body);
  const json = response.headers.get("content-type").startsWith("text/event-stream")
    ? JSON.parse(body.match(/^data: (.+)$/m)[1])
    : JSON.parse(body);
  assert.equal(json.id, id);
  return json;
}

const disabledStatus = { url: null, canClassify: false };
const toolError = response => response.error || response.result?.isError;
const callTool = ({ url, token }, name, args) => rpc(url, token, "tools/call", { name, arguments: args });

let app = await launch();
try {
  const page = await app.firstWindow();
  const api = (method, ...args) =>
    page.evaluate(({ method, args }) => window.chagok[method](...args), { method, args });
  await expect(page.getByRole("button", { name: "MCP 연결", exact: true })).toBeVisible();
  assert.equal(resolve(await app.evaluate(({ app }) => app.getPath("userData"))), profile);
  assert.deepEqual(await api("getMcpStatus"), disabledStatus);
  await app.evaluate(({ clipboard, dialog }, path) => {
    clipboard.writeText = text => {
      globalThis.mcpTestClipboard = text;
    };
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
  }, fixture);
  const preview = await api("previewTransactionImport");
  await api("commitTransactionImport", {
    token: preview.token,
    sheetId: preview.sheets[0].sheetId,
    accountName: "테스트계좌",
    months: ["2026-09", "2026-10", "2026-11"],
  });
  const october = (await api("listTransactions", { month: "2026-10", search: "", filter: "all", page: 0 })).rows[0];
  const octoberLedger = await api("getLedger", "2026-10");
  await api("classifyTransaction", {
    transactionId: october.id,
    direction: "income",
    categoryId: octoberLedger.categories.find(row => row.name === "수업료").id,
    group: "other",
    settlementMonth: "2026-10",
    withdrawal: october.withdrawal,
    deposit: october.deposit,
    description: october.description,
    note: "",
    confirmed: true,
    ruleId: null,
  });

  await page.getByRole("button", { name: "MCP 연결", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "MCP 연결" });
  const enable = dialog.getByRole("button", { name: "연결 켜기" });
  const disable = dialog.getByRole("button", { name: "연결 끄기" });
  const copy = dialog.getByRole("button", { name: "토큰 복사" });
  const allowClassification = dialog.getByRole("checkbox", { name: "거래 분류 및 규칙 관리 허용" });
  async function connect(writable = false) {
    await expect(allowClassification).not.toBeChecked();
    if (writable) await allowClassification.check();
    await enable.click();
    const urlInput = dialog.getByLabel("서버 주소");
    await expect(urlInput).toHaveValue(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    const url = await urlInput.inputValue();
    await copy.click();
    await expect(dialog.getByRole("status")).toHaveText("토큰을 복사했습니다.");
    const token = await app.evaluate(() => globalThis.mcpTestClipboard);
    assert.match(token, /^[\w-]{43}$/);
    assert.deepEqual(await api("getMcpStatus"), { url, canClassify: writable });
    return { url, token };
  }
  const { url, token } = await connect();

  assert.equal((await post(url, undefined, "tools/list")).status, 401);
  assert.equal((await post(url, "x".repeat(43), "tools/list")).status, 401);
  assert.equal((await post(url, token, "tools/list", {}, { Authorization: `bearer ${token}` })).status, 200);
  assert.equal((await post(url, token, "tools/list", {}, { Origin: "https://example.com" })).status, 403);
  const headers = { Authorization: `Bearer ${token}` };
  const wrongHostStatus = await new Promise((resolve, reject) => {
    get(url, { headers: { ...headers, Host: "example.com" }, signal: AbortSignal.timeout(5000) }, response => {
      response.resume();
      resolve(response.statusCode);
    }).once("error", reject);
  });
  assert.equal(wrongHostStatus, 403);
  assert.equal((await fetch(url, { headers })).status, 405);
  assert.equal((await fetch(new URL("/wrong", url), { headers })).status, 404);
  assert.equal((await post(url, token, "tools/list", { padding: "x".repeat(33000) })).status, 413);
  const initialization = await rpc(url, token, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "chagok-smoke", version: "1.0.0" },
  });
  assert.equal(initialization.result.serverInfo.name, "chagok");
  assert.equal(initialization.result.protocolVersion, "2025-11-25");
  assert.equal((await post(url, token, "notifications/initialized")).status, 202);

  const modern = await rpc(
    url,
    token,
    "tools/list",
    {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "chagok-smoke", version: "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
    { "Mcp-Method": "tools/list" },
  );
  const {
    result: { tools },
  } = await rpc(url, token, "tools/list");
  assert.deepEqual(tools, modern.result.tools);
  assert.deepEqual(
    tools.map(tool => tool.name),
    [
      "list_transactions",
      "get_monthly_settlement",
      "list_transactions_for_classification",
      "list_classification_rules",
    ],
  );
  assert(tools.every(tool => tool.annotations.readOnlyHint));
  const call = (name, args) => rpc(url, token, "tools/call", { name, arguments: args });
  const first = (await call("list_transactions", { month: "2026-09" })).result.structuredContent;
  assert.equal(first.total, 52);
  assert.equal(first.pageSize, 50);
  assert.equal(first.rows.length, 50);
  assert.equal(first.summary.deposits, 51000);
  assert.equal(first.rows[0].description, "출금 시험");
  assert.equal(Object.hasOwn(first.rows[0], "fileName"), false);
  const second = (await call("list_transactions", { month: "2026-09", page: 1 })).result.structuredContent;
  assert.equal(second.rows.length, 2);
  assert(!first.rows.some(row => row.id === second.rows[0].id));
  const filtered = (await call("list_transactions", { month: "2026-09", search: "입금", filter: "withdrawal" })).result
    .structuredContent;
  assert.equal(filtered.total, 0);
  assert.equal(filtered.summary.count, 52);
  const invalid = await call("list_transactions", { month: "2026-13" });
  assert(toolError(invalid));
  const month = "2026-09";
  assert(toolError(await call("apply_classification_rules", { month })));
  assert(toolError(await call("classify_transactions", { month, entries: [] })));
  assert(toolError(await call("save_classification_rule", {})));
  const settlement = () =>
    call("get_monthly_settlement", { month: "2026-10" }).then(value => value.result.structuredContent);
  const open = await settlement();
  assert.equal(open.closed, false);
  assert.equal(open.income, 20000);
  assert.equal(open.net, 20000);
  assert.equal(open.pending, 0);
  await api("closePeriod", "2026-10");
  assert.deepEqual(await settlement(), { ...open, closed: true });

  await disable.click();
  await expect(enable).toBeEnabled();
  await assert.rejects(post(url, token, "tools/list"), { name: "TypeError" });
  const writable = await connect(true);
  const { url: newUrl, token: newToken } = writable;
  assert.notEqual(newToken, token);
  assert.equal((await post(newUrl, token, "tools/list")).status, 401);
  assert.equal((await post(newUrl, newToken, "tools/list")).status, 200);

  const writableTools = (await rpc(newUrl, newToken, "tools/list")).result.tools;
  assert.deepEqual(
    writableTools.filter(tool => !tool.annotations.readOnlyHint).map(tool => tool.name),
    ["apply_classification_rules", "classify_transactions", "save_classification_rule"],
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByLabel("정산월", { exact: true }).fill(month);
  await page.getByRole("navigation", { name: "작업 메뉴" }).getByRole("button", { name: "월별 정산" }).click();
  await expect(page.getByText(/미분류·미확정 52건/)).toBeVisible();

  const mutate = (name, args) => callTool(writable, name, args);
  const getData = async (name, args) => {
    const response = await mutate(name, args);
    assert(!toolError(response), JSON.stringify(response));
    return response.result.structuredContent;
  };
  const queue = (args = {}) => getData("list_transactions_for_classification", { month, ...args });
  const draftInput = (row, direction, categoryId, options) => ({
    transactionId: row.id,
    expectedRevision: row.revision,
    direction,
    categoryId,
    ...options,
  });
  const pending = await queue();
  assert.equal(pending.total, 52);
  assert.equal(pending.rows.length, 50);
  assert.equal(pending.rows[0].revision, null);
  assert.equal((await queue({ page: 1 })).rows.length, 2);
  const rent = pending.categories.find(row => row.name === "임차료").id;
  const tuition = pending.categories.find(row => row.name === "수업료").id;
  const rule = {
    id: "mcp-test-rent",
    name: "출금 시험 규칙",
    field: "description",
    contains: "출금 시험",
    direction: "expense",
    categoryId: rent,
  };
  assert.deepEqual(await getData("save_classification_rule", rule), await getData("save_classification_rule", rule));
  const listedRule = (await getData("list_classification_rules", {})).rules[0];
  assert.equal(listedRule.id, rule.id);
  assert.match(listedRule.revision, /^[a-f0-9]{64}$/);
  assert(toolError(await mutate("save_classification_rule", { ...rule, enabled: false })));
  assert.deepEqual(await getData("apply_classification_rules", { month, confirm: false }), {
    month,
    suggested: 1,
    confirmed: 0,
  });
  assert.equal((await queue()).total, 51);
  const ruleDraft = (await queue({ status: "pending", page: 1 })).rows.find(row => row.classification);
  assert.equal(ruleDraft.classification.ruleId, rule.id);
  assert.equal(ruleDraft.classification.confirmed, false);
  assert.match(ruleDraft.revision, /^[a-f0-9]{64}$/);
  assert.deepEqual(await getData("apply_classification_rules", { month }), { month, suggested: 0, confirmed: 1 });
  await expect(page.getByText(/미분류·미확정 51건/)).toBeVisible();
  assert.deepEqual(await getData("apply_classification_rules", { month }), { month, suggested: 0, confirmed: 0 });
  assert.equal(
    (await getData("save_classification_rule", { ...rule, expectedRevision: listedRule.revision, enabled: false })).rule
      .enabled,
    false,
  );

  const [firstIncome, secondIncome] = (await queue()).rows;
  const classify = entries => getData("classify_transactions", { month, entries });
  assert.equal(
    (await classify([draftInput(secondIncome, "income", tuition, { confirmed: false })])).rows[0].confirmed,
    false,
  );
  const staleAndValid = [draftInput(firstIncome, "income", tuition), draftInput(secondIncome, "income", tuition)];
  assert(toolError(await mutate("classify_transactions", { month, entries: staleAndValid })));
  const latest = (await queue({ status: "pending" })).rows;
  assert.equal(latest.find(row => row.id === firstIncome.id).classification, null);
  const latestDraft = latest.find(row => row.id === secondIncome.id);
  assert.equal(latestDraft.classification.confirmed, false);
  const changes = await classify([
    draftInput(firstIncome, "income", tuition),
    draftInput(latestDraft, "income", tuition),
  ]);
  assert.equal(changes.updated, 2);
  assert(changes.rows.every(row => row.confirmed && row.deposit === 1000 && row.settlementMonth === month));
  await expect(page.getByText(/미분류·미확정 49건/)).toBeVisible();
  assert(
    toolError(await mutate("classify_transactions", { month, entries: [draftInput(firstIncome, "income", tuition)] })),
  );
  assert(
    toolError(
      await mutate("classify_transactions", {
        month: "2026-10",
        entries: [draftInput({ id: october.id, revision: null }, "income", tuition)],
      }),
    ),
  );
  assert(toolError(await mutate("apply_classification_rules", { month: "2026-10" })));

  const issueMonth = "2026-11";
  await getData("save_classification_rule", {
    ...rule,
    id: "mcp-test-tuition",
    name: "검증 수업료 규칙",
    contains: "검증 수업료",
    direction: "income",
    categoryId: tuition,
  });
  assert.deepEqual(await getData("apply_classification_rules", { month: issueMonth }), {
    month: issueMonth,
    suggested: 1,
    confirmed: 1,
  });
  const [issueRow] = (await queue({ month: issueMonth, status: "pending" })).rows;
  assert(issueRow.issues.length);
  assert.equal(issueRow.classification.confirmed, false);
  assert(
    toolError(
      await mutate("classify_transactions", {
        month: issueMonth,
        entries: [draftInput(issueRow, "income", tuition, { note: "원본 확인" })],
      }),
    ),
  );
  const audit = (await api("getLedgerAudit", month, 0)).rows;
  assert.equal(audit.filter(row => row.action === "MCP 거래 분류").length, 3);
  for (const action of ["MCP 규칙 제안", "MCP 규칙 확정", "MCP 분류 규칙 저장"])
    assert(audit.some(row => row.action === action));

  await app.evaluate(
    ({ dialog }, backup) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: backup });
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backup] });
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    },
    join(profile, "mcp.chagok"),
  );
  assert(await api("createBackup"));
  await api("restoreBackup").catch(error => {
    if (!/context was destroyed|closed|navigation/i.test(error.message)) throw error;
  });
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("button", { name: "MCP 연결", exact: true })).toBeVisible();
  assert.deepEqual(await api("getMcpStatus"), disabledStatus);
  await assert.rejects(post(newUrl, newToken, "tools/list"), { name: "TypeError" });
  await page.getByRole("button", { name: "MCP 연결", exact: true }).click();
  const afterRestore = await connect();
  await app.close();
  app = undefined;
  await assert.rejects(post(afterRestore.url, afterRestore.token, "tools/list"), { name: "TypeError" });
  app = await launch();
  const restarted = await app.firstWindow();
  assert.deepEqual(await restarted.evaluate(() => window.chagok.getMcpStatus()), disabledStatus);
  console.log(
    "MCP verified: authentication, classification permissions, rule automation, audit and settlement safeguards, and connection lifecycle.",
  );
} finally {
  await app?.close();
}
