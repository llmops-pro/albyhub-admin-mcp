// The generic escape-hatch tool: lets the agent hit any path on the Hub.
//
// Why ship this: Alby Hub's HTTP API has evolved across versions and isn't
// publicly versioned in a stable way. Rather than ship typed wrappers that
// might be wrong against the buyer's specific Hub version, we ship one
// reflective tool that can reach anything. The typed tools (list_apps,
// get_balances, etc.) are convenience layers on top — if their endpoint
// guesses fail, the agent falls back to proxy_request and the user can
// discover the right path manually.
//
// Safety: same pipeline as the typed tools. READ_ONLY blocks any non-GET.
// REQUIRE_CONFIRM blocks any non-GET unless followed by confirm_request.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { HubClient } from "../hub-client.js";
import type { AuditLog } from "../safety/audit-log.js";
import type { ConfirmStore } from "../safety/confirm.js";
import type { RateLimiter } from "../safety/rate-limiter.js";
import { errorResult, textResult } from "./_result.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const inputSchema = {
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
    .describe("HTTP method. GET/HEAD/OPTIONS are always allowed; others gated by READ_ONLY + REQUIRE_CONFIRM."),
  path: z
    .string()
    .min(1)
    .regex(/^\//, "path must start with `/`")
    .describe("Path on the Hub, e.g. `/api/info` or `/api/channels`. Combined with ALBYHUB_URL."),
  query: z
    .record(z.string())
    .optional()
    .describe("Query-string params (string → string)."),
  body: z
    .any()
    .optional()
    .describe("Request body — passed as JSON if an object, raw if a string. Ignored for GET/HEAD/OPTIONS."),
  extra_headers: z
    .record(z.string())
    .optional()
    .describe("Extra HTTP headers to merge in. Useful if your Hub expects `X-API-Key` instead of `Authorization: Bearer`."),
  timeout_ms: z
    .number()
    .int()
    .positive()
    .max(60_000)
    .optional()
    .describe("Request timeout in ms (default 15000, max 60000)."),
};

export type ProxyDeps = {
  config: Config;
  hub: HubClient;
  audit: AuditLog;
  rateLimiter: RateLimiter;
  confirm: ConfirmStore;
};

export type ProxyParams = {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  extra_headers?: Record<string, string>;
  timeout_ms?: number;
};

export async function evaluateAndProxy(
  deps: ProxyDeps,
  params: ProxyParams,
  opts: { skipConfirmGate?: boolean; auditTool?: string } = {},
) {
  const auditTool = opts.auditTool ?? "albyhub_proxy_request";
  const inputForAudit = {
    method: params.method,
    path: params.path,
    has_body: params.body !== undefined,
    extra_header_keys: params.extra_headers ? Object.keys(params.extra_headers) : [],
  };
  const isWrite = !SAFE_METHODS.has(params.method.toUpperCase());

  if (isWrite && deps.config.ALBYHUB_READ_ONLY) {
    await deps.audit.record({
      tool: auditTool,
      outcome: "blocked",
      input: inputForAudit,
      blocked_reason: "ALBYHUB_READ_ONLY=true — non-GET methods are disabled",
    });
    return errorResult("ALBYHUB_READ_ONLY=true — non-GET methods are disabled");
  }

  const rate = deps.rateLimiter.take("requests");
  if (!rate.ok) {
    await deps.audit.record({
      tool: auditTool,
      outcome: "blocked",
      input: inputForAudit,
      blocked_reason: rate.reason,
    });
    return errorResult(rate.reason);
  }

  if (isWrite && deps.config.ALBYHUB_REQUIRE_CONFIRM && !opts.skipConfirmGate) {
    const summary = `${params.method.toUpperCase()} ${params.path}${params.body !== undefined ? " (with body)" : ""}`;
    const { token, expires_at } = deps.confirm.prepare({
      tool: auditTool,
      params: params as unknown as Record<string, unknown>,
      summary,
    });
    await deps.audit.record({
      tool: auditTool,
      outcome: "ok",
      input: inputForAudit,
      result: { confirmation_required: true, token },
    });
    return textResult({
      status: "confirmation_required",
      token,
      expires_at: new Date(expires_at).toISOString(),
      summary,
      next_step: `Call albyhub_confirm_request with token "${token}" to execute.`,
    });
  }

  try {
    const response = await deps.hub.request(params.method, params.path, {
      body: params.body,
      query: params.query,
      extraHeaders: params.extra_headers,
      timeoutMs: params.timeout_ms,
    });
    await deps.audit.record({
      tool: auditTool,
      outcome: response.ok ? "ok" : "error",
      input: inputForAudit,
      result: {
        status: response.status,
        ok: response.ok,
      },
      ...(response.ok ? {} : { error: `HTTP ${response.status} ${response.status_text}` }),
    });
    return textResult({
      status: response.status,
      status_text: response.status_text,
      ok: response.ok,
      headers: response.headers,
      body: response.body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await deps.audit.record({
      tool: auditTool,
      outcome: "error",
      input: inputForAudit,
      error: msg,
    });
    return errorResult(`${auditTool} failed: ${msg}`);
  }
}

export function registerProxyRequest(server: McpServer, deps: ProxyDeps): void {
  server.registerTool(
    "albyhub_proxy_request",
    {
      description:
        "Generic HTTP proxy to your Alby Hub admin API. Use this when no typed convenience tool exists for the endpoint you need. Returns the response status, headers, and (JSON-parsed when possible) body. Non-GET methods are gated by ALBYHUB_READ_ONLY and ALBYHUB_REQUIRE_CONFIRM. Pair with the Hub's own docs to discover endpoints; the typed wrappers (get_node_info, list_apps, get_balances) are layered on top of this and good defaults to start with.",
      inputSchema,
    },
    async (args) => evaluateAndProxy(deps, args as ProxyParams),
  );
}
