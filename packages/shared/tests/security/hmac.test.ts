import { describe, expect, test } from "bun:test";
import { signPayload, verifySignature } from "../../src/security/hmac.ts";

describe("hmac", () => {
  const secret = "test-secret-at-least-16";
  const body = JSON.stringify({ jobId: "abc", status: "completed" });

  test("signPayload returns sha256= prefixed hex", () => {
    const sig = signPayload(body, secret);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  test("verifySignature accepts a freshly signed body", () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body, secret, sig)).toBe(true);
  });

  test("verifySignature rejects tampered body", () => {
    const sig = signPayload(body, secret);
    const tampered = body.replace("completed", "failed");
    expect(verifySignature(tampered, secret, sig)).toBe(false);
  });

  test("verifySignature rejects wrong secret", () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body, "another-secret-at-16+chars", sig)).toBe(false);
  });

  test("verifySignature rejects malformed signature", () => {
    expect(verifySignature(body, secret, "garbage")).toBe(false);
  });

  test("signing the same input twice yields the same signature", () => {
    expect(signPayload(body, secret)).toBe(signPayload(body, secret));
  });
});
