import { CONFIG } from "../../assets/js/config.js";

const $ = (s, root = document) => root.querySelector(s);
const loginView = $("#login-view"), dashboardView = $("#dashboard-view"), loginForm = $("#login-form");
const loginStatus = $("#login-status"), signout = $("#signout"), notice = $("#notice");
const API_KEY = CONFIG.FIREBASE.apiKey;
const PROJECT_ID = CONFIG.FIREBASE.projectId || "faxton-rentals";
let idToken = "", currentUser = null, records = [];

$("#year").textContent = new Date().getFullYear();

function message(el, text, isError = false) { el.textContent = text; el.classList.toggle("error", isError); el.hidden = !text; }
function requiredConfig() { if (!API_KEY || !PROJECT_ID) throw new Error("Firebase configuration is missing. Check assets/site-config.js before using the admin dashboard."); }
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: "Bearer " + idToken } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body?.error?.message || "REQUEST_FAILED";
    if (response.status === 403 || /PERMISSION_DENIED|insufficient permissions/i.test(code)) throw new Error("Access denied by Firestore rules. Confirm this UID is an active admin and the admin-only rules are deployed.");
    if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_EMAIL/i.test(code)) throw new Error("Email or password was not recognised.");
    throw new Error(code.replaceAll("_", " ").toLowerCase());
  }
  return body;
}
async function signIn(email, password) {
  requiredConfig();
  const result = await api("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + encodeURIComponent(API_KEY), { method: "POST", body: JSON.stringify({ email, password, returnSecureToken: true }) });
  idToken = result.idToken; currentUser = { uid: result.localId, email: result.email, refreshToken: result.refreshToken, expiresIn: Number(result.expiresIn || 3600) };
  // The admin document is a second gate; a Firebase user account alone must never grant dashboard access.
  const admin = await api("https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(PROJECT_ID) + "/databases/(default)/documents/admins/" + encodeURIComponent(currentUser.uid));
  const fields = admin.fields || {};
  const role = fields.role?.stringValue;
  const active = fields.active?.booleanValue;
  if (role !== "admin" || active !== true) { idToken = ""; currentUser = null; throw new Error("This account is not on the active admin allowlist. Ask the project owner to grant admin access."); }
}
function showDashboard() { loginView.hidden = true; dashboardView.hidden = false; signout.hidden = false; }
function showLogin() { idToken = ""; currentUser = null; records = []; dashboardView.hidden = true; loginView.hidden = false; signout.hidden = true; }
function value(fields, key) { const v = fields?.[key]; return v?.stringValue ?? v?.timestampValue ?? ""; }
function prettyRole(role) { return ({ renter: "Renter", owner: "Property owner", agency: "Agency", agent: "Agent" })[role] || role || "Unknown"; }
function dateLabel(raw) { if (!raw) return "—"; const d = new Date(raw); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(d); }
function safeText(text) { return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function render() {
  const query = $("#search").value.trim().toLowerCase(), role = $("#role-filter").value;
  const filtered = records.filter(r => (role === "all" || r.role === role) && [r.name, r.email, r.city, prettyRole(r.role)].some(v => String(v).toLowerCase().includes(query)));
  $("#total").textContent = records.length.toLocaleString("en-NG");
  $("#renters").textContent = records.filter(r => r.role === "renter").length.toLocaleString("en-NG");
  $("#owners").textContent = records.filter(r => r.role === "owner").length.toLocaleString("en-NG");
  $("#pros").textContent = records.filter(r => r.role === "agent" || r.role === "agency").length.toLocaleString("en-NG");
  $("#result-count").textContent = "Showing " + filtered.length.toLocaleString("en-NG") + " of " + records.length.toLocaleString("en-NG") + " registrations";
  const rows = $("#rows");
  if (!filtered.length) { rows.innerHTML = '<tr><td colspan="5" class="empty">No matching registrations. Try another search or filter.</td></tr>'; return; }
  rows.innerHTML = filtered.map(r => '<tr><td><span class="person">' + safeText(r.name) + '</span></td><td><span class="email">' + safeText(r.email) + '</span></td><td><span class="role-pill ' + safeText(r.role) + '">' + safeText(prettyRole(r.role)) + '</span></td><td>' + safeText(r.city || "—") + '</td><td>' + safeText(dateLabel(r.createdAt)) + '</td></tr>').join("");
}
async function loadRecords() {
  message(notice, "Loading authorised waitlist records…");
  try {
    let all = [], pageToken = "";
    do {
      const url = new URL("https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(PROJECT_ID) + "/databases/(default)/documents/waitlist");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await api(url.toString());
      all = all.concat((result.documents || []).map(doc => {
        const f = doc.fields || {};
        return { id: doc.name?.split("/").pop() || "", name: value(f, "name"), email: value(f, "email"), role: value(f, "role"), city: value(f, "city"), createdAt: value(f, "createdAt") };
      }));
      pageToken = result.nextPageToken || "";
    } while (pageToken && all.length < 5000);
    records = all.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    message(notice, records.length >= 5000 ? "Showing the first 5,000 records. Narrow your data or export in batches for larger lists." : "");
    render();
  } catch (err) {
    message(notice, err.message || "Could not load the waitlist.", true);
  }
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $('button[type="submit"]', loginForm), label = $("span", button);
  button.disabled = true; label.textContent = "Checking access…"; message(loginStatus, "");
  try { await signIn($("#email").value.trim(), $("#password").value); showDashboard(); await loadRecords(); }
  catch (err) { message(loginStatus, err.message || "Sign-in failed.", true); }
  finally { button.disabled = false; label.textContent = "Sign in securely"; }
});
signout.addEventListener("click", () => { showLogin(); loginForm.reset(); message(loginStatus, "You have signed out."); });
$("#refresh").addEventListener("click", loadRecords);
$("#search").addEventListener("input", render);
$("#role-filter").addEventListener("change", render);
$("#export").addEventListener("click", () => {
  const query = $("#search").value.trim().toLowerCase(), role = $("#role-filter").value;
  const filtered = records.filter(r => (role === "all" || r.role === role) && [r.name,r.email,r.city,prettyRole(r.role)].some(v => String(v).toLowerCase().includes(query)));
  const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const csv = [["Name","Email","Type","City","Joined"], ...filtered.map(r => [r.name,r.email,prettyRole(r.role),r.city,dateLabel(r.createdAt)])].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = "faxton-waitlist-" + new Date().toISOString().slice(0,10) + ".csv"; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
