import { CONFIG } from "./config.js";

const ROLE_MAP = Object.freeze({
  renter: "renter",
  owner: "landlord",
  agency: "agency",
  agent: "agent",
});

export function initWaitlist() {
  const section = document.querySelector("[data-waitlist]");
  const role = section?.querySelector("[data-wl-role]");
  const link = section?.querySelector("[data-wl-app-link]");
  if (!section || !role || !link || section.dataset.waitlistInitialized === "true") return;

  section.dataset.waitlistInitialized = "true";
  const appUrl = CONFIG.APP_URL.replace(/\/+$/, "");
  const updateSignupLink = () => {
    const appRole = ROLE_MAP[role.value] || "renter";
    link.href = `${appUrl}/#/signup?role=${encodeURIComponent(appRole)}`;
  };

  role.addEventListener("change", updateSignupLink);
  updateSignupLink();
}
