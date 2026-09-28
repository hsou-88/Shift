function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function createCancellationCode() {
  const bytes = new Uint8Array(2);
  let value;
  do {
    crypto.getRandomValues(bytes);
    value = (bytes[0] << 8) | bytes[1];
  } while (value >= 60000);
  return String(value % 10000).padStart(4, "0");
}

async function hashCancellationCode(code) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (_) { return Response.json({ error: "Enter a valid room number, name, and date." }, { status: 400 }); }
  const { room, name, date } = body || {};
  if (typeof room !== "string" || !/^\d{1,12}$/.test(room) || typeof name !== "string" || !name.trim() || name.trim().length > 100 || !validDate(date)) {
    return Response.json({ error: "Enter a valid room number, name (up to 100 characters), and date." }, { status: 400 });
  }
  const cancellationCode = createCancellationCode();
  const cancellationHash = await hashCancellationCode(cancellationCode);
  try {
    const insertion = await env.DB.prepare(`
      WITH selected_group AS (
        SELECT
          CASE WHEN instr(new_rooms, '|' || ?1 || '|') > 0 THEN 'new' ELSE 'current' END AS resident_type,
          start_date, end_date, new_days, current_days, new_capacity, current_capacity
        FROM settings WHERE id = 1
      )
      INSERT INTO reservations (room, resident_name, resident_type, booking_date, cancellation_token_hash)
      SELECT ?1, ?2, resident_type, ?3, ?4
      FROM selected_group
      WHERE ?3 BETWEEN start_date AND end_date
        AND ?3 >= date('now')
        AND instr(',' || CASE WHEN resident_type = 'new' THEN new_days ELSE current_days END || ',', ',' || strftime('%w', ?3) || ',') > 0
        AND (SELECT COUNT(*) FROM reservations WHERE booking_date = ?3 AND resident_type = selected_group.resident_type)
          < CASE WHEN resident_type = 'new' THEN new_capacity ELSE current_capacity END
    `).bind(room, name.trim(), date, cancellationHash).run();
    if (insertion.meta.changes === 0) {
      const alreadyBooked = await env.DB.prepare("SELECT 1 FROM reservations WHERE room = ?").bind(room).first();
      if (alreadyBooked) return Response.json({ error: "This room number already has a booking. Each room can book only once." }, { status: 409 });
      return Response.json({ error: "That date is no longer available for this room. Choose another open date." }, { status: 409 });
    }
    return Response.json({ ok: true, cancellationCode }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) return Response.json({ error: "This room number already has a booking." }, { status: 409 });
    return Response.json({ error: "Unable to save the booking. Please try again." }, { status: 500 });
  }
}


export async function onRequestDelete({ request, env }) {
  let body;
  try { body = await request.json(); } catch (_) { return Response.json({ error: "Enter your room number and cancellation code." }, { status: 400 }); }
  const room = body?.room;
  const code = body?.cancellationCode;
  if (typeof room !== "string" || !/^\d{1,12}$/.test(room) || typeof code !== "string" || !/^(?:\d{4}|[a-f0-9]{64})$/.test(code)) {
    return Response.json({ error: "Enter a valid room number and four-digit cancellation code." }, { status: 400 });
  }
  try {
    const reservation = await env.DB.prepare("SELECT cancellation_token_hash FROM reservations WHERE room = ?").bind(room).first();
    if (!reservation?.cancellation_token_hash) return Response.json({ error: "No matching booking was found. Check your room number and cancellation code." }, { status: 404 });
    const attempt = await env.DB.prepare(`
      INSERT INTO cancellation_attempts (room, window_started_at, attempts)
      VALUES (?, unixepoch(), 1)
      ON CONFLICT(room) DO UPDATE SET
        attempts = CASE WHEN cancellation_attempts.window_started_at <= unixepoch() - 86400 THEN 1 ELSE cancellation_attempts.attempts + 1 END,
        window_started_at = CASE WHEN cancellation_attempts.window_started_at <= unixepoch() - 86400 THEN unixepoch() ELSE cancellation_attempts.window_started_at END
      RETURNING attempts
    `).bind(room).first();
    if (attempt.attempts > 10) return Response.json({ error: "Too many cancellation attempts. Please try again after 24 hours." }, { status: 429 });
    const cancellationHash = await hashCancellationCode(code);
    if (cancellationHash !== reservation.cancellation_token_hash) return Response.json({ error: "No matching booking was found. Check your room number and cancellation code." }, { status: 404 });
    const result = await env.DB.prepare("DELETE FROM reservations WHERE room = ? AND cancellation_token_hash = ?").bind(room, cancellationHash).run();
    if (!result.meta.changes) return Response.json({ error: "No matching booking was found. Check your room number and cancellation code." }, { status: 404 });
    await env.DB.prepare("DELETE FROM cancellation_attempts WHERE room = ?").bind(room).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (_) {
    return Response.json({ error: "Unable to cancel the booking. Please try again." }, { status: 500 });
  }
}
