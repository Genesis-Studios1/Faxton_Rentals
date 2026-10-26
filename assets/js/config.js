// Reads window.FAXTON_SITE (assets/site-config.js) and fills in safe defaults,
// so the site still works if the config file is missing or partly empty.
const DEFAULTS = {
  SITE_URL: "",
  APP_URL: "https://faxton-rentals.web.app",
  SUPPORT_EMAIL: "",
  PHONE: "",
  WHATSAPP: "",
  ADDRESS: "",
  SOCIALS: { instagram: "", linkedin: "", x: "", youtube: "", tiktok: "", pinterest: "" },
  RELEASES_REPO: "musazaneerah4-crypto/Faxton-Rentals-Downloads",
  SITE_VERSION: "2026-10-26.1",
  FIREBASE: { projectId: "faxton-rentals", apiKey: "" },
};

const raw = (typeof window !== "undefined" && window.FAXTON_SITE) || {};
const str = (v, d = "") => (typeof v === "string" ? v.trim() : d);

export const CONFIG = Object.freeze({
  SITE_URL: str(raw.SITE_URL, DEFAULTS.SITE_URL).replace(/\/+$/, ""),
  APP_URL: str(raw.APP_URL, DEFAULTS.APP_URL).replace(/\/+$/, "") || DEFAULTS.APP_URL,
  SUPPORT_EMAIL: str(raw.SUPPORT_EMAIL),
  PHONE: str(raw.PHONE),
  WHATSAPP: str(raw.WHATSAPP).replace(/\D/g, ""),
  ADDRESS: str(raw.ADDRESS),
  SOCIALS: Object.freeze({ ...DEFAULTS.SOCIALS, ...Object.fromEntries(Object.entries(raw.SOCIALS || {}).map(([k, v]) => [k, str(v)])) }),
  RELEASES_REPO: str(raw.RELEASES_REPO, DEFAULTS.RELEASES_REPO) || DEFAULTS.RELEASES_REPO,
  SITE_VERSION: str(raw.SITE_VERSION, DEFAULTS.SITE_VERSION) || DEFAULTS.SITE_VERSION,
  FIREBASE: Object.freeze({ ...DEFAULTS.FIREBASE, ...(raw.FIREBASE || {}) }),
});

// Only http(s) addresses are ever used as links (so a typo like "javascript:" in the config can't run).
export const safeUrl = (u) => (/^https:\/\/[^\s]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
