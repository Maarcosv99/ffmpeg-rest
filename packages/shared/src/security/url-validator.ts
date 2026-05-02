import { promises as dns } from "node:dns";
import { isIP } from "node:net";

const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["0.0.0.0", 8],
  ["100.64.0.0", 10],
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.azure.com",
  "metadata",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) + n;
  }
  return result >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false;
  for (const [base, bits] of PRIVATE_IPV4_RANGES) {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) continue;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    if ((ipInt & mask) === (baseInt & mask)) return true;
  }
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe9") || lower.startsWith("fea")) return true;
  if (lower.startsWith("ff")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return false;
}

export type ValidateUrlOptions = {
  allowHttp?: boolean;
};

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateWebhookUrlSync(
  rawUrl: string,
  options: ValidateUrlOptions = {},
): ValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL is malformed" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: `Protocol ${parsed.protocol} not allowed` };
  }

  if (parsed.protocol === "http:" && !options.allowHttp) {
    return { ok: false, reason: "HTTP webhooks are disabled" };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: `Hostname ${hostname} is blocked` };
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      return { ok: false, reason: `IP ${hostname} is in a private/reserved range` };
    }
  }

  return { ok: true };
}

export async function validateWebhookUrlAsync(
  rawUrl: string,
  options: ValidateUrlOptions = {},
): Promise<ValidationResult> {
  const sync = validateWebhookUrlSync(rawUrl, options);
  if (!sync.ok) return sync;

  const hostname = new URL(rawUrl).hostname.toLowerCase();
  if (isIP(hostname)) return { ok: true };

  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    return { ok: false, reason: `Failed to resolve hostname ${hostname}` };
  }

  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      return {
        ok: false,
        reason: `Hostname ${hostname} resolves to private IP ${address}`,
      };
    }
  }

  return { ok: true };
}
