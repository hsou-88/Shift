function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (_) { return Response.json({ error: "Enter a valid room number, name, and date." }, { status: 400 }); }
  const { room, name, date } = body || {};
  if (typeof room !== "string" || !/^\d{1,12}$/.test(room) || typeof name !== "string" || !name.trim() || name.trim().length > 100 || !validDate(date)) {
    return Response.json({ error: "Enter a valid room number, name (up to 100 characters), and date." }, { status: 400 });
  }
  try {
    const insertion = await env.DB.prepare(`
      WITH selected_group AS (
        SELECT
          CASE WHEN instr(new_rooms, '|' || ?1 || '|') > 0 THEN 'new' ELSE 'current' END AS resident_type,
          start_date, end_date, new_days, current_days, new_capacity, current_capacity
        FROM settings WHERE id = 1
      )
      INSERT INTO reservations (room, resident_name, resident_type, booking_date)
      SELECT ?1, ?2, resident_type, ?3
      FROM selected_group
      WHERE ?3 BETWEEN start_date AND end_date
        AND ?3 >= date('now')
        AND instr(',' || CASE WHEN resident_type = 'new' THEN new_days ELSE current_days END || ',', ',' || strftime('%w', ?3) || ',') > 0
        AND (SELECT COUNT(*) FROM reservations WHERE booking_date = ?3 AND resident_type = selected_group.resident_type)
          < CASE WHEN resident_type = 'new' THEN new_capacity ELSE current_capacity END
    `).bind(room, name.trim(), date).run();
    if (insertion.meta.changes === 0) {
      const alreadyBooked = await env.DB.prepare("SELECT 1 FROM reservations WHERE room = ?").bind(room).first();
      if (alreadyBooked) return Response.json({ error: "This room number already has a booking. Each room can book only once." }, { status: 409 });
      return Response.json({ error: "That date is no longer available for this room. Choose another open date." }, { status: 409 });
    }
    return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) return Response.json({ error: "This room number already has a booking." }, { status: 409 });
    return Response.json({ error: "Unable to save the booking. Please try again." }, { status: 500 });
  }
}
