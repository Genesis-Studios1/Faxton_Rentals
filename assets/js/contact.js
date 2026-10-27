// Contact page: info cards from the config (hidden when a value is empty) and the message form.
import { CONFIG } from "./config.js";
import { SUBJECTS, validateContact, submitContact, tooSoon, secondsLeft } from "./waitlist-core.js";
import { $, $$, esc, icon, store } from "./ui.js";

const KEY = "fxr.lastMessage";
const FIELDS = ["name", "email", "subject", "message"];
const rootPath = () => document.body.dataset.root || "";

function infoCards() {
  const list = $("[data-info]");
  if (!list) return;
  const cards = [];
  const card = (ic, title, text, href, note, ext = false) => {
    const inner = `<span class="icon-tile">${icon(ic)}</span><span><h3>${esc(title)}</h3><p>${esc(text)}</p>${note ? `<small>${esc(note)}</small>` : ""}</span>`;
    return href ? `<a class="icard" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>` : `<div class="icard is-placeholder">${inner}</div>`;
  };
  cards.push(CONFIG.SUPPORT_EMAIL
    ? card("mail", "Email", CONFIG.SUPPORT_EMAIL, `mailto:${CONFIG.SUPPORT_EMAIL}`, "We reply as soon as we can")
    : card("mail", "Email", "Contact details coming soon", "", ""));
  cards.push(CONFIG.PHONE
    ? card("phone", "Phone", CONFIG.PHONE, `tel:${CONFIG.PHONE.replace(/[^\d+]/g, "")}`, "")
    : card("phone", "Phone", "Contact details coming soon", "", ""));
  cards.push(CONFIG.WHATSAPP
    ? card("whatsapp", "WhatsApp", "Chat with us on WhatsApp", `https://wa.me/${CONFIG.WHATSAPP}`, "", true)
    : card("whatsapp", "WhatsApp", "Contact details coming soon", "", ""));
  if (CONFIG.ADDRESS) cards.push(card("pin", "Our office", CONFIG.ADDRESS, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONFIG.ADDRESS)}`, "", true));
  const first = list.firstElementChild;
  cards.reverse().forEach((html) => { const li = document.createElement("li"); li.innerHTML = html; list.insertBefore(li, first); });
  // the static Help centre card points at the configured app
  $$("a[data-app]").forEach((a) => { a.href = CONFIG.APP_URL + a.dataset.app; });
}

export function initContact() {
  infoCards();
  const form = $("[data-contact-form]");
  if (!form) return;
  const status = $("[data-contact-status]"), sent = $("[data-contact-sent]"), wrap = $("[data-contact-wrap]");
  const submit = $("button[type=submit]", form), submitHtml = submit.innerHTML;
  const counter = $("[data-counter]", form), msg = form.elements.message;
  const max = +msg.getAttribute("maxlength") || 2000;
  const field = (n) => ({ wrap: $(`[data-f="${n}"]`, form), input: form.elements[n], err: $(`[data-f="${n}"] .field-err`, form) });
  const setErr = (n, text) => {
    const { wrap: w, input, err } = field(n);
    w.classList.toggle("has-err", !!text);
    if (text) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", err.id); } else input.removeAttribute("aria-invalid");
    err.textContent = text || "";
  };
  const clearAll = () => { FIELDS.forEach((n) => setErr(n, "")); status.className = "form-status"; status.textContent = ""; };
  const count = () => { counter.textContent = `${msg.value.length} / ${max}`; };
  count();
  msg.addEventListener("input", count);
  FIELDS.forEach((n) => form.elements[n].addEventListener("input", () => { if (field(n).wrap.classList.contains("has-err")) setErr(n, ""); }));

  // preselect the subject from ?subject=list (used by links on other pages)
  const pre = new URLSearchParams(location.search).get("subject");
  const map = { list: "List my property", support: "Support", press: "Press", general: "General question" };
  if (pre && map[pre] && SUBJECTS.includes(map[pre])) form.elements.subject.value = map[pre];

  let last = Number(store.get(KEY)) || 0, busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    clearAll();
    const check = validateContact(Object.fromEntries(FIELDS.map((n) => [n, form.elements[n].value])));
    if (!check.ok) {
      FIELDS.forEach((n) => setErr(n, check.errors[n] || ""));
      form.elements[FIELDS.find((n) => check.errors[n])].focus();
      return;
    }
    if (form.elements.website && form.elements.website.value.trim() !== "") { showSent(check.values); return; } // honeypot
    last = Math.max(last, Number(store.get(KEY)) || 0);
    if (tooSoon(last)) {
      status.className = "form-status is-info";
      status.textContent = `Thank you. Please wait ${secondsLeft(last)} seconds before sending another message.`;
      return;
    }
    busy = true; submit.disabled = true; submit.innerHTML = `<span class="spinner" aria-hidden="true"></span> Sending…`;
    status.className = "form-status is-info"; status.textContent = "Sending your message…";
    let result;
    try { result = await submitContact(check.values, { apiKey: CONFIG.FIREBASE.apiKey, projectId: CONFIG.FIREBASE.projectId }); } catch { result = { status: "error" }; }
    busy = false; submit.disabled = false; submit.innerHTML = submitHtml; status.className = "form-status"; status.textContent = "";
    if (result.status === "created") { last = Date.now(); store.set(KEY, String(last)); showSent(check.values); }
    else if (result.status === "invalid") FIELDS.forEach((n) => setErr(n, result.errors?.[n] || ""));
    else {
      const mail = CONFIG.SUPPORT_EMAIL;
      status.className = "form-status is-error";
      status.innerHTML = "We couldn’t save that right now. Please try again" + (mail ? ` or email us at <a href="mailto:${esc(mail)}">${esc(mail)}</a>.` : ` in a moment, or use the <a href="${esc(CONFIG.APP_URL)}/#/help" target="_blank" rel="noopener">Help centre</a> in the app.`);
    }
  });

  function showSent(v) {
    const first = String(v.name).split(/\s+/)[0];
    sent.innerHTML = `<span class="wl__badge">${icon("check")}</span><h2 tabindex="-1" id="sent-title">Message sent</h2>
      <p>Thank you, ${esc(first)}. We’ve got your message and we’ll reply to <b>${esc(v.email)}</b> as soon as we can.</p>
      <button type="button" class="btn btn-outline" data-again>Send another message</button>`;
    wrap.hidden = true; sent.hidden = false;
    $("#sent-title", sent).focus();
    $("[data-again]", sent).addEventListener("click", () => { form.reset(); count(); clearAll(); sent.hidden = true; wrap.hidden = false; form.elements.name.focus(); });
  }
}
