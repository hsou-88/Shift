const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createAdminSession(secret) {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(expires));
  return `${expires}.${toBase64Url(signature)}`;
}

export async function hasAdminSession(request, secret) {
  if (!secret) return false;
  const cookie = request.headers.get("Cookie") || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("admin_session="));
  if (!entry) return false;
  let token;
  try { token = decodeURIComponent(entry.slice("admin_session=".length)); } catch (_) { return false; }
  const [expires, encodedSignature] = token.split(".");
  if (!/^\d+$/.test(expires || "") || Number(expires) <= Date.now() || !encodedSignature) return false;
  try {
    return await crypto.subtle.verify("HMAC", await signingKey(secret), fromBase64Url(encodedSignature), encoder.encode(expires));
  } catch (_) { return false; }
}

export function adminCookie(request, token, maxAge = 8 * 60 * 60) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
