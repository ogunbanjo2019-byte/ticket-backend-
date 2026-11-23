# Ticketly production and Supabase setup

The code is ready for deployment but provider-side services must be configured in your own accounts. No email provider, CAPTCHA keys, or Supabase credentials were supplied, so none are embedded in the project.

## A. Supabase data and private files

1. Create a Supabase project. In **Project Settings → API**, copy the Project URL and browser-safe anon/publishable key.
2. Run `backend/supabase-schema.sql` in **SQL Editor**. It creates `purchased_tickets` with per-user row-level-security policies, adds update support, and creates a **private** `ticket-attachments` bucket limited to JPG/PNG/WebP/PDF files up to 8 MB. Storage policies only allow the signed-in owner’s UUID folder. Do not make the bucket public.
3. Edit `frontend/config.js` before deploying:

```js
window.TICKETLY_API_BASE_URL = 'https://YOUR-RENDER-SERVICE.onrender.com';
window.TICKETLY_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.TICKETLY_SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY';
window.TICKETLY_TURNSTILE_SITE_KEY = ''; // fill in only if CAPTCHA is enabled
```

Only the public anon/publishable key belongs in browser code. Never expose `service_role`/secret keys. The API base URL is the origin only (no `/api` and no trailing slash). Check an attachment by opening the short-lived signed URL while logged in; never distribute it. Users can edit metadata, upload/re-upload an attachment, and remove tickets; file type/size are checked in the UI and again by private bucket MIME/size limits. Barcode fields are sensitive and rendered masked.

## B. Email delivery and recovery

In Supabase **Authentication → URL Configuration**, set Site URL to the production Vercel origin. Add these exact redirect URLs (and local URLs only for development):

- `https://YOUR-VERCEL-DOMAIN/login.html?confirmed=1`
- `https://YOUR-VERCEL-DOMAIN/login.html?recovery=1`

For reliable production mail, choose an SMTP provider (for example, a transactional email vendor), verify your sending domain, configure its SPF/DKIM records, then enter the SMTP host, port, username, password, sender address, and sender name under Supabase **Authentication → SMTP Settings**. Enable custom SMTP and send a test message. Keep SMTP credentials only in Supabase/provider settings—never in this repository. Review confirmation and password recovery email templates, sender identity, deliverability, provider quotas, bounce handling, and support contact. Supabase’s default email sender is intended for testing and has limits; do not rely on it for production delivery.

## C. Signup bot protection and request limits

Optional Cloudflare Turnstile is wired into sign-up. Create a Turnstile widget restricted to your frontend domains; set its **site key** in `TICKETLY_TURNSTILE_SITE_KEY` before the Vercel build. In Supabase **Authentication → Bot and Abuse Protection/CAPTCHA**, enable CAPTCHA, choose Cloudflare Turnstile, and enter the widget **secret key** there. The secret key is private and must only be entered into Supabase. Verify signup on the deployed domain; sign-in remains available without solving the signup challenge. Leave the site key empty to disable the optional UI, but enable Supabase-side CAPTCHA/rate controls before public signup.

Supabase Auth enforces provider limits. Review **Authentication → Rate Limits** in the Supabase dashboard; set conservative limits for signup, sign-in, password-reset emails, and verification emails based on your expected user volume and plan. Alert on unusual auth errors and CAPTCHA failures. Do not claim client-side throttling protects an endpoint.

## D. Vercel frontend + Render backend

**Vercel:** import/deploy the `frontend/` directory as the project root, or deploy its contents. Set the three `window.TICKETLY_*` values in `config.js` before deployment (this is static browser config; Supabase anon key and Turnstile site key are public). Vercel environment variables alone do not automatically substitute into these plain static JS files. Deploy over HTTPS and ensure `/login.html`, `/account.html`, `/privacy.html`, and `/terms.html` are served as static files.

**Render:** create a Node web service with `backend/` as Root Directory, build command `npm install`, start command `npm start`, Node 18+, and health check path `/api/health`. Set `PORT` per Render runtime and `ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN` (comma-separated exact origins may include a preview host during testing). Add `TM_API_KEY` only if live event listings are needed. Never set wildcard origins for a production deployment.

Validate after deployment: `GET https://YOUR-RENDER-SERVICE.onrender.com/api/health` should return `{"ok":true,"service":"ticketly-api"}`. Browser DevTools Network should show successful OPTIONS/GET to `/api/live-events`, with CORS permitting the Vercel origin. Supabase Auth redirects must match Vercel URLs exactly.

## E. Monitoring and incident basics

Render emits structured JSON request logs with timestamp, request ID, method, route, status, and duration; 5xx errors are marked as errors. The API returns `X-Request-Id` so a failed response can be matched to a Render log. Logs intentionally omit email, barcode, auth headers, and request bodies. Use Render logs/metrics and configure a health-check alert; optionally monitor `/api/health` with your uptime tool and alert on sustained failures. Add an error tracking service only after choosing it and handling credentials/privacy appropriately. Review Supabase Auth/database/storage logs and usage for failures, quota pressure, rejected CAPTCHA, and unexpected access. Establish retention/access controls for logs and never log ticket files, passwords, access tokens, or full barcodes.

## F. Product, legal, and accessibility notes

The app clearly says users manually save ticket details purchased from official sellers; Ticketly does not sell, issue, or validate admission. Upload accepts private JPG/PNG/WebP/PDF, max 8 MB; users should not upload files they do not have rights to store. `privacy.html` and `terms.html` are product-specific starter copy, not legal advice. Customize operator identity, contact, jurisdiction, retention, deletion, third-party vendor, consumer rights, and cookie disclosures with qualified review before public launch. Account-deletion cleanup for Storage attachments should be added to your production user-deletion procedure.

Keyboard focus styling, skip-to-content on the discovery page, responsive layouts, labels, status announcements, semantic headings, and reduced-motion support are included. Before release, test keyboard-only flows, screen readers, mobile viewport layouts, color contrast, zoom, Supabase confirmation/recovery, and account isolation. Tickets and barcodes remain personal references: only the official issuer/venue can establish validity.
