// Pure helpers for the waitlist and contact forms: validation, the document id, the Firestore REST body
// and the request itself. No DOM in here, so it can be tested with `node tests/waitlist.test.mjs`.
//
// Data contract (see README):
//   waitlist/<id>      id = first 32 hex characters of SHA-256(lowercased, trimmed email)
//                      fields: name, email, role, city, source, createdAt
//   siteMessages/<auto> fields: name, email, subject, message, source, createdAt

export const PROJECT_ID = "faxton-rentals";
export const ROLES = Object.freeze({ renter: "Renter", owner: "Home owner", agency: "Agency", agent: "Agent" });
export const SUBJECTS = Object.freeze(["General question", "Support", "List my property", "Press", "Other"]);
export const LIMITS = Object.freeze({ nameMin: 2, name: 80, email: 120, city: 60, messageMin: 10, message: 2000 });

export const normalizeEmail = (v) => String(v ?? "").trim().toLowerCase();
// Collapse runs of whitespace (single-line fields).
export const cleanLine = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
// Keep line breaks in the message but normalise them and trim.
export const cleanMessage = (v) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{4,}/g, "\n\n\n").trim();

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
export function isValidEmail(v) {
  const e = normalizeEmail(v);
  if (e.length < 6 || e.length > LIMITS.email) return false;
  if (!EMAIL_RE.test(e) || e.includes("..")) return false;
  const [local, domain] = e.split("@");
  return !local.startsWith(".") && !local.endsWith(".") && /[a-z]{2,}$/.test(domain);
}

const hasLetter = (s) => /\p{L}/u.test(s);

// SHA-256 of the normalised email, first 32 hex characters. Same email in any case = same id,
// so one address can only ever be on the list once.
export async function docIdForEmail(email) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is not available");
  const bytes = new TextEncoder().encode(normalizeEmail(email));
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ---------- validation: returns { ok, errors: {field: message}, values } ----------
export function validateWaitlist(input = {}) {
  const values = { name: cleanLine(input.name), email: normalizeEmail(input.email), role: String(input.role ?? "").trim(), city: cleanLine(input.city) };
  const errors = {};
  if (values.name.length < LIMITS.nameMin || !hasLetter(values.name)) errors.name = "Please enter your full name.";
  else if (values.name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;
  if (!values.email) errors.email = "Please enter your email address.";
  else if (!isValidEmail(values.email)) errors.email = "That email doesn't look right. Please check it.";
  if (!Object.hasOwn(ROLES, values.role)) errors.role = "Please choose what best describes you.";
  if (values.city.length < 2 || !hasLetter(values.city)) errors.city = "Please enter your city.";
  else if (values.city.length > LIMITS.city) errors.city = `Please keep the city under ${LIMITS.city} characters.`;
  return { ok: Object.keys(errors).length === 0, errors, values };
}

export function validateContact(input = {}) {
  const values = { name: cleanLine(input.name), email: normalizeEmail(input.email), subject: String(input.subject ?? "").trim(), message: cleanMessage(input.message) };
  const errors = {};
  if (values.name.length < LIMITS.nameMin || !hasLetter(values.name)) errors.name = "Please enter your full name.";
  else if (values.name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;
  if (!values.email) errors.email = "Please enter your email address.";
  else if (!isValidEmail(values.email)) errors.email = "That email doesn't look right. Please check it.";
  if (!SUBJECTS.includes(values.subject)) errors.subject = "Please choose a subject.";
  if (values.message.length < LIMITS.messageMin) errors.message = "Please write a little more so we can help.";
  else if (values.message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;
  return { ok: Object.keys(errors).length === 0, errors, values };
}

// ---------- Firestore REST bodies (exactly the contract fields, nothing else) ----------
const s = (stringValue) => ({ stringValue });
export function waitlistFields(v, now = new Date()) {
  return { name: s(v.name), email: s(v.email), role: s(v.role), city: s(v.city), source: s("website"), createdAt: { timestampValue: now.toISOString() } };
}
export function contactFields(v, now = new Date()) {
  return { name: s(v.name), email: s(v.email), subject: s(v.subject), message: s(v.message), source: s("website"), createdAt: { timestampValue: now.toISOString() } };
}

export const docsUrl = (collection, { docId, apiKey, projectId = PROJECT_ID } = {}) =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}?${docId ? `documentId=${encodeURIComponent(docId)}&` : ""}key=${encodeURIComponent(apiKey || "")}`;

// ---------- the request ----------
// Resolves to { status: "created" | "exists" | "denied" | "busy" | "error", http }. Never throws.
export async function createDocument({ collection, docId, fields, apiKey, projectId = PROJECT_ID, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  if (typeof fetchImpl !== "function") return { status: "error", http: 0 };
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(docsUrl(collection, { docId, apiKey, projectId }), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      ...(ctl ? { signal: ctl.signal } : {}),
    });
    if (res.ok) return { status: "created", http: res.status };
    let code = "";
    try { code = (await res.json())?.error?.status || ""; } catch { /* body was not JSON */ }
    if (res.status === 409 || code === "ALREADY_EXISTS") return { status: "exists", http: res.status };
    if (res.status === 403 || code === "PERMISSION_DENIED") return { status: "denied", http: res.status };
    if (res.status === 429 || code === "RESOURCE_EXHAUSTED") return { status: "busy", http: res.status };
    return { status: "error", http: res.status };
  } catch {
    return { status: "error", http: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function submitWaitlist(values, opts = {}) {
  const check = validateWaitlist(values);
  if (!check.ok) return { status: "invalid", errors: check.errors };
  const docId = await docIdForEmail(check.values.email);
  return createDocument({ collection: "waitlist", docId, fields: waitlistFields(check.values, opts.now), apiKey: opts.apiKey, projectId: opts.projectId, fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs });
}

export async function submitContact(values, opts = {}) {
  const check = validateContact(values);
  if (!check.ok) return { status: "invalid", errors: check.errors };
  return createDocument({ collection: "siteMessages", fields: contactFields(check.values, opts.now), apiKey: opts.apiKey, projectId: opts.projectId, fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs });
}

// Polite client-side throttle: true when `last` (a timestamp in ms) is more recent than `gapMs`.
export const tooSoon = (last, now = Date.now(), gapMs = 30000) => Number.isFinite(+last) && +last > 0 && now - +last < gapMs;
export const secondsLeft = (last, now = Date.now(), gapMs = 30000) => Math.max(0, Math.ceil((+last + gapMs - now) / 1000));
