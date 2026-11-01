# Faxton Rentals waitlist security and email setup

This repository's waitlist backend targets the existing Firebase project `faxton-rentals`.

## 1. Set up the dashboard administrator by UID

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Email/Password**.
2. Create or choose a trusted admin account, verify the email, and copy that account's Firebase **UID** from **Authentication → Users**.
3. In **Firestore Database**, create a collection named `admins` and a document whose document ID is that exact UID. Add:
   - `role` — string — `admin`
   - `active` — boolean — `true`
4. Do not create admin documents for anyone else. The rules require the signed-in user to be authenticated, verified, and to have an active admin record for their UID. The admin document is the enforcement layer.

The rules intentionally prevent all client-side creation, editing, listing, or deletion of `admins` documents. Manage that collection only in Firebase Console or a trusted Admin SDK environment.

## 2. Configure email notifications

Notifications are sent server-side when a new `waitlist/{entryId}` document is created. The recipient address is supplied from a server secret, never from browser code.

1. Create/verify a sending domain in Resend and set up its DNS records. Use a sender address on that verified domain.
2. From the repository root, install the Firebase CLI if needed and sign in to the Firebase account that owns `faxton-rentals`.
3. Set the required Cloud Functions secrets (use your real values locally; never commit them):
   ```sh
   firebase functions:secrets:set RESEND_API_KEY
   firebase functions:secrets:set RESEND_FROM_EMAIL
   firebase functions:secrets:set ADMIN_EMAIL
   ```
   For `RESEND_FROM_EMAIL`, enter a sender such as `Faxton Rentals <notifications@your-verified-domain.com>` using your own verified domain.
4. Deploy the Firestore rules and notification function:
   ```sh
   firebase deploy --only firestore:rules,functions
   ```
5. Confirm the function is deployed in **Firebase Console → Functions**, then submit one test signup with a new email address and check the recipient inbox and function logs.

The sample sender fallback is Resend's test sender, which is not intended for general production delivery. Configure the secret with a verified sender before relying on notifications. Cloud Functions billing/plan requirements may apply to the Firebase project.

## 3. Security behavior

- Public visitors can create valid waitlist entries and contact messages only.
- Public visitors cannot read, list, edit, or delete waitlist records or contact messages.
- Only authenticated, verified admins with an active admin record for their own UID can read those collections.
- Admin records cannot be changed from the website client.
- Waitlist/contact field shapes and sizes are validated by Firestore rules.
- Email delivery happens in a Cloud Function, not the visitor's browser.

These rules do not by themselves provide strong rate limiting or bot prevention. Before a public launch, enable Firebase App Check for the web app and consider a server-side submission endpoint with rate limiting. Test rules in the Firebase Emulator or Rules Playground before deployment, and verify that existing site forms still work.

## 4. Remove the previous hardcoded admin email

Earlier versions of this project hardcoded a personal email address in public code. That pattern is no longer allowed. Use a Firebase admin account with a UID-linked `admins/{uid}` record instead.

For audit and compliance purposes, rotate or replace any old email-based admin references and ensure no private personal details remain in repository source or commit history.

## 5. Secret rotation recommendation

If any real secret or personal admin value was ever committed in a public repo, rotate the credentials immediately and, if necessary, rewrite commit history in coordination with the repo owners before a public release.

This repository intentionally keeps its public Firebase web API key in the browser config because that is required for Firebase client access. The key is not a secret. Only the backend and Firestore rules protect privileged operations.

This is a public static site; the security model depends on proper backend enforcement, not hiding public configuration values.

This file should not contain real personal or secret values. Keep it generic and operational.

## 6. Operational checklist

- Enable Email/Password in Firebase Authentication
- Add the trusted admin account and confirm the UID
- Create the `admins/{uid}` document with `role: "admin"` and `active: true`
- Set Cloud Function secrets for `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `ADMIN_EMAIL`
- Deploy the Firestore rules and functions
- Confirm the admin dashboard works via the UID allowlist
- Verify the website still accepts waitlist and contact submissions
- Keep the admin identity out of the public repository

This repo should not store a personal email as a public code artifact.

Next step: verify that the current code paths no longer check for a fixed email string and that admin access is UID-driven.





































































































































































































































































































































































































n













































































































n










































































































































































n




































































































































































































n





























































































n















n




































n










n



n





















n





n





n




n





n





n





n





n




n






n




n




n




n




n









n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n



n
n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n
n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n
n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n
n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n
n



n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n




n


