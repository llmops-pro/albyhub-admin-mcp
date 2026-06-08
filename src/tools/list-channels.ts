import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HubClient } from "../hub-client.js";
import type { AuditLog } from "../safety/audit-log.js";
import { errorResult, textResult } from "./_result.js";

export function registerListChannels(server: McpServer, hub: HubClient, audit: AuditLog): void {
  server.registerTool(
    "albyhub_list_channels",
    {
      description:
        "List Lightning channels — typically peer pubkey, capacity, local/remote balance, public/private flag, online status. Hits GET /api/channels. The hub-wide view (vs. nwc-mcp which has no channel concept). Useful for spotting offline channels, low inbound, etc.",
    },
    async () => {
      try {
        const r = await hub.get("/api/channels");
        await audit.record({
          tool: "albyhub_list_channels",
          outcome: r.ok ? "ok" : "error",
          result: { status: r.status, ok: r.ok, channel_count: Array.isArray(r.body) ? r.body.length : null },
          ...(r.ok ? {} : { error: `HTTP ${r.status} ${r.status_text}` }),
        });
        return textResult({ status: r.status, ok: r.ok, body: r.body });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await audit.record({ tool: "albyhub_list_channels", outcome: "error", error: msg });
        return errorResult(`albyhub_list_channels failed: ${msg}`);
      }
    },
  );
}
