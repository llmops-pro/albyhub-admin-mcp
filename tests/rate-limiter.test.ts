import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/safety/rate-limiter.js";

describe("RateLimiter", () => {
  it("allows up to the limit then blocks", () => {
    const r = new RateLimiter({ requests: 2 });
    expect(r.take("requests").ok).toBe(true);
    expect(r.take("requests").ok).toBe(true);
    const third = r.take("requests");
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toMatch(/2\/2/);
  });

  it("snapshot reports usage", () => {
    const r = new RateLimiter({ requests: 5 });
    r.take("requests");
    expect(r.snapshot().requests).toEqual({ used: 1, limit: 5 });
  });

  it("pass-through for unknown buckets", () => {
    const r = new RateLimiter({ requests: 1 });
    expect(r.take("unconfigured").ok).toBe(true);
    expect(r.take("unconfigured").ok).toBe(true);
  });
});
