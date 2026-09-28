import { hasAdminSession } from "../../../src/admin-session.js";

export async function onRequestDelete({ request, env }) {
  if (!(await hasAdminSession(request, env.ADMIN_KEY))) return Response.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body = {};
  const rawBody = await request.text();
  if (rawBody) {
    try { body = JSON.parse(rawBody); } catch (_) { return Response.json({ error: "Invalid deletion request." }, { status: 400 }); }
  }
  if (body.room !== undefined && (typeof body.room !== "string" || !/^\d{1,12}$/.test(body.room))) {
    return Response.json({ error: "Enter a valid room number." }, { status: 400 });
  }
  try {
    const result = body.room === undefined
      ? await env.DB.prepare("DELETE FROM reservations").run()
      : await env.DB.prepare("DELETE FROM reservations WHERE room = ?").bind(body.room).run();
    if (body.room === undefined) {
      await env.DB.prepare("DELETE FROM cancellation_attempts").run();
    } else {
      await env.DB.prepare("DELETE FROM cancellation_attempts WHERE room = ?").bind(body.room).run();
    }
    return Response.json({ ok: true, deleted: result.meta.changes || 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (_) {
    return Response.json({ error: "Unable to delete reservations. Please try again." }, { status: 500 });
  }
}
