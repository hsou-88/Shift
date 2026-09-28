document.addEventListener("DOMContentLoaded", async function () {
  const $ = (selector) => document.querySelector(selector);
  const roomInput = $("#room-number");
  const nameInput = $("#resident-name");
  const selectedInput = $("#selected-date");
  const daysElement = $("#calendar-days");
  const note = $("#availability-note");
  const message = $("#booking-message");
  const groupStatus = $("#resident-group-status");
  const dateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  const parseDate = (value) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let settings = null; let availability = {}; let roomReserved = false; let residentType = "current";
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1); let connected = false;

  function setMessage(text, type = "") { message.textContent = text; message.className = `booking-message ${type}`; }
  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The request could not be completed.");
    return body;
  }
  function roomNumber() { const value = roomInput.value.trim(); return /^\d{1,12}$/.test(value) ? value : ""; }
  function isEligible(date) {
    if (!roomNumber() || !settings) return false;
    const key = dateKey(date); const group = settings.groups[residentType];
    return key >= settings.start && key <= settings.end && key >= dateKey(today) && group.days.includes(date.getDay()) && Number(availability[key] || 0) < group.capacity && !roomReserved;
  }
  async function refreshState() {
    const room = roomNumber();
    const data = await api(`/state${room ? `?room=${encodeURIComponent(room)}` : ""}`);
    settings = data.settings; residentType = data.residentType || "current"; availability = data.counts[residentType] || {}; roomReserved = Boolean(data.roomReserved); connected = true;
    renderCalendar();
  }
  function renderCalendar() {
    const year = visibleMonth.getFullYear(); const month = visibleMonth.getMonth();
    $("#calendar-title").textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(visibleMonth);
    daysElement.replaceChildren();
    for (let i = 0; i < new Date(year, month, 1).getDay(); i++) { const blank = document.createElement("span"); blank.className = "calendar-blank"; blank.setAttribute("aria-hidden", "true"); daysElement.append(blank); }
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
      const date = new Date(year, month, day); const key = dateKey(date); const count = Number(availability[key] || 0);
      const button = document.createElement("button"); button.type = "button"; button.className = "calendar-day";
      button.setAttribute("aria-label", `${new Intl.DateTimeFormat("en", { month: "long" }).format(date)} ${day}, ${count} booked${isEligible(date) ? ", available" : ", unavailable"}`);
      button.disabled = !isEligible(date);
      if (selectedInput.value === key) button.classList.add("selected");
      const number = document.createElement("span"); number.className = "day-number"; number.textContent = day; button.append(number);
      const group = settings?.groups[residentType];
      if (roomNumber() && group && key >= settings.start && key <= settings.end && group.days.includes(date.getDay())) {
        const countLabel = document.createElement("span"); countLabel.className = "day-count";
        countLabel.textContent = `${Math.max(0, group.capacity - count)} left`; button.append(countLabel);
        if (count >= group.capacity) button.classList.add("full");
      }
      button.addEventListener("click", () => { selectedInput.value = key; setMessage(""); renderCalendar(); });
      daysElement.append(button);
    }
    note.textContent = !connected ? "Connecting to the booking service…" : !roomNumber() ? "Enter your room number to see available dates." : roomReserved ? "This room number already has a booking." : `Showing ${residentType === "new" ? "new resident" : "current resident"} dates. Remaining spaces are shown below each date.`;
    groupStatus.textContent = !roomNumber() ? "" : `Room category: ${residentType === "new" ? "New resident" : "Current resident"}`;
  }

  roomInput.addEventListener("input", async () => { selectedInput.value = ""; setMessage(""); try { await refreshState(); } catch (error) { setMessage(error.message, "error"); } });
  $("#prev-month").addEventListener("click", () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); renderCalendar(); });
  $("#next-month").addEventListener("click", () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); renderCalendar(); });

  $("#booking-form").addEventListener("submit", async (event) => {
    event.preventDefault(); setMessage("");
    const room = roomNumber(); const name = nameInput.value.trim(); const date = selectedInput.value;
    if (!room || !name || !date) { setMessage("Enter your room number and name, then choose a date.", "error"); return; }
    if (!isEligible(parseDate(date))) { setMessage("That date is no longer available. Choose another open date.", "error"); selectedInput.value = ""; await refreshState(); return; }
    try {
      await api("/reservations", { method: "POST", body: JSON.stringify({ room, name, date }) });
      setMessage(`Your shift is booked for ${date}. Room ${room} can only book once.`, "success");
      selectedInput.value = ""; roomInput.value = ""; nameInput.value = ""; await refreshState();
    } catch (error) { setMessage(error.message, "error"); await refreshState(); }
  });

  try { await refreshState(); } catch (error) { setMessage(`Booking service unavailable: ${error.message}. Please reload this page later.`, "error"); note.textContent = "Unable to load available dates."; }
  window.setInterval(() => refreshState().catch(() => {}), 20000);
});
