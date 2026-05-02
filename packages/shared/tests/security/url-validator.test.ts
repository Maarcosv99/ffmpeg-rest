import { describe, expect, test } from "bun:test";
import { isPrivateAddress, validateWebhookUrlSync } from "../../src/security/url-validator.ts";

describe("isPrivateAddress", () => {
  test.each([
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.32.0.1", false],
    ["192.168.1.1", true],
    ["127.0.0.1", true],
    ["169.254.169.254", true],
    ["100.64.0.1", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
  ])("IPv4 %s -> private=%s", (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });

  test.each([
    ["::1", true],
    ["fe80::1", true],
    ["fc00::1", true],
    ["fd00::1", true],
    ["ff00::1", true],
    ["::ffff:127.0.0.1", true],
    ["2001:4860:4860::8888", false],
  ])("IPv6 %s -> private=%s", (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe("validateWebhookUrlSync", () => {
  test("accepts an https URL with public hostname", () => {
    const result = validateWebhookUrlSync("https://hooks.example.com/path");
    expect(result.ok).toBe(true);
  });

  test("rejects malformed URLs", () => {
    const result = validateWebhookUrlSync("not a url");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("malformed") });
  });

  test("rejects ftp protocol", () => {
    const result = validateWebhookUrlSync("ftp://example.com");
    expect(result.ok).toBe(false);
  });

  test("rejects http when allowHttp is false (default)", () => {
    const result = validateWebhookUrlSync("http://example.com");
    expect(result).toEqual({
      ok: false,
      reason: "HTTP webhooks are disabled",
    });
  });

  test("accepts http when allowHttp is true", () => {
    const result = validateWebhookUrlSync("http://example.com", { allowHttp: true });
    expect(result.ok).toBe(true);
  });

  test("rejects literal localhost", () => {
    const result = validateWebhookUrlSync("https://localhost/notify");
    expect(result.ok).toBe(false);
  });

  test("rejects metadata.google.internal", () => {
    const result = validateWebhookUrlSync("https://metadata.google.internal/computeMetadata/v1/");
    expect(result.ok).toBe(false);
  });

  test.each([
    "https://10.0.0.1/path",
    "https://192.168.1.1/path",
    "https://127.0.0.1/path",
    "https://169.254.169.254/latest/meta-data",
  ])("rejects private IPv4 literal %s", (url) => {
    expect(validateWebhookUrlSync(url).ok).toBe(false);
  });

  test("accepts public IPv4 literal", () => {
    const result = validateWebhookUrlSync("https://8.8.8.8/notify");
    expect(result.ok).toBe(true);
  });
});
