// Footer: social links from the config, legal links to the app, the privacy choices window and the year.
import { CONFIG, safeUrl } from "./config.js";
import { $, $$, esc, icon, store, toast } from "./ui.js";

const NAMES = { instagram: "Instagram", linkedin: "LinkedIn", x: "X", youtube: "YouTube", tiktok: "TikTok", pinterest: "Pinterest" };
// Keys this site remembers on the visitor's own device (listed in the privacy window and cleared by its button).
export const STORAGE_KEYS = ["fxr.joined", "fxr.lastMessage", "fxr.release"];

export function initFooter() {
  // year and version
  $$("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  $$("[data-version]").forEach((el) => { el.textContent = CONFIG.SITE_VERSION; });

  // links into the app (Support, Privacy, Terms, Licence, Help centre) follow APP_URL
  $$("a[data-app]").forEach((a) => { a.href = CONFIG.APP_URL + a.dataset.app; });

  // social icons: real address when set, otherwise a friendly "coming soon"
  $$("a[data-social]").forEach((a) => {
    const key = a.dataset.social, url = safeUrl(CONFIG.SOCIALS[key]);
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.setAttribute("aria-label", `${NAMES[key]} (opens in a new tab)`); }
    else a.addEventListener("click", (e) => { e.preventDefault(); toast(`Our ${NAMES[key]} page is coming soon.`); });
  });

  $$("[data-choices]").forEach((b) => b.addEventListener("click", openPrivacyChoices));

  // "Get the app": scroll to the download section and open the picker when this page has one
  $$("a[data-get-app]").forEach((a) => a.addEventListener("click", (e) => {
    const target = document.getElementById("download");
    if (!target) return; // normal link to the home page
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    document.dispatchEvent(new CustomEvent("fx:open-download"));
  }));
}

function openPrivacyChoices() {
  let dlg = $("#privacy-dialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "privacy-dialog";
    dlg.className = "fx-modal";
    dlg.setAttribute("aria-labelledby", "privacy-title");
    dlg.innerHTML = `<div class="fx-modal__in">
      <button type="button" class="fx-modal__x" data-close aria-label="Close">${icon("x")}</button>
      <h2 id="privacy-title">Your privacy choices</h2>
      <p>This website doesn’t show ads and doesn’t use advertising or tracking cookies. It runs no analytics and loads no third-party scripts, so there is nothing to switch off. It stores only what it needs on your device: a note that you’ve joined the waitlist (so we don’t ask twice), the time of your last message (so we can pace messages politely), and the latest app version it found on GitHub (so downloads load quickly). If that ever changes, the choice will appear here first.</p>
      <div class="pc-row"><span><b>Advertising and tracking cookies</b><small>Not used. There is nothing to turn on or off.</small></span><span class="pc-sw" role="img" aria-label="Off"></span></div>
      <div class="pc-row"><span><b>Analytics</b><small>None on this website.</small></span><span class="pc-sw" role="img" aria-label="Off"></span></div>
      <div class="pc-links">
        <button type="button" data-clear>Clear what this site stored on my device</button>
        <a href="${esc((document.body.dataset.root || "") + "privacy/")}">Read the Privacy Policy</a>
      </div>
      <div class="fx-modal__act"><button type="button" class="btn btn-dark" data-close>Done</button></div>
    </div>`;
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
    $("[data-clear]", dlg).addEventListener("click", () => { STORAGE_KEYS.forEach((k) => store.del(k)); toast("Done. This site has nothing stored on your device now."); });
  }
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
}
