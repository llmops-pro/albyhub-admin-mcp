// Lists "apps" — Alby Hub's term for NWC connections, which are the sub-wallets
// + paired clients that hold a connection string. Each app has its own
// per-app budget and scope; this is the canonical place to inventory what's
// connected to your hub.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HubClient } from "../hub-client.js";
import type { AuditLog } from "../safety/audit-log.js";
import { errorResult, textResult } from "./_result.js";

export function registerListApps(server: McpServer, hub: HubClient, audit: AuditLog): void {
  server.registerTool(
    "albyhub_list_apps",
    {
      description:
        "List NWC connections / sub-wallets ('apps') currently provisioned on the Hub. Each entry typically includes name, pubkey, scope, daily budget, and creation timestamp. Hits GET /api/apps. Use this to inventory what's connected to your Hub and what each connection's budget cap is.",
    },
    async () => {
      try {
        const r = await hub.get("/api/apps");
        await audit.record({
          tool: "albyhub_list_apps",
          outcome: r.ok ? "ok" : "error",
          result: { status: r.status, ok: r.ok, app_count: Array.isArray(r.body) ? r.body.length : null },
          ...(r.ok ? {} : { error: `HTTP ${r.status} ${r.status_text}` }),
        });
        return textResult({ status: r.status, ok: r.ok, body: r.body });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await audit.record({ tool: "albyhub_list_apps", outcome: "error", error: msg });
        return errorResult(`albyhub_list_apps failed: ${msg}`);
      }
    },
  );
}
