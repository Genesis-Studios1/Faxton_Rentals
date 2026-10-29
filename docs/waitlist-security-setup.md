# Faxton Rentals waitlist security and email setup

This repository's waitlist backend targets the existing Firebase project `faxton-rentals`.

## 1. Set up the single dashboard administrator

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Email/Password**.
2. Add the account `isaacij6yes@gmail.com` in **Authentication → Users** (or register it through a trusted flow). Use a strong, unique password and enable email verification.
3. Sign in once, verify that email address, then copy that account's Firebase **UID** from Authentication → Users.
4. In **Firestore Database**, create a collection named `admins` and a document whose document ID is that exact UID. Add:
   - `role` — string — `admin`
   - `active` — boolean — `true`
5. Do not create admin documents for anyone else. The rules require the verified token email to equal `isaacij6yes@gmail.com`, and also require this UID's active admin document. Client-side email checks are only an extra layer; the Firestore rules are the enforcement layer.

The rules intentionally prevent all client-side creation, editing, listing, or deletion of `admins` documents. Manage that collection only in Firebase Console or a trusted Admin SDK environment.

## 2. Configure email notifications

Notifications are sent server-side when a new `waitlist/{entryId}` document is created. The message is sent only to `isaacij6yes@gmail.com`; the provider key is never exposed in browser code.

1. Create/verify a sending domain in Resend and set up its DNS records. Use a sender address on that verified domain.
2. From the repository root, install the Firebase CLI if needed and sign in to the Firebase account that owns `faxton-rentals`.
3. Set the two Cloud Functions secrets (use your real values locally; never commit them):
   ```sh
   firebase functions:secrets:set RESEND_API_KEY
   firebase functions:secrets:set RESEND_FROM_EMAIL
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
- Only the verified `isaacij6yes@gmail.com` account with an active admin record can read those collections.
- Admin records cannot be changed from the website client.
- Waitlist/contact field shapes and sizes are validated by Firestore rules.
- Email delivery happens in a Cloud Function, not the visitor's browser.

These rules do not by themselves provide strong rate limiting or bot prevention. Before a public launch, enable Firebase App Check for the web app and consider a server-side submission endpoint with rate limiting. Test rules in the Firebase Emulator or Rules Playground before deployment, and verify that existing site forms still work.
