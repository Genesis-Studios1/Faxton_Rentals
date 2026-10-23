// Waitlist card: validation, submit to Firestore (REST), and the success / already-on-the-list / error states.
import { CONFIG } from "./config.js";
import { ROLES, validateWaitlist, submitWaitlist } from "./waitlist-core.js";
import { $, $$, esc, icon, store, toast, shareUrl } from "./ui.js";

const KEY = "fxr.joined";
const FIELDS = ["name", "email", "role", "city"];

const rootPath = () => document.body.dataset.root || "";
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

function errorMessage(result) {
  const lead = result.status === "denied" || result.status === "busy"
    ? "We couldn’t save that right now. Please try again in a moment"
    : "We couldn’t save that right now. Please try again";
  const mail = CONFIG.SUPPORT_EMAIL;
  const alt = mail
    ? ` or email us at <a href="mailto:${esc(mail)}">${esc(mail)}</a>.`
    : ` or <a href="${esc(rootPath())}contact/">send us a message on the Contact page</a>.`;
  return lead + alt;
}

export function initWaitlist() {
  const section = $("[data-waitlist]");
  const form = $("[data-wl-form]", section || document);
  if (!section || !form) return;
  const panel = $("[data-wl-panel]", section), done = $("[data-wl-done]", section), status = $("[data-wl-status]", section);
  const submit = $("button[type=submit]", form);
  const submitHtml = submit.innerHTML;

  const field = (n) => ({ wrap: $(`[data-f="${n}"]`, form), input: form.elements[n], err: $(`[data-f="${n}"] .field-err`, form) });
  const setErr = (n, msg) => {
    const { wrap, input, err } = field(n);
    wrap.classList.toggle("has-err", !!msg);
    if (msg) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", err.id); } else input.removeAttribute("aria-invalid");
    err.textContent = msg || "";
  };
  const clearAll = () => { FIELDS.forEach((n) => setErr(n, "")); status.className = "form-status"; status.textContent = ""; };

  // pick a role from a link such as ?role=owner#waitlist or any [data-role] button
  const setRole = (r) => { if (Object.hasOwn(ROLES, r)) form.elements.role.value = r; };
  const params = new URLSearchParams(window.location.search);
  setRole(params.get("role"));
  $$("a[data-role]").forEach((a) => a.addEventListener("click", (e) => {
    setRole(a.dataset.role);
    e.preventDefault();
    showForm();
    section.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => form.elements.name.focus({ preventScroll: true }), 450);
    history.replaceState(null, "", `#waitlist`);
  }));

  // live clean-up of errors as people type
  FIELDS.forEach((n) => {
    const el = form.elements[n];
    el.addEventListener("input", () => { if (field(n).wrap.classList.contains("has-err")) setErr(n, ""); });
  });

  function showForm() { done.hidden = true; panel.hidden = false; }
  function showDone({ kind, name = "", email = "", city = "" }) {
    const url = shareUrl(CONFIG.SITE_URL);
    const text = `I just joined the waitlist for Faxton Rentals, a smarter, safer way to rent a home in Nigeria. Join me: ${url}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const title = kind === "exists" ? "You’re already on the list" : "You’re on the list";
    let body;
    if (kind === "exists") body = `Good news: <b>${esc(email)}</b> is already registered, so there’s nothing more to do. We’ll be in touch when Faxton Rentals opens.`;
    else if (kind === "remembered") body = "You joined the waitlist from this device. We’ll email you when Faxton Rentals opens. Know someone who’s looking for a home? Tell them.";
    else body = `Thanks${firstName(name) ? ", " + esc(firstName(name)) : ""}. We’ll email <b>${esc(email)}</b> once, when Faxton Rentals opens${city ? " in " + esc(city) : ""}. Know someone who’s looking for a home? Tell them.`;
    done.innerHTML = `<span class="wl__badge">${icon("check")}</span>
      <div><h2 tabindex="-1" id="wl-done-title">${title}</h2><p>${body}</p><button type="button" class="wl__again" data-again>Use a different email</button></div>
      <div class="btn-row">
        <a class="btn btn-lime" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${icon("whatsapp")} Share on WhatsApp</a>
        ${navigator.share ? `<button type="button" class="btn btn-outline" data-native-share>${icon("share")} Share</button>` : ""}
        <button type="button" class="btn btn-outline" data-copy>${icon("copy")} Copy link</button>
      </div>`;
    panel.hidden = true; done.hidden = false;
    $("[data-again]", done).addEventListener("click", () => { store.del(KEY); form.reset(); form.elements.city.value = "Lagos"; setRole(params.get("role") || "renter"); clearAll(); showForm(); form.elements.name.focus(); });
    $("[data-copy]", done).addEventListener("click", async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch {
        const t = document.createElement("textarea"); t.value = url; t.setAttribute("readonly", ""); t.className = "hp"; document.body.append(t); t.select();
        try { ok = document.execCommand("copy"); } catch { ok = false; } t.remove();
      }
      toast(ok ? "Link copied. Paste it anywhere." : `Copy this link: ${url}`);
    });
    $("[data-native-share]", done)?.addEventListener("click", () => navigator.share({ title: "Faxton Rentals", text: "I just joined the Faxton Rentals waitlist.", url }).catch(() => {}));
    if (kind !== "remembered") $("#wl-done-title", done).focus({ preventScroll: false });
  }

  // already joined on this device? show that instead of the form
  if (store.get(KEY)) showDone({ kind: "remembered" });

  let busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    clearAll();
    const data = Object.fromEntries(FIELDS.map((n) => [n, form.elements[n].value]));
    const check = validateWaitlist(data);
    if (!check.ok) {
      FIELDS.forEach((n) => setErr(n, check.errors[n] || ""));
      const first = FIELDS.find((n) => check.errors[n]);
      form.elements[first].focus();
      return;
    }
    // honeypot: real people never see or fill this. Pretend it worked and send nothing.
    if (form.elements.website && form.elements.website.value.trim() !== "") { showDone({ kind: "joined", ...check.values }); return; }

    busy = true; submit.disabled = true;
    submit.innerHTML = `<span class="spinner" aria-hidden="true"></span> Joining…`;
    status.className = "form-status is-info"; status.textContent = "Saving your place on the list…";
    let result;
    try { result = await submitWaitlist(check.values, { apiKey: CONFIG.FIREBASE.apiKey, projectId: CONFIG.FIREBASE.projectId }); }
    catch { result = { status: "error" }; }
    busy = false; submit.disabled = false; submit.innerHTML = submitHtml;
    status.textContent = ""; status.className = "form-status";

    if (result.status === "created" || result.status === "exists") {
      store.set(KEY, JSON.stringify({ at: Date.now(), kind: result.status }));
      showDone({ kind: result.status === "exists" ? "exists" : "joined", ...check.values });
    } else if (result.status === "invalid") {
      FIELDS.forEach((n) => setErr(n, result.errors?.[n] || ""));
    } else {
      status.className = "form-status is-error";
      status.innerHTML = errorMessage(result);
    }
  });

  // arriving on /#waitlist or ?role=…#waitlist: focus the first field once the page has scrolled there
  if (window.location.hash === "#waitlist" && params.get("role") && !store.get(KEY)) setTimeout(() => form.elements.name.focus({ preventScroll: true }), 700);
}
