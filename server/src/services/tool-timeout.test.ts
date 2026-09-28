import { describe, expect, it } from "vitest";
import { connectionToolTimeoutMs } from "./tool-timeout.js";
import { createToolConnectionSchema } from "@paperclipai/shared";

describe("connection tool timeout", () => {
  it("retains explicit and approved budgets", () => {
    expect(connectionToolTimeoutMs({ defaultTimeoutMs: 20_000 }, 60_000, false)).toBe(60_000);
    expect(connectionToolTimeoutMs({ defaultTimeoutMs: 20_000 }, 500, false)).toBe(500);
  });
  it("uses the connection default before provider fallback", () => {
    expect(connectionToolTimeoutMs({ defaultTimeoutMs: 20_000 }, 60_000, true)).toBe(20_000);
    expect(connectionToolTimeoutMs({}, 60_000, true)).toBe(60_000);
    expect(connectionToolTimeoutMs({}, 10_000, true)).toBe(10_000);
  });
  it.each([0, -1, 60_001, 1.5, "30000", null])("rejects invalid persisted configuration %s", (value) => {
    expect(createToolConnectionSchema.safeParse({ name: "fixture", transportConfig: { defaultTimeoutMs: value } }).success).toBe(false);
    expect(connectionToolTimeoutMs({ defaultTimeoutMs: value }, 10_000, true)).toBe(10_000);
  });
  it.each([1, 30_000, 60_000])("accepts valid defaults %s", (value) => {
    expect(createToolConnectionSchema.safeParse({ name: "fixture", transportConfig: { defaultTimeoutMs: value } }).success).toBe(true);
  });
});
