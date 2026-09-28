import { hasAdminSession } from "../../src/admin-session.js";

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validGroup(group) {
  return group && Number.isInteger(group.capacity) && group.capacity >= 1 && group.capacity <= 99 &&
    Array.isArray(group.days) && group.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    new Set(group.days).size === group.days.length && group.days.length > 0;
}

export async function onRequestPut({ request, env }) {
  if (!(await hasAdminSession(request, env.ADMIN_KEY))) return Response.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body;
  try { body = await request.json(); } catch (_) { return Response.json({ error: "Enter valid booking settings." }, { status: 400 }); }
  const { start, end, groups, newRooms } = body || {};
  if (!isDate(start) || !isDate(end) || end < start || !Array.isArray(newRooms) || newRooms.length > 500 || !newRooms.every((room) => typeof room === "string" && /^\d{1,12}$/.test(room)) || new Set(newRooms).size !== newRooms.length || !groups || !validGroup(groups.new) || !validGroup(groups.current)) {
    return Response.json({ error: "Check the date range, unique room numbers, weekday selections, and capacities." }, { status: 400 });
  }
  const newDays = groups.new.days.slice().sort((a, b) => a - b).join(",");
  const currentDays = groups.current.days.slice().sort((a, b) => a - b).join(",");
  const rooms = `|${newRooms.join("|")}|`;
  await env.DB.prepare("UPDATE settings SET start_date = ?, end_date = ?, new_rooms = ?, new_days = ?, current_days = ?, new_capacity = ?, current_capacity = ? WHERE id = 1")
    .bind(start, end, rooms, newDays, currentDays, groups.new.capacity, groups.current.capacity).run();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
