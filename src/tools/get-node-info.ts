// Typed wrapper around GET /api/info — node identity, network, version, etc.
//
// If your Alby Hub version exposes node info at a different path, fall back to
// the generic albyhub_proxy_request tool with method="GET" and the correct path.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HubClient } from "../hub-client.js";
import type { AuditLog } from "../safety/audit-log.js";
import { errorResult, textResult } from "./_result.js";

export function registerGetNodeInfo(server: McpServer, hub: HubClient, audit: AuditLog): void {
  server.registerTool(
    "albyhub_get_node_info",
    {
      description:
        "Fetch Alby Hub node info (identity, network, version) from GET /api/info. Convenience wrapper. If your Hub returns 404 here, the endpoint path differs in your version — use albyhub_proxy_request to probe alternatives like /api/node or /info.",
    },
    async () => {
      try {
        const r = await hub.get("/api/info");
        await audit.record({
          tool: "albyhub_get_node_info",
          outcome: r.ok ? "ok" : "error",
          result: { status: r.status, ok: r.ok },
          ...(r.ok ? {} : { error: `HTTP ${r.status} ${r.status_text}` }),
        });
        return textResult({ status: r.status, ok: r.ok, body: r.body });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await audit.record({ tool: "albyhub_get_node_info", outcome: "error", error: msg });
        return errorResult(`albyhub_get_node_info failed: ${msg}`);
      }
    },
  );
}
