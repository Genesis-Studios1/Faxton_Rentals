# Faxton Rentals waitlist security and email setup

This repository contains the public static website and its Firebase-backed waitlist/contact forms. The Firebase project is `faxton-rentals`.

## 1. Provision an administrator by Firebase UID

1. In Firebase Console, open **Authentication → Sign-in method** and enable Email/Password (or the sign-in provider approved for your administrators).
2. Create or select the administrator account in **Authentication → Users**, verify its email, and copy its Firebase **UID**. Do not use an email address as an authorization identifier.
3. In **Firestore Database**, create `admins/{UID}`, using the exact Firebase Authentication UID as the document ID. Set:
   - `role` — string — `admin`
   - `active` — boolean — `true`
4. Manage this collection only through Firebase Console or a trusted Admin SDK environment. Never grant client-side writes to `admins`.

The admin dashboard accepts a Firebase sign-in, then checks the matching UID document. Firestore rules independently enforce that the authenticated UID has an active admin record and a verified email. The client-side check is for user experience only; Firestore rules are the authorization boundary.

To revoke access, set `active` to `false` or delete the admin document. Do not create an admin document for an untrusted UID.

## 2. Configure email notifications

The waitlist notification is sent by a Cloud Function. All delivery credentials and the recipient address are stored as Firebase Secret Manager secrets; they must never be placed in browser configuration or committed to Git.

1. Create and verify a sending domain in Resend.
2. From the repository root, install the Firebase CLI if needed and sign in to the Firebase account that owns `faxton-rentals`.
3. Configure all three secrets:
   ```sh
   firebase functions:secrets:set RESEND_API_KEY
   firebase functions:secrets:set RESEND_FROM_EMAIL
   firebase functions:secrets:set WAITLIST_ADMIN_EMAIL
   ```
4. Set `RESEND_FROM_EMAIL` to a sender on the verified domain and `WAITLIST_ADMIN_EMAIL` to the monitored inbox that should receive signup notifications.
5. Deploy:
   ```sh
   firebase deploy --only firestore:rules,functions
   ```
6. Submit a test signup and check the recipient inbox and Cloud Function logs.

The function intentionally has no hardcoded recipient or unverified default sender. It will not deliver notifications correctly until all required secrets are configured.

## 3. Public Firebase configuration

The Firebase web API key and project ID in `assets/site-config.js` are browser configuration, not admin credentials. They cannot authorize privileged Firestore reads or writes by themselves. Keep the key restricted to the Firebase APIs and website origins where practical, enable Firebase App Check for the web app, and enforce App Check for Firestore after the website submission flow has been updated to provide valid App Check tokens.

Never put a service-account JSON file, Admin SDK private key, Resend API key, or other server credential in `assets/`, HTML, JavaScript shipped to browsers, or Git.

## 4. Current data access model

- Public visitors can create waitlist entries and contact messages that satisfy the Firestore rules.
- Public visitors cannot read, list, update, or delete those records.
- Only authenticated users with a verified email and an active `admins/{UID}` record can read waitlist and contact records.
- Admin records cannot be created, edited, listed, or deleted by website clients.
- Firestore rules validate field names, types, allowed roles/subjects, lengths, and timestamp windows.
- Email delivery happens in a Cloud Function, not in the visitor's browser.

## 5. Abuse-prevention limitation

Firestore rules validate document shape, but they do not provide a robust per-IP or per-device rate limiter. The current website-side honeypot and local-storage cooldown can be bypassed by a custom client. Before a public launch, route submissions through a server-side endpoint with Firebase App Check and server-enforced rate limiting (and CAPTCHA/risk checks if abuse warrants it). Enable App Check enforcement only after the production website can send valid App Check tokens, otherwise legitimate form submissions will fail.

Run the repository's automated tests and Firebase Emulator security-rule tests before deploying. Confirm the public forms, admin sign-in, admin reads, and notification delivery in the production project after deployment.
