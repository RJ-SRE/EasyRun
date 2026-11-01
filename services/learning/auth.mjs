import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requireThat } from "./rules.mjs";
export function playerId(issuer, subject, key) {
  // subject must be the verified platform user.id. Names and token values are
  // mutable and must never enter this persistent storage/queue identity.
  requireThat(
    key?.length >= 32 && typeof subject === "string" && subject.length > 0,
    "IDENTITY_CONFIGURATION",
    503,
  );
  return (
    "p_" +
    createHmac("sha256", key)
      .update(JSON.stringify([issuer, subject]))
      .digest("hex")
  );
}
// Explicit username profiles are NOT authenticated platform accounts. A separate
// HMAC namespace prevents names from claiming existing verified-ID archives.
export function canonicalUsername(value) {
  requireThat(
    typeof value === "string" && !/[\p{Cc}\p{Cf}]/u.test(value),
    "INVALID_USERNAME",
    400,
  );
  const name = value.trim().normalize("NFC").toLowerCase();
  requireThat(
    name.length > 0 && [...name].length <= 100,
    "INVALID_USERNAME",
    400,
  );
  return name;
}
export function usernamePlayerId(name, key) {
  requireThat(key?.length >= 32, "IDENTITY_CONFIGURATION", 503);
  return (
    "p_" +
    createHmac("sha256", key)
      .update(
        JSON.stringify([
          "profile",
          "xbuilder-username-v1",
          canonicalUsername(name),
        ]),
      )
      .digest("hex")
  );
}
export function sign(payload, key) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return (
    data + "." + createHmac("sha256", key).update(data).digest("base64url")
  );
}
export function verify(token, key) {
  requireThat(
    typeof token === "string" && token.length < 16384,
    "INVALID_CREDENTIAL",
    401,
  );
  const [data, mac, extra] = token.split(".");
  requireThat(data && mac && !extra, "INVALID_CREDENTIAL", 401);
  const expected = createHmac("sha256", key).update(data).digest();
  const supplied = Buffer.from(mac, "base64url");
  requireThat(
    supplied.length === expected.length && timingSafeEqual(supplied, expected),
    "INVALID_CREDENTIAL",
    401,
  );
  try {
    return JSON.parse(Buffer.from(data, "base64url"));
  } catch {
    throw Object.assign(new Error("INVALID_CREDENTIAL"), { status: 401 });
  }
}
export const randomId = () => randomBytes(18).toString("base64url");
// Only a platform-issued credential goes to the configured, fixed user endpoint.
// No username login, public profile lookup, password login or development bypass.
export function xbuilderVerifier({ userInfoUrl, issuer, fetcher = fetch }) {
  if (!userInfoUrl || !issuer) return null;
  const url = new URL(userInfoUrl);
  requireThat(
    url.protocol === "https:" && !url.username && !url.password,
    "IDENTITY_CONFIGURATION",
    503,
  );
  return async (credential) => {
    requireThat(
      typeof credential === "string" &&
        credential.length >= 16 &&
        credential.length <= 8192 &&
        !/[\r\n]/.test(credential),
      "INVALID_CREDENTIAL",
      401,
    );
    const response = await fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${credential}`,
        Accept: "application/json",
      },
    });
    requireThat(
      response.ok,
      response.status === 401 || response.status === 403
        ? "LOGIN_REQUIRED"
        : "IDENTITY_UNAVAILABLE",
      response.status === 401 || response.status === 403 ? 401 : 503,
    );
    const text = await response.text();
    requireThat(Buffer.byteLength(text) <= 32768, "IDENTITY_RESPONSE", 502);
    const user = JSON.parse(text);
    requireThat(
      typeof user.id === "string" &&
        user.id.trim().length > 0 &&
        user.id.length <= 256,
      "IDENTITY_RESPONSE",
      502,
    );
    return { issuer, subject: user.id };
  };
}
