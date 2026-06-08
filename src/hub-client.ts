// Thin HTTP client for the Alby Hub admin API.
//
// Auth: Bearer token in the `Authorization` header. Many Alby Hub deployments
// also accept an `X-API-Key` header — if your Hub rejects Bearer, see the
// `proxy_request` tool's `extra_headers` arg to pass arbitrary headers.
//
// Endpoint paths are passed as-relative-to-the-base-URL; the client just
// glues base + path. This keeps the wrapper minimal — typed wrappers in
// tools/ encode the specific endpoints they hit, and proxy_request lets the
// agent reach anything else.

import type { Config } from "./config.js";

export type HubResponse<T = unknown> = {
  status: number;
  status_text: string;
  ok: boolean;
  headers: Record<string, string>;
  body: T;
};

export class HubClient {
  constructor(private readonly config: Config) {}

  get baseUrl(): string {
    return this.config.ALBYHUB_URL.replace(/\/+$/, "");
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts: {
      body?: unknown;
      query?: Record<string, string>;
      extraHeaders?: Record<string, string>;
      timeoutMs?: number;
    } = {},
  ): Promise<HubResponse<T>> {
    let url = this.baseUrl + (path.startsWith("/") ? path : "/" + path);
    if (opts.query && Object.keys(opts.query).length > 0) {
      const qs = new URLSearchParams(opts.query);
      url += (url.includes("?") ? "&" : "?") + qs.toString();
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.ALBYHUB_TOKEN}`,
      Accept: "application/json",
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.extraHeaders ?? {}),
    };
    const init: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };
    if (opts.body !== undefined) {
      init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    }
    const timeoutMs = opts.timeoutMs ?? 15_000;
    const controller = new AbortController();
    init.signal = controller.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let body: unknown = text;
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json") && text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          // leave body as raw text
        }
      }
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (responseHeaders[k] = v));
      return {
        status: res.status,
        status_text: res.statusText,
        ok: res.ok,
        headers: responseHeaders,
        body: body as T,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  get<T = unknown>(path: string, query?: Record<string, string>) {
    return this.request<T>("GET", path, { query });
  }
}
