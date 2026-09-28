import { adminCookie, createAdminSession } from "../../../src/admin-session.js";

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_KEY || env.ADMIN_KEY.length < 32) return Response.json({ error: "Administrator sign-in is not configured." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch (_) { return Response.json({ error: "Enter the administrator key." }, { status: 400 }); }
  if (!sameSecret(body?.key, env.ADMIN_KEY)) return Response.json({ error: "The administrator key is incorrect." }, { status: 401 });
  const token = await createAdminSession(env.ADMIN_KEY);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": adminCookie(request, token), "Cache-Control": "no-store" } });
}

export async function onRequestDelete({ request }) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}` } });
}
