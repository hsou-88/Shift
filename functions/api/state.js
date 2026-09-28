function todayKey() { return new Date().toISOString().slice(0, 10); }

async function ensureSettings(db) {
  const select = () => db.prepare("SELECT start_date AS start, end_date AS end, new_rooms, new_days, current_days, new_capacity, current_capacity FROM settings WHERE id = 1").first();
  let row = await select();
  if (!row) {
    const today = todayKey();
    const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await db.prepare("INSERT OR IGNORE INTO settings (id, start_date, end_date) VALUES (1, ?, ?)").bind(today, end).run();
    row = await select();
  }
  return row;
}

function splitDays(value) { return value ? value.split(",").map(Number) : []; }

export async function onRequestGet({ request, env }) {
  try {
    const row = await ensureSettings(env.DB);
    const results = await env.DB.prepare("SELECT resident_type, booking_date, COUNT(*) AS count FROM reservations GROUP BY resident_type, booking_date").all();
    const counts = { new: {}, current: {} };
    for (const item of results.results) counts[item.resident_type][item.booking_date] = item.count;
    const bookingsResult = await env.DB.prepare("SELECT booking_date, resident_name, room FROM reservations ORDER BY booking_date, resident_name").all();
    const url = new URL(request.url);
    const room = url.searchParams.get("room") || "";
    const existingReservation = room ? await env.DB.prepare("SELECT resident_type FROM reservations WHERE room = ?").bind(room).first() : null;
    const roomIsNew = Boolean(room && (row.new_rooms || "|").includes(`|${room}|`));
    const residentType = existingReservation?.resident_type || (roomIsNew ? "new" : "current");
    const roomReserved = Boolean(existingReservation);
    return Response.json({
      settings: {
        start: row.start, end: row.end,
        groups: {
          new: { days: splitDays(row.new_days), capacity: row.new_capacity },
          current: { days: splitDays(row.current_days), capacity: row.current_capacity }
        }
      },
      newRooms: (row.new_rooms || "|").split("|").filter(Boolean), counts, residentType, roomReserved,
      bookings: bookingsResult.results.map((booking) => ({ date: booking.booking_date, name: booking.resident_name, room: booking.room }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "Unable to load booking availability." }, { status: 500 });
  }
}
