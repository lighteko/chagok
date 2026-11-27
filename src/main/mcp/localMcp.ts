import { createMcpHandler } from "@modelcontextprotocol/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { McpStatus } from "@/shared/desktop/contracts";
import type { AppDatabase } from "../storage/database";
import { createLedgerTools } from "./ledgerTools";

const HOST = "127.0.0.1";
const ENDPOINT = "/mcp";

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  expectedToken: Buffer,
  handler: ReturnType<typeof createMcpHandler>,
) {
  response.setHeader("Cache-Control", "no-store");
  if (request.headers.host !== url.host || request.headers.origin !== undefined) {
    response.writeHead(403).end();
    return;
  }
  if (request.url !== ENDPOINT) {
    response.writeHead(404).end();
    return;
  }
  const bearer = /^Bearer +(\S+)$/i.exec(request.headers.authorization ?? "")?.[1];
  const supplied = Buffer.from(bearer ?? "");
  if (supplied.length !== expectedToken.length || !timingSafeEqual(supplied, expectedToken)) {
    response.writeHead(401, { "WWW-Authenticate": "Bearer" }).end();
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" }).end();
    return;
  }

  const headers = new Headers();
  for (const [name, values] of Object.entries(request.headersDistinct)) {
    if (name !== "authorization") for (const value of values ?? []) headers.append(name, value);
  }
  const abort = new AbortController();
  response.once("close", () => abort.abort());
  const incoming = new Request(url, {
    method: "POST",
    headers,
    body: Readable.toWeb(request),
    // Node's Fetch API requires duplex for a streaming request body.
    duplex: "half",
    signal: abort.signal,
  });
  const outgoing = await handler.fetch(incoming);
  response.writeHead(outgoing.status, Object.fromEntries(outgoing.headers));
  if (outgoing.body) await pipeline(outgoing.body, response);
  else response.end();
}

export class LocalMcp {
  private connection: {
    server: Server;
    token: string;
    canClassify: boolean;
    handler: ReturnType<typeof createMcpHandler>;
    startup: AbortController;
  } | null = null;

  constructor(
    private readonly version: string,
    private readonly getDatabase: () => AppDatabase,
    private readonly onLedgerChanged: () => void,
  ) {}

  status(): McpStatus {
    const address = this.connection?.server.address();
    const url = address && typeof address === "object" ? `http://${HOST}:${address.port}${ENDPOINT}` : null;
    return { url, canClassify: Boolean(url && this.connection?.canClassify) };
  }

  token(): string | undefined {
    return this.connection?.server.listening ? this.connection.token : undefined;
  }

  async start(canClassify: boolean): Promise<McpStatus> {
    if (this.connection) return this.status();
    const token = randomBytes(32).toString("base64url");
    const expectedToken = Buffer.from(token);
    const handler = createMcpHandler(
      () =>
        createLedgerTools(
          this.version,
          () => {
            if (this.connection?.server !== server) throw new Error("MCP 연결이 종료되었습니다.");
            return this.getDatabase();
          },
          canClassify ? { onChanged: this.onLedgerChanged } : undefined,
        ),
      { maxRequestBodySize: (canClassify ? 640 : 32) * 1024, maxSubscriptions: 0 },
    );
    const server = createServer(
      { headersTimeout: 5000, requestTimeout: 10000, connectionsCheckingInterval: 1000 },
      (request, response) => {
        const { url } = this.status();
        if (this.connection?.server !== server || !url) {
          response.writeHead(503).end();
          return;
        }
        void handleRequest(request, response, new URL(url), expectedToken, handler).catch(() => {
          if (response.headersSent) response.destroy();
          else if (!response.destroyed) response.writeHead(500).end();
        });
      },
    );
    const startup = new AbortController();
    this.connection = { server, token, canClassify, handler, startup };
    try {
      await once(server.listen(0, HOST), "listening", { signal: startup.signal });
      server.on("error", () => {
        if (this.connection?.server === server) this.stop();
      });
      return this.status();
    } catch {
      if (startup.signal.aborted) return this.status();
      this.stop();
      throw new Error("MCP 연결을 시작하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  stop(): void {
    const connection = this.connection;
    if (!connection) return;
    this.connection = null;
    connection.startup.abort();
    connection.server.close();
    connection.server.closeAllConnections();
    void connection.handler.close().catch(() => console.error("MCP 연결을 정리하지 못했습니다."));
  }
}
