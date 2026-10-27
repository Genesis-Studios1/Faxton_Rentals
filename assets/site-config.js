/*
 * Faxton Rentals website settings.
 *
 * This is the only file you need to edit to fill in contact details.
 * Leave a value as "" and whatever depends on it stays hidden (for example, the
 * Phone card on the Contact page, or a social icon, which says "coming soon").
 * Never put passwords or private keys in this file: it is public.
 */
window.FAXTON_SITE = Object.freeze({
  // Where this website lives, for example "https://faxtonrentals.com" (no trailing slash).
  // Used for share links. Leave "" to use whatever address the visitor is on.
  SITE_URL: "",

  // The Faxton Rentals web app (the product). Help centre, privacy, terms and licence pages live there.
  APP_URL: "https://faxton-rentals.web.app",

  // Contact details. Empty = the card is hidden. Do not invent values: only add real ones.
  SUPPORT_EMAIL: "",     // e.g. "support@yourdomain.com"
  PHONE: "",             // e.g. "+234 800 000 0000"
  WHATSAPP: "",          // digits only with country code, e.g. "2348000000000"
  ADDRESS: "",           // e.g. "12 Example Street, Lekki, Lagos"

  // Social pages: paste the full address of each page. Empty = the icon says "coming soon".
  SOCIALS: Object.freeze({
    instagram: "",
    linkedin: "",
    x: "",
    youtube: "",
    tiktok: "",
    pinterest: "",
  }),

  // The public GitHub repository that holds the app downloads (latest release is used).
  RELEASES_REPO: "musazaneerah4-crypto/Faxton-Rentals-Downloads",

  // Shown in the footer.
  SITE_VERSION: "2026-10-27.1",

  // Waitlist and contact messages are saved in the Faxton Firestore project with the
  // public web key (the same one the app uses; access is controlled by Firestore rules).
  FIREBASE: Object.freeze({
    projectId: "faxton-rentals",
    apiKey: "AIzaSyBraCvOGzGiEfmOZPmmi1ceVtkipJeATeE",
  }),
});
