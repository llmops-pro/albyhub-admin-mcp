import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult } from "./_result.js";
import { evaluateAndProxy, type ProxyDeps, type ProxyParams } from "./proxy-request.js";

const inputSchema = {
  token: z.string().min(1).describe("Confirmation token from a previous non-GET proxy_request."),
};

export function registerConfirmRequest(server: McpServer, deps: ProxyDeps): void {
  server.registerTool(
    "albyhub_confirm_request",
    {
      description:
        "Execute a previously-prepared non-GET request, identified by its one-time token. Only meaningful when ALBYHUB_REQUIRE_CONFIRM=true. The token is consumed (single use) and the safety pipeline (read-only, rate limit) re-runs before the HTTP call.",
      inputSchema,
    },
    async ({ token }) => {
      const action = deps.confirm.consume(token);
      if (!action) {
        await deps.audit.record({
          tool: "albyhub_confirm_request",
          outcome: "blocked",
          input: { token_prefix: token.slice(0, 8) + "..." },
          blocked_reason: "token unknown or expired",
        });
        return errorResult("Token is unknown or expired. Call the original proxy_request again to get a fresh token.");
      }
      const params = action.params as unknown as ProxyParams;
      return evaluateAndProxy(deps, params, {
        skipConfirmGate: true,
        auditTool: "albyhub_confirm_request",
      });
    },
  );
}
