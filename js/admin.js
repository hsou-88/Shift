document.addEventListener("DOMContentLoaded", async () => {
  const message = document.querySelector("#admin-message");
  const cleanupMessage = document.querySelector("#cleanup-message");
  const reservationList = document.querySelector("#admin-reservation-list");
  const showMessage = (text, type = "") => { message.textContent = text; message.className = `booking-message ${type}`; };
  async function api(url, options = {}) {
    const response = await fetch(url, { ...options, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) window.location.replace("/admin-login.html");
      throw new Error(result.error || "The request could not be completed.");
    }
    return result;
  }
  function setDays(group, days) {
    document.querySelectorAll(`.weekday-options[data-group="${group}"] input`).forEach((input) => { input.checked = days.includes(Number(input.value)); });
  }
  function getDays(group) {
    return Array.from(document.querySelectorAll(`.weekday-options[data-group="${group}"] input:checked`), (input) => Number(input.value));
  }
  function renderReservations(bookings = []) {
    reservationList.replaceChildren();
    if (!bookings.length) { const empty = document.createElement("p"); empty.className = "field-hint"; empty.textContent = "No reservations."; reservationList.append(empty); return; }
    for (const booking of bookings) {
      const row = document.createElement("div"); row.className = "admin-reservation-row";
      const details = document.createElement("div"); details.className = "admin-reservation-details";
      const date = document.createElement("span"); date.className = "admin-reservation-date";
      const [year, month, day] = booking.date.split("-").map(Number);
      date.textContent = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(year, month - 1, day));
      const name = document.createElement("strong"); name.textContent = booking.name;
      const room = document.createElement("span"); room.textContent = `Room ${booking.room}`;
      details.append(date, name, room);
      const button = document.createElement("button"); button.type = "button"; button.className = "delete-reservation-btn"; button.textContent = "Delete";
      button.addEventListener("click", async () => {
        if (!window.confirm(`Delete ${booking.name} from room ${booking.room} on ${booking.date}?`)) return;
        cleanupMessage.textContent = "";
        try {
          const result = await api("/api/admin/reservations", { method: "DELETE", body: JSON.stringify({ room: booking.room }) });
          cleanupMessage.textContent = result.deleted ? "Reservation deleted." : "That reservation was already deleted.";
          cleanupMessage.className = `booking-message ${result.deleted ? "success" : "error"}`;
          const data = await api("/api/state"); renderReservations(data.bookings || []);
        } catch (error) {
          cleanupMessage.textContent = error.message; cleanupMessage.className = "booking-message error";
        }
      });
      row.append(details, button); reservationList.append(row);
    }
  }
  try {
    const { settings, newRooms, bookings } = await api("/api/state");
    document.querySelector("#start-date").value = settings.start;
    document.querySelector("#end-date").value = settings.end;
    document.querySelector("#new-capacity").value = settings.groups.new.capacity;
    document.querySelector("#current-capacity").value = settings.groups.current.capacity;
    document.querySelector("#new-rooms").value = newRooms.join(", ");
    setDays("new", settings.groups.new.days); setDays("current", settings.groups.current.days);
    renderReservations(bookings || []);
  } catch (error) { showMessage(error.message, "error"); }

  document.querySelector("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const start = document.querySelector("#start-date").value;
    const end = document.querySelector("#end-date").value;
    const newRooms = document.querySelector("#new-rooms").value.split(/[\s,;]+/).map((room) => room.trim()).filter(Boolean);
    const settings = {
      start, end, newRooms,
      groups: {
        new: { capacity: Number(document.querySelector("#new-capacity").value), days: getDays("new") },
        current: { capacity: Number(document.querySelector("#current-capacity").value), days: getDays("current") }
      }
    };
    if (end < start) { showMessage("The end date must be on or after the start date.", "error"); return; }
    if (!settings.groups.new.days.length || !settings.groups.current.days.length) { showMessage("Choose at least one booking weekday for each resident group.", "error"); return; }
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      showMessage("Booking dates, room groups, weekdays, and capacities saved.", "success");
    } catch (error) { showMessage(error.message, "error"); }
  });
  document.querySelector("#delete-all-reservations").addEventListener("click", async () => {
    if (!window.confirm("Permanently delete every reservation? This cannot be undone.")) return;
    cleanupMessage.textContent = "";
    try {
      const result = await api("/api/admin/reservations", { method: "DELETE" });
      cleanupMessage.textContent = `Deleted ${result.deleted} reservation(s).`;
      cleanupMessage.className = "booking-message success";
      renderReservations([]);
    } catch (error) {
      cleanupMessage.textContent = error.message;
      cleanupMessage.className = "booking-message error";
    }
  });
  document.querySelector("#logout-button").addEventListener("click", async () => {
    try { await api("/api/admin/session", { method: "DELETE" }); } finally { window.location.replace("/admin-login.html"); }
  });
});
