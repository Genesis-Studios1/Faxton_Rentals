import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const admin = readFileSync("admin/waitlist/admin.js", "utf8");
const rules = readFileSync("firestore.rules", "utf8");
const fn = readFileSync("functions/index.js", "utf8");
const firebase = JSON.parse(readFileSync("firebase.json", "utf8"));
const adminHtml = readFileSync("admin/waitlist/index.html", "utf8");

assert.match(admin, /^import\s+\{\s*CONFIG\s*\}/, "admin dashboard entry must be JavaScript");
assert.doesNotMatch(admin, /rules_version\s*=|service cloud\.firestore/, "Firestore rules must not be stored as admin JavaScript");
assert.match(rules, /^rules_version\s*=\s*['"]2['"];\s*service cloud\.firestore/, "firestore.rules must contain Firestore rules");
assert.match(rules, /function isAdminSignedIn\(\)/, "Firestore rules must enforce admin authorization");
assert.match(rules, /allow get, list: if isAdminSignedIn\(\)/, "waitlist and messages must be admin-only");
assert.match(fn, /exports\.notifyWaitlistSignup\s*=\s*onDocumentCreated/, "Cloud Function entry must export the waitlist notification trigger");
assert.match(fn, /defineSecret\(["']ADMIN_EMAIL["']\)/, "notification recipient must come from a server-side secret");
assert.doesNotMatch(fn, /^#\s/m, "functions/index.js must not contain Markdown documentation");
assert.equal(firebase.firestore?.rules, "firestore.rules", "Firebase must deploy the checked rules file");
assert.equal(firebase.functions?.[0]?.source, "functions", "Firebase must deploy the checked functions directory");
assert.match(adminHtml, /type="module"\s+src="admin\.js"/, "admin page must load its JavaScript module");
console.log("PASS: admin script, Firestore rules, Cloud Function and Firebase deployment files are in their correct locations.");
