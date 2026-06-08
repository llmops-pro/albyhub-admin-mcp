import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import type { HubClient } from "../hub-client.js";
import type { AuditLog } from "../safety/audit-log.js";
import type { ConfirmStore } from "../safety/confirm.js";
import type { RateLimiter } from "../safety/rate-limiter.js";
import { registerConfirmRequest } from "./confirm-request.js";
import { registerGetBalances } from "./get-balances.js";
import { registerGetNodeInfo } from "./get-node-info.js";
import { registerListApps } from "./list-apps.js";
import { registerListChannels } from "./list-channels.js";
import { registerProxyRequest } from "./proxy-request.js";

export type ToolDeps = {
  server: McpServer;
  config: Config;
  hub: HubClient;
  audit: AuditLog;
  rateLimiter: RateLimiter;
  confirm: ConfirmStore;
};

export function registerAllTools(deps: ToolDeps): void {
  const { server, hub, audit } = deps;
  const proxyDeps = {
    config: deps.config,
    hub: deps.hub,
    audit: deps.audit,
    rateLimiter: deps.rateLimiter,
    confirm: deps.confirm,
  };

  // Generic escape hatch — always register so the agent can probe paths the
  // typed wrappers don't cover (or if a typed wrapper's path-guess is wrong).
  registerProxyRequest(server, proxyDeps);
  registerConfirmRequest(server, proxyDeps);

  // Typed read wrappers — all GETs, safe by construction.
  registerGetNodeInfo(server, hub, audit);
  registerGetBalances(server, hub, audit);
  registerListApps(server, hub, audit);
  registerListChannels(server, hub, audit);

  // v0.2 follow-ups: typed wrappers for write endpoints (create_app /
  // open_channel / close_channel) once we've verified the request shapes
  // against a real Hub. For now those are reachable via proxy_request with
  // the appropriate method + body.
}
