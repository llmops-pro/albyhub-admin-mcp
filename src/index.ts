#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";

// Load .env only from the binary's own directory — avoids env-var collision
// when multiple MCP servers run from the same Claude Code session.
function tryLoadEnvFile(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "..", ".env");
  try {
    process.loadEnvFile(path);
  } catch {
    // file missing — fine
  }
}
tryLoadEnvFile();

import { HubClient } from "./hub-client.js";
import { AuditLog } from "./safety/audit-log.js";
import { ConfirmStore } from "./safety/confirm.js";
import { RateLimiter } from "./safety/rate-limiter.js";
import { registerAllTools } from "./tools/register.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const audit = new AuditLog(config.ALBYHUB_AUDIT_PATH);
  const rateLimiter = new RateLimiter({ requests: config.ALBYHUB_MAX_REQUESTS_PER_MINUTE });
  const confirm = new ConfirmStore();
  const hub = new HubClient(config);

  const server = new McpServer(
    { name: "albyhub-admin-mcp", version: "0.1.1" },
    { capabilities: { tools: {} } },
  );

  registerAllTools({ server, config, hub, audit, rateLimiter, confirm });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  await audit.record({
    tool: "_startup",
    outcome: "ok",
    result: {
      hub_url: hub.baseUrl,
      read_only: config.ALBYHUB_READ_ONLY,
      require_confirm: config.ALBYHUB_REQUIRE_CONFIRM,
      rate_limits: rateLimiter.snapshot(),
    },
  });

  const shutdown = async (signal: string): Promise<void> => {
    await audit.record({ tool: "_shutdown", outcome: "ok", result: { signal } });
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  process.stderr.write(`albyhub-admin-mcp: fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
