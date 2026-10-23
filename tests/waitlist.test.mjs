// Run with: node tests/waitlist.test.mjs   (Node 18+; no packages needed)
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  normalizeEmail, isValidEmail, docIdForEmail, validateWaitlist, validateContact,
  waitlistFields, contactFields, docsUrl, createDocument, submitWaitlist, submitContact,
  tooSoon, secondsLeft, ROLES, SUBJECTS, LIMITS,
} from "../assets/js/waitlist-core.js";

const sha32 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const resp = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Ada.Obi@Example.COM \n"), "ada.obi@example.com");
  assert.equal(normalizeEmail(null), "");
});

test("isValidEmail accepts normal addresses and rejects bad ones", () => {
  for (const ok of ["a@b.co", "ada.obi+faxton@example.com", "x_y-z@sub.domain.ng", "USER@EXAMPLE.COM"]) assert.ok(isValidEmail(ok), ok);
  for (const bad of ["", "plain", "a@b", "a@b.", "@b.com", "a b@c.com", "a@b..com", ".a@b.com", "a.@b.com", "a@-b.com", "a@b.c", `${"x".repeat(115)}@b.com`]) assert.ok(!isValidEmail(bad), bad);
});

test("docIdForEmail is the first 32 hex chars of SHA-256 of the normalised email", async () => {
  const id = await docIdForEmail("Ada@Example.com ");
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(id, sha32("ada@example.com"));
  assert.equal(await docIdForEmail("ADA@EXAMPLE.COM"), id); // case does not matter
  assert.notEqual(await docIdForEmail("ada2@example.com"), id);
  // a known vector, so a change to the algorithm is caught
  assert.equal(await docIdForEmail("test@example.com"), "973dfe463ec85785f5f95af5ba3906ee");
});

test("validateWaitlist cleans values and reports each problem", () => {
  const good = validateWaitlist({ name: "  Ada   Obi ", email: " Ada@Example.com", role: "renter", city: " Lagos " });
  assert.ok(good.ok);
  assert.deepEqual(good.values, { name: "Ada Obi", email: "ada@example.com", role: "renter", city: "Lagos" });

  const bad = validateWaitlist({ name: "A", email: "nope", role: "boss", city: "" });
  assert.ok(!bad.ok);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["city", "email", "name", "role"]);

  assert.ok(validateWaitlist({ name: "x".repeat(LIMITS.name + 1), email: "a@b.co", role: "owner", city: "Abuja" }).errors.name);
  assert.ok(validateWaitlist({ name: "Ada", email: "a@b.co", role: "owner", city: "y".repeat(LIMITS.city + 1) }).errors.city);
  assert.ok(validateWaitlist({ name: "12345", email: "a@b.co", role: "agent", city: "Abuja" }).errors.name); // needs a letter
  assert.ok(validateWaitlist({ name: "Ọlá Ṣadé", email: "a@b.co", role: "agency", city: "Ibadan" }).ok);      // non-ASCII names are fine
  assert.deepEqual(Object.keys(ROLES), ["renter", "owner", "agency", "agent"]);
});

test("waitlistFields has exactly the contract fields", () => {
  const f = waitlistFields({ name: "Ada Obi", email: "ada@example.com", role: "renter", city: "Lagos" }, new Date("2026-10-22T10:00:00.000Z"));
  assert.deepEqual(Object.keys(f).sort(), ["city", "createdAt", "email", "name", "role", "source"]);
  assert.deepEqual(f.source, { stringValue: "website" });
  assert.deepEqual(f.createdAt, { timestampValue: "2026-10-22T10:00:00.000Z" });
  assert.deepEqual(f.role, { stringValue: "renter" });
});

test("validateContact and contactFields", () => {
  const good = validateContact({ name: "Ada Obi", email: "ada@example.com", subject: "Support", message: "My account will not open, please help." });
  assert.ok(good.ok);
  const f = contactFields(good.values, new Date("2026-10-22T10:00:00.000Z"));
  assert.deepEqual(Object.keys(f).sort(), ["createdAt", "email", "message", "name", "source", "subject"]);
  assert.equal(f.source.stringValue, "website");
  const bad = validateContact({ name: "", email: "x", subject: "Spam", message: "hi" });
  assert.deepEqual(Object.keys(bad.errors).sort(), ["email", "message", "name", "subject"]);
  assert.ok(validateContact({ ...good.values, message: "m".repeat(LIMITS.message + 1) }).errors.message);
  assert.deepEqual([...SUBJECTS], ["General question", "Support", "List my property", "Press", "Other"]);
});

test("docsUrl builds the Firestore REST address", () => {
  assert.equal(docsUrl("waitlist", { docId: "abc", apiKey: "K" }), "https://firestore.googleapis.com/v1/projects/faxton-rentals/databases/(default)/documents/waitlist?documentId=abc&key=K");
  assert.equal(docsUrl("siteMessages", { apiKey: "K" }), "https://firestore.googleapis.com/v1/projects/faxton-rentals/databases/(default)/documents/siteMessages?key=K");
});

test("createDocument maps HTTP results and never throws", async () => {
  const run = (fetchImpl) => createDocument({ collection: "waitlist", docId: "x", fields: {}, apiKey: "K", fetchImpl });
  assert.equal((await run(async () => resp(200))).status, "created");
  assert.equal((await run(async () => resp(409, { error: { status: "ALREADY_EXISTS" } }))).status, "exists");
  assert.equal((await run(async () => resp(403))).status, "denied");
  assert.equal((await run(async () => resp(429))).status, "busy");
  assert.equal((await run(async () => resp(500))).status, "error");
  assert.equal((await run(async () => { throw new TypeError("network down"); })).status, "error");
  assert.equal((await run(async () => ({ ok: false, status: 400, json: async () => { throw new Error("bad json"); } }))).status, "error");
  assert.equal((await createDocument({ collection: "x", fields: {}, apiKey: "K", fetchImpl: null })).status, "error");
});

test("submitWaitlist posts to the hashed document id with the right body", async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return resp(200); };
  const r = await submitWaitlist({ name: "Ada Obi", email: "Ada@Example.com", role: "agent", city: "Lagos" }, { apiKey: "KEY", fetchImpl, now: new Date("2026-10-22T10:00:00.000Z") });
  assert.equal(r.status, "created");
  assert.ok(seen.url.includes(`/documents/waitlist?documentId=${sha32("ada@example.com")}&key=KEY`));
  assert.equal(seen.init.method, "POST");
  const body = JSON.parse(seen.init.body);
  assert.deepEqual(Object.keys(body), ["fields"]);
  assert.equal(body.fields.email.stringValue, "ada@example.com");
  assert.equal(body.fields.role.stringValue, "agent");
  const dup = await submitWaitlist({ name: "Ada Obi", email: "ada@example.com", role: "agent", city: "Lagos" }, { apiKey: "KEY", fetchImpl: async () => resp(409) });
  assert.equal(dup.status, "exists");
  const inv = await submitWaitlist({ name: "", email: "", role: "", city: "" }, { apiKey: "KEY", fetchImpl });
  assert.equal(inv.status, "invalid");
});

test("submitContact posts to siteMessages without a document id", async () => {
  let seen;
  const r = await submitContact({ name: "Ada Obi", email: "ada@example.com", subject: "Press", message: "Hello, I am writing about Faxton." }, { apiKey: "KEY", fetchImpl: async (u, i) => { seen = { u, i }; return resp(200); } });
  assert.equal(r.status, "created");
  assert.ok(seen.u.endsWith("/documents/siteMessages?key=KEY"));
  assert.ok(!seen.u.includes("documentId"));
});

test("throttle helpers", () => {
  const now = 1_000_000;
  assert.equal(tooSoon(now - 10_000, now), true);
  assert.equal(tooSoon(now - 31_000, now), false);
  assert.equal(tooSoon(0, now), false);
  assert.equal(tooSoon("junk", now), false);
  assert.equal(secondsLeft(now - 10_000, now), 20);
  assert.equal(secondsLeft(now - 60_000, now), 0);
});
