# Faxton Homes — Faxton Rentals website

This is the public information website for **Faxton Rentals**, the rental marketplace product operated under the **Faxton Homes** business name. Faxton Homes is the agreed business name; any formal legal status depends on registration approval. Faxton Rentals remains the app and customer-facing brand.

The site shares product information, lets people **join the waitlist**, and lets them **download the apps**. There is no login on this website: the product itself is the Faxton app.

Plain HTML, CSS and JavaScript. No framework, no build step, no analytics, no cookies, no third-party scripts.

| Page | Folder |
|---|---|
| Home | `index.html` |
| Features | `features/` |
| Contact us | `contact/` |
| About us | `about/` |
| Billing | `billing/` |
| Not found | `404.html` |

## Run it on your computer

```bash
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

Do not open `index.html` by double-clicking it: browsers block JavaScript modules on `file://`.

## Fill in the contact details (the only file most people need to edit)

Open **`assets/site-config.js`**. Everything is empty on purpose, because nothing here may be invented:

| Setting | What it does when set | When empty |
|---|---|---|
| `SUPPORT_EMAIL` | Email card on Contact, and used in error messages | Card hidden |
| `PHONE` | Phone card on Contact | Card hidden |
| `WHATSAPP` (digits, e.g. `2348000000000`) | WhatsApp card on Contact | Card hidden |
| `ADDRESS` | "Our office" card on Contact | Card hidden |
| `SOCIALS` (`instagram`, `linkedin`, `x`, `youtube`, `tiktok`, `pinterest`) | The footer icon opens that page | Icon shows "coming soon" |
| `APP_URL` | Where Support, Privacy, Terms, License, "Help centre" and "Open the web app" go | Defaults to `https://faxton-rentals.web.app` |
| `RELEASES_REPO` | The public GitHub repository whose latest release holds the app files | Defaults to `musazaneerah4-crypto/Faxton-Rentals-Downloads` |
| `SITE_URL` | Used for the share link after joining the waitlist | The visitor's current address |
| `SITE_VERSION` | Shown in the footer | |

"Lagos, Nigeria" and the "Open the app Help centre" card on the Contact page are always shown.

## How the waitlist works

The form posts straight to Cloud Firestore (project `faxton-rentals`) over its REST API, using the app's public web key
(`assets/site-config.js`, the same key as `public/js/firebase.js` in the app; access is controlled by Firestore rules, not by hiding the key).
No SDK is loaded.

* **Waitlist**: `POST .../documents/waitlist?documentId=<id>` where `<id>` is the first 32 hex characters of
  SHA-256(lowercased, trimmed email). One address can only be on the list once. Fields: `name`, `email`, `role`
  (`renter|owner|agency|agent`), `city`, `source` (`website`), `createdAt`. HTTP 409 means "already on the list".
* **Contact form**: `POST .../documents/siteMessages` with `name`, `email`, `subject`
  (General question, Support, List my property, Press, Other), `message` (max 2000), `source`, `createdAt`.
* Nothing else is stored. Each form has a hidden honeypot field, the contact form allows one message per 30 seconds per browser,
  and if the request fails the visitor sees "We couldn't save that right now. Please try again or email us" (the site never crashes).
* The browser remembers only two small things in `localStorage` (that you joined; when you last sent a message). The "Your Privacy Choices"
  window explains this and can clear them.

**Where to see signups:** open the Faxton app as the owner/admin and go to **Admin console > Support > Waitlist**.
The Firestore rules that allow these two `create` requests (and nothing else) live in the app repository (`firestore.rules`).

## Publish it with GitHub Pages

Option A, from the branch (simplest): **Settings > Pages > Build and deployment > Source: Deploy from a branch > `main` / `/ (root)`**.

Option B, with the included workflow (`.github/workflows/pages.yml`): **Settings > Pages > Source: GitHub Actions**, then push to `main`.
The workflow runs the checks, copies the site (without `tests/`, `tools/`, `README.md`) and runs `tools/set-site-url.mjs`, which writes your real
address into the canonical links, share cards, JSON-LD, `sitemap.xml` and `robots.txt`.

All links inside the site are relative, so it works at `https://<user>.github.io/<repo>/` as well as at a custom domain.

### Use your own domain

1. Buy the domain (for example `faxtonrentals.com` or `.ng`) and make sure **you** are the registrar account owner.
2. **Settings > Pages > Custom domain**: type it, save, and add the DNS records GitHub shows (an `A`/`AAAA` set for the apex or a `CNAME` for `www`).
   Tick **Enforce HTTPS** once the certificate is ready.
3. Put the address in `SITE_URL` in `assets/site-config.js`.
4. If you publish from the branch (Option A), run once: `node tools/set-site-url.mjs https://yourdomain.com` and commit.
   (Option B does this for you on every deploy.)
5. In the app's Firebase console, nothing needs to change for the website (it only calls the Firestore REST API).
   Add the domain to **Authentication > Authorized domains** only if you later add sign-in here (this site has none).

### Security headers

Every page carries a strict Content-Security-Policy `<meta>` tag (scripts, styles, images and fonts from the site itself; connections only to
`firestore.googleapis.com` and `api.github.com`; no inline scripts or styles). `_headers` has the same policy plus `frame-ancestors`, HSTS and
caching rules for hosts that read that file (Netlify, Cloudflare Pages). GitHub Pages ignores `_headers`; the `<meta>` policy still applies.

## Tests and checks

```bash
node tests/waitlist.test.mjs     # id hashing, validation, Firestore request/response handling
node tests/download.test.mjs     # release parsing, device detection, caching
node tools/check-links.mjs       # every local link, image, icon, srcset, CSS url() and #anchor exists
```

Browser checks (optional; needs Playwright and a Chromium): `npm i -D playwright && node tests/browser.mjs`
(`CHROMIUM_PATH=/path/to/chrome` if it is not installed by Playwright). It mocks Firestore and GitHub, tests every page at 390/820/1440 px
(console errors, overflow, images, tap targets, contrast, menu, forms, download picker for every OS, page weight) and writes screenshots to `tests/out/`.

## The app downloads

`assets/js/download-core.js` and `download.js` are a plain-JavaScript port of the app's download picker. They read the latest release of
`RELEASES_REPO` through the GitHub API (cached for 15 minutes, with the last good answer used if GitHub is unreachable), match the files by the
same names the app uses (`Faxton-Rentals-Android.apk`, `...-Windows-x64.exe`, `...-Mac-arm64.dmg`, `...-Linux-x64.AppImage`, and so on, with a
safe pattern fallback), and show "Not available yet" for anything that is not in the release. iPhone gets the "Add to Home Screen" instructions.

## Pictures and screenshots

* `assets/img/hero/`: crops of the hero photo at the sizes each page needs.
* `assets/img/app/app-*.webp`: **real screenshots of the Faxton app** (390 x 844 at 2x) captured with Playwright against the app running
  with sample data, then shown inside a CSS phone frame. To refresh them, capture new screenshots at the same size and overwrite the files.
* `assets/img/app/*.webp` (photos), `os-*.webp`, `app-devices.webp`: copied from the app.
* `assets/logo/`: the FR mark and the wordmark lockup as SVG, in white, mint and brand green. `assets/icons/`: favicons and app icons from the app.
* `assets/og-image.jpg`: 1200 x 630 share card (hero photo + logo + headline).

## Still to be supplied by the owner

Support email, phone, WhatsApp, office address, social page addresses, the production domain, and the pricing for owners, agencies and agents
(the Billing page says pricing is announced before launch). Nothing on the site is invented: until a value is set, it is hidden.

## Licence and credits

Fonts: Figtree, Inter, Inter Tight and Caveat (SIL Open Font License), self-hosted. Photos and logo: Faxton Rentals.
