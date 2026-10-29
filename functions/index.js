const { initializeApp } = require("firebase-admin/app");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const ADMIN_EMAIL = "isaacij6yes@gmail.com";
const FROM_EMAIL = "Faxton Rentals <onboarding@resend.dev>";

function field(data, key) {
  const value = data && data[key];
  return typeof value === "string" ? value : "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

exports.notifyWaitlistSignup = onDocumentCreated(
  {
    document: "waitlist/{entryId}",
    region: "europe-west1",
    secrets: [RESEND_API_KEY],
    retry: true,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const name = field(data, "name");
    const email = field(data, "email");
    const role = field(data, "role");
    const city = field(data, "city");
    const createdAt = data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString();

    const subject = "New Faxton Rentals waitlist signup";
    const text = [
      "A new person joined the Faxton Rentals waitlist.",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Type: ${role}`,
      `City: ${city}`,
      `Joined: ${createdAt}`,
      "",
      "Open the Faxton Rentals admin dashboard to review signups."
    ].join("\n");

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17382c">
      <h2 style="color:#126b4d">New waitlist signup</h2>
      <p>A new person joined the Faxton Rentals waitlist.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
        <tr><td><b>Name</b></td><td>${escapeHtml(name)}</td></tr>
        <tr><td><b>Email</b></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><b>Type</b></td><td>${escapeHtml(role)}</td></tr>
        <tr><td><b>City</b></td><td>${escapeHtml(city)}</td></tr>
        <tr><td><b>Joined</b></td><td>${escapeHtml(createdAt)}</td></tr>
      </table>
      <p>Review the registration in the Faxton Rentals admin dashboard.</p>
    </body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.error("Waitlist notification email failed", {
        status: response.status,
        detail: detail.slice(0, 500),
        entryId: event.params.entryId,
      });
      throw new Error(`Email provider returned HTTP ${response.status}`);
    }

    logger.info("Waitlist notification email sent", {
      entryId: event.params.entryId,
      recipient: ADMIN_EMAIL,
    });
  }
);