import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HubClient } from "../hub-client.js";
import type { AuditLog } from "../safety/audit-log.js";
import { errorResult, textResult } from "./_result.js";

export function registerGetBalances(server: McpServer, hub: HubClient, audit: AuditLog): void {
  server.registerTool(
    "albyhub_get_balances",
    {
      description:
        "Fetch hub balances (on-chain + lightning) from GET /api/balances. Distinct from nwc_get_balance — that one is a single sub-wallet's view via NWC; this one is the hub-wide aggregate including on-chain. If your Hub returns 404, probe with albyhub_proxy_request.",
    },
    async () => {
      try {
        const r = await hub.get("/api/balances");
        await audit.record({
          tool: "albyhub_get_balances",
          outcome: r.ok ? "ok" : "error",
          result: { status: r.status, ok: r.ok },
          ...(r.ok ? {} : { error: `HTTP ${r.status} ${r.status_text}` }),
        });
        return textResult({ status: r.status, ok: r.ok, body: r.body });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await audit.record({ tool: "albyhub_get_balances", outcome: "error", error: msg });
        return errorResult(`albyhub_get_balances failed: ${msg}`);
      }
    },
  );
}
