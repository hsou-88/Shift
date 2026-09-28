document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#admin-login-form");
  const message = document.querySelector("#login-message");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = ""; message.className = "booking-message";
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: document.querySelector("#admin-key").value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      document.querySelector("#admin-key").value = "";
      window.location.assign("/admin");
    } catch (error) {
      message.textContent = error.message; message.className = "booking-message error";
    }
  });
});
