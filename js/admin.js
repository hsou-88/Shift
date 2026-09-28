document.addEventListener("DOMContentLoaded", async () => {
  const message = document.querySelector("#admin-message");
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
  try {
    const { settings, newRooms } = await api("/api/state");
    document.querySelector("#start-date").value = settings.start;
    document.querySelector("#end-date").value = settings.end;
    document.querySelector("#new-capacity").value = settings.groups.new.capacity;
    document.querySelector("#current-capacity").value = settings.groups.current.capacity;
    document.querySelector("#new-rooms").value = newRooms.join(", ");
    setDays("new", settings.groups.new.days); setDays("current", settings.groups.current.days);
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
  document.querySelector("#logout-button").addEventListener("click", async () => {
    try { await api("/api/admin/session", { method: "DELETE" }); } finally { window.location.replace("/admin-login.html"); }
  });
});
