# albyhub-admin-mcp

**Node-admin operations on your Alby Hub, exposed to an LLM agent.** MCP server that wraps the Alby Hub HTTP API — read node info, balances, channels, NWC sub-wallets. Where NWC ([`nwc-mcp`](https://npmjs.com/package/nwc-mcp)) ends (it's wallet-scoped), this server picks up: hub-wide on-chain balance, channel state, sub-wallet inventory.

> **v0.1 — defensive design.** Alby Hub's admin API has evolved across versions and isn't publicly versioned in a stable way. So v0.1 ships **one generic proxy tool** that hits any path (the escape hatch) plus typed wrappers around a few well-established endpoints. If a typed wrapper's endpoint-guess fails against your Hub version, the proxy lets you discover the right path without re-shipping. v0.2 hardens the typed wrappers once smoke-tested against real Hubs.

---

## The six tools

| Tool | Method | Path | Purpose |
|---|---|---|---|
| `albyhub_proxy_request` | * | * | Generic HTTP proxy — escape hatch for any endpoint not yet wrapped. |
| `albyhub_confirm_request` | * | * | Two-step confirm dispatcher for proxy_request. |
| `albyhub_get_node_info` | GET | `/api/info` | Node identity, network, version. |
| `albyhub_get_balances` | GET | `/api/balances` | On-chain + Lightning aggregate balances. |
| `albyhub_list_apps` | GET | `/api/apps` | NWC connections (sub-wallets) provisioned on this hub. |
| `albyhub_list_channels` | GET | `/api/channels` | Lightning channels with status + capacities. |

All typed wrappers are safe GETs. Non-GET behavior runs through `albyhub_proxy_request`, which is gated by `ALBYHUB_READ_ONLY` and `ALBYHUB_REQUIRE_CONFIRM`.

---

## Requirements

- Node 20+
- A running Alby Hub instance (desktop app on `http://localhost:8080`, or self-hosted exposed somewhere)
- An Alby Hub API token (Settings → Developer / Apps in the Hub UI)

## Install

```bash
npx -y albyhub-admin-mcp
```

## Configure

```bash
cp .env.example .env
# edit .env: set ALBYHUB_URL (default http://localhost:8080) + ALBYHUB_TOKEN
```

### Required

| Var | Purpose |
|---|---|
| `ALBYHUB_URL` | Base URL of your Hub. Default `http://localhost:8080`. Use HTTPS if exposed remotely. |
| `ALBYHUB_TOKEN` | API access token. **Full-scope tokens can drain the hub's on-chain balance — scope down or use ALBYHUB_READ_ONLY=true if your audience matters.** |

### Optional safety knobs

| Var | Default | Purpose |
|---|---|---|
| `ALBYHUB_READ_ONLY` | `false` | Refuse all non-GET requests via `proxy_request`. Strongly recommended for first-time setup. |
| `ALBYHUB_REQUIRE_CONFIRM` | `false` | Two-step confirm for non-GET requests. |
| `ALBYHUB_MAX_REQUESTS_PER_MINUTE` | `30` | Rolling 60s rate limit. |
| `ALBYHUB_LOG_PATH` | `./albyhub-admin-mcp.log` | Server log. |
| `ALBYHUB_AUDIT_PATH` | `./albyhub-admin-mcp-audit.log` | Append-only JSON-line audit log. |

---

## What if my Hub returns 404 on the typed wrappers?

The endpoint path probably differs in your Hub version. Use `albyhub_proxy_request` to probe — try `/api/node`, `/info`, `/api/v1/info`, etc. Once you find the right path, you can pin it in your usage (and ping the maintainer to fix the typed wrapper in v0.2).

```
agent: albyhub_proxy_request({ method: "GET", path: "/api/v1/info" })
→ { status: 200, body: { ... } }   // found it
```

---

## Safety model

The proxy tool's pipeline:

1. **`ALBYHUB_READ_ONLY` gate** — non-GET requests blocked outright.
2. **Rate limit** — rolling 60s window on the `requests` bucket.
3. **`ALBYHUB_REQUIRE_CONFIRM` gate** — non-GET requests return a token; `albyhub_confirm_request` executes.
4. **HTTP request** — Bearer auth, 15s timeout (override via `timeout_ms`).
5. **Audit log** — every attempt (ok / blocked / error) as one structured JSON line.

GET-only convenience wrappers skip steps 1 + 3 (they're safe by construction) but still go through rate limit + audit.

---

## Companion servers

- [`nwc-mcp`](https://npmjs.com/package/nwc-mcp) — wallet ops via NIP-47. Use this for per-sub-wallet spend; use `albyhub-admin-mcp` for hub-wide / node-level operations.
- [`nostr-ops-mcp`](https://npmjs.com/package/nostr-ops-mcp) — NOSTR identity + publishing.
- [`marketplace-mcp`](https://npmjs.com/package/marketplace-mcp) — NIP-15 marketplace storefront.

---

## License

MIT — see [`LICENSE`](./LICENSE).

## Contact / Issues

Built by **LLMOps.Pro**.

- **NOSTR:** [`npub1hdg932jvwc3jdvkqywgqv0ue4nn60exrf92asy8mtazt3hjg7d2s2yw0nw`](https://njump.me/npub1hdg932jvwc3jdvkqywgqv0ue4nn60exrf92asy8mtazt3hjg7d2s2yw0nw) — follow, DM, zap.
- **Lightning Address:** `sovereigncitizens@getalby.com` — for support zaps and "this was useful" tips.
- **Bug reports / feature requests:** open a GitHub issue (link forthcoming).
- **Security issues:** please disclose privately via NOSTR DM before opening a public issue.
