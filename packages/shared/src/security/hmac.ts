import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(rawBody: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  return `sha256=${hmac.digest("hex")}`;
}

export function verifySignature(rawBody: string, secret: string, signature: string): boolean {
  const expected = signPayload(rawBody, secret);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
