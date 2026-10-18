# BloomWell

**A calm, personal space for cycle, nutrition, and everyday health tracking.**

BloomWell is a responsive Next.js app where people enter and review their own health details. It avoids a fabricated demo profile, labels predictions and nutrition as estimates, and keeps meal-photo analysis opt-in.

> **Current status:** BloomWell supports a public website with a private account gate; health records require authentication and are intended to be scoped to the signed-in account. The RLS policies, private Storage bucket setup, and two-user SQL isolation test are included. This does **not** mean the production deployment is configured or that a live two-user isolation test has passed. Do not invite users until migrations, redirects, email delivery, production credentials, and the manual isolation test below have been verified.

## At a glance

| Area | What works today |
| --- | --- |
| Today | Personal dashboard, cycle forecast with 15d, 30d, 90d, and 1y ranges, and today’s logged nutrition |
| Cycle | User-entered period and symptom logs, observed cycle lengths, and estimated next-period date |
| Nutrition | Manual meal logging, editable typical-meal estimates, daily totals, and an optional meal-photo analysis flow |
| Insights | Small observations derived from the profile and logs; no invented history |
| Health | User-managed conditions and clinician notes |
| Reminders | In-app reminder preferences synced to the signed-in account (not scheduled notifications) |
| Profile | Editable personal details, cycle settings, and measurements |

## Product and UX principles

- **Start with the person’s data.** Empty states ask for information rather than pretending a profile or history exists.
- **Keep estimates honest.** Cycle dates are projections; photo-derived calories and macros are approximate and editable.
- **Make consent explicit.** A photo stays in the browser preview until the user agrees to send it to Google and starts analysis.
- **Design for everyday screens.** The interface uses a responsive layout, touch-friendly controls, and a mobile bottom navigation.
- **Respect accessibility preferences.** The stylesheet includes reduced-motion support; a complete WCAG audit is still outstanding.
- **Support informed use.** BloomWell is a tracking aid, not a diagnostic tool or a substitute for professional care.

## Run locally

Requirements: Node.js 20.9+ and npm. Vercel's Next.js preset can build this project without a custom `vercel.json`.

```powershell
npm install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Add the Supabase project URL and publishable key to .env.local.
npm run dev
```

Open <http://localhost:3000>.

The public site can be visited without an account, but the account gate will not show health records unless Supabase is configured and the visitor signs in. Missing configuration shows an explicit setup notice; it never falls back to shared or demo health data.

### Configure Supabase (required for sign-in)

1. Create a Supabase project. Choose the closest suitable database region for the intended users; confirm data residency and provider terms before collecting health details.
2. In the Supabase SQL editor, run both migrations in order:
   - [`20261018000000_create_bloomwell_user_data.sql`](./supabase/migrations/20261018000000_create_bloomwell_user_data.sql)
   - [`20261018000100_lock_down_user_data_storage.sql`](./supabase/migrations/20261018000100_lock_down_user_data_storage.sql)

   These create the per-user health row, authenticated-only row-level policies and RPCs, and a **private** `bloomwell-private` Storage bucket. Storage object access is allowed only for authenticated owners whose first object-path folder is their own user UUID. The bucket accepts JPEG, PNG, WebP, and PDF files up to 8 MB. Do not change the bucket to public.
3. In Supabase Authentication settings, keep email confirmation enabled.
4. Copy the Supabase **Project URL** and **publishable key** into `.env.local` locally and set the same values in Vercel's Production environment (and Preview only if preview testing is intended):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   The publishable key is designed for browser use only when row-level security is correctly enabled. Never place a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable or in this repository.
5. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` locally. In Vercel, set it to the exact production HTTPS origin, for example `https://bloomwell.example.com`. In **Supabase → Authentication → URL Configuration**, set **Site URL** to that production origin and allow `http://localhost:3000/**` plus the exact production origin path pattern under **Redirect URLs**. Add Vercel preview URLs only if you intend to test signup there. Restart local Next.js after changing variables and redeploy after changing Vercel variables.
6. In **Authentication → Email Templates → Confirm signup**, include the one-time code using `{{ .Token }}` (for example, “Your BloomWell confirmation code is {{ .Token }}”). The app asks users to enter this code; a link-only template using `{{ .ConfirmationURL }}` will not provide the code-entry flow. Keep email confirmation enabled.
7. Create an account, then enter the code from the newest confirmation email. Resend is available after the visible cooldown. If an older confirmation link returns `otp_expired`, use the recovery screen to request a fresh code and verify once.
8. Existing local-only records are **not uploaded automatically**. While signed in, use **Review and import** to review and explicitly upload this device’s old records.

BloomWell saves account records in a single JSONB row protected by database RLS. Writes use a user-scoped RPC with a revision check to detect conflicting edits from multiple devices instead of silently overwriting the newer row. On a conflict, the app offers a backup and sign-out/reload path. The signed-in account can download a JSON export or request deletion of its auth account and linked row. Review backups/retention, configure production email delivery, test account isolation/deletion, and complete privacy/security reviews before real-user launch.

The application currently does not persist meal photos or health-report files. Meal photos selected for analysis are sent only to the authenticated server endpoint and then to Gemini after consent. The private bucket migration establishes owner-only storage authorization for future file features; do not add upload/download UI until it uses authenticated Supabase Storage requests and this bucket's owner-path policy. Never use public buckets or public object URLs for health files.

### Verify row isolation before launch

After applying both migrations, run [`tests/rls-isolation.sql`](./tests/rls-isolation.sql) in the Supabase SQL editor using the project owner SQL editor. It runs in a transaction and rolls back its two synthetic users and records. A successful run checks that User A cannot select, insert for, update, or delete User B's record while owner operations remain usable. The SQL test has not been run against the configured project from this workspace.

This repo has no additional app-owned public tables beyond `public.bloomwell_user_data`; Supabase's `auth` and `storage` schemas are provider-managed. Re-audit new tables and buckets whenever adding personal data.

## Deploy to Vercel

1. Import the repository into Vercel and use its detected Next.js framework/build defaults (`npm run build`). Use Node.js 20.9 or newer.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` to Vercel's Production environment. Add `GEMINI_API_KEY` only as a server-side environment variable if photo analysis is enabled. Never add a Supabase secret/service-role key to any `NEXT_PUBLIC_*` variable.
3. Add the production URL to Supabase Auth's redirect allow-list, apply both migrations, and redeploy after environment changes.
4. Confirm security response headers on the HTTPS deployment, then complete the two-user isolation and signup checklist before inviting real users. Preview deployments should use non-production test data and separately allow-listed URLs.

Useful checks:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Run the automated checks with `npm test`. Unit tests cover stored-data validation and assert the RLS/private-storage policy definitions. The separate SQL isolation test below is the database-level check and must be run in the target Supabase project.

## Optional meal-photo analysis

The app can preview a JPEG, PNG, or WebP photo (up to 8 MB) and request an estimate through a server-side Gemini route. It requires a Google Gemini API key:

1. Copy `.env.example` to `.env.local`.
2. Set `GEMINI_API_KEY` in `.env.local`.
3. Restart the app.

Keep the key server-side. Never use a `NEXT_PUBLIC_` prefix or commit `.env.local`.

The user must explicitly consent before a photo is sent. Google’s data handling can depend on the API billing status and applicable terms; unpaid Gemini usage may allow submitted content to be used to improve services and reviewed by people. The app does not detect billing status. Do not upload sensitive, confidential, or personal information. Read [Google’s Gemini API terms](https://ai.google.dev/gemini-api/terms) before enabling this feature for users.

Photo results are estimates—not verified nutrition facts. The route validates files, verifies the signed-in Supabase account, and applies an in-memory per-account request limit. The limit is not durable or sufficient abuse protection for a public paid endpoint.

More setup and privacy details: [docs/nutrition-photo-analysis.md](./docs/nutrition-photo-analysis.md).

## Data and privacy status

- User-entered profile, cycle, meal, and reminder data are designed to sync to an account-owned Supabase row under RLS. Local Supabase credentials are present, but signup, verified-email access, database migration, RLS isolation, and persistence still require a controlled live test.
- The private Storage bucket and owner-path policies are defined in a migration; no report or meal-image files are persisted by the current UI.
- The old local-storage format is kept on the device until a signed-in user explicitly approves import. New account records are not silently merged across users.
- Export and account-delete actions are implemented; confirm provider backup-retention behavior and run the SQL migration before enabling them in a deployed app.
- Browser storage still holds the Supabase sign-in session. Sign out on shared devices. Do not promise confidentiality, legal compliance, or medical-grade storage without appropriate independent review.
- Meal photos are previewed locally and sent to Google only after consent and an explicit analysis action; BloomWell does not save the uploaded image to the profile.

Read the in-app [privacy notice](./app/privacy/page.tsx) as a prototype disclosure, not legal advice or a compliance certification. The app owner must review applicable Indian DPDP and other privacy requirements, data region, age eligibility, incident response, retention, contact/grievance process, and provider terms before real users.

## Validation status

The latest code checks for the current changes:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm test` (12 tests passed)
- `npm audit --omit=dev` (no production dependency vulnerabilities reported)
- Full `npm audit` still reports five high-severity advisories in the development-only Next.js ESLint dependency chain (`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). There is no compatible non-breaking audit fix reported; the suggested fix downgrades the Next ESLint configuration to Next 14, so it was not applied to this Next 16 app.
- Built-app smoke checks: home and privacy return 200; earlier no-config checks showed photo-analysis status `available: false` and empty upload rejection.
- Browser smoke check: the no-config setup screen clearly blocks health records, links the privacy notice, has no horizontal overflow at mobile width, and emitted no browser console errors.
- Auth browser check against the current configured production build: sign-in and create-account screens render; signup remains disabled until consent; simulated `otp_expired` callback opens the recovery form and removes stale error query parameters. The resend control activates after a syntactically valid email is entered. No signup or resend was submitted.

One read-only request to the configured Supabase Auth settings endpoint succeeded: email provider enabled, automatic email confirmation disabled, and signup not disabled. Supabase redirect allow-list and email template were not inspected. A live sign-up, OTP confirmation, sign-in, RLS isolation, import/export/delete, and cross-device sync were **not** executed; no test email was sent. A successful live Gemini response has **not** been verified. Checks do not replace automated end-to-end tests, real-user testing, or an accessibility audit.

## Next steps

### Needed before a real-user launch

1. **Finish Supabase setup.** Confirm the project’s **Redirect URLs** include `http://localhost:3000/**` and the deployed HTTPS origin, update `NEXT_PUBLIC_SITE_URL` for production, run both SQL migrations, and configure the Confirm signup email template to include `{{ .Token }}` while keeping email confirmation enabled. Review SMTP/provider limits; do not blindly increase rate limits.
2. **Verify the live account journey once with a controlled test inbox.** Create one test account, confirm using the newest code, sign in, and then test expired-code recovery without repeatedly requesting emails. Also test sign-out, row isolation, account deletion, and data sync/conflicts on two devices.
3. **Configure Gemini privately.** Add a rotated server-only key in local/Vercel settings (never chat or source); review API billing terms and test success, rejection, timeout, rate limiting, and missing-key UI.
4. **Run the RLS isolation SQL test** in the target Supabase SQL editor and retain the successful result before enabling public registration. Test storage authorization with two authenticated accounts before shipping any file-upload feature.
5. **Make reminders real—or keep them clearly labeled.** Current toggles sync preferences; they do not schedule Android notifications or email.
6. **Finish privacy, security, and accessibility review.** Review requirements for India and target regions, storage region, retention, incident response, WCAG, screen readers, contrast, keyboard, and mobile UX. Resolve the reported development-only ESLint advisories when a compatible patched release is available.
7. **Only then prepare a direct-share APK.** Deploy to a stable HTTPS domain, test the hosted app on a physical Android device, configure Capacitor to that URL, create and privately back up a signing key, build/sign the release APK, then install and test it before sharing. The APK must not embed Gemini or Supabase secret keys.

### Useful follow-ups

- Add user-controlled data export/import and a clear local-data reset.
- Validate profile and cycle inputs, including invalid dates and unusual cycle lengths.
- Add a trustworthy cycle-history view once enough user-entered history exists.
- Decide whether health measurements such as pulse oximetry belong in scope; if added, follow current FDA guidance and explain device limitations.

## Android APK status

An APK has **not** been scaffolded or built. The requested distribution is a directly shareable signed APK, not a Play Store submission. It must load the hosted BloomWell site so Supabase authentication and the Gemini server route remain available; a wrapper pointed at `localhost` would only work on the developer’s own machine. First configure and verify Supabase, Gemini (if enabled), a stable HTTPS production URL, privacy disclosures, and real-device behavior. Then package with Capacitor and sign the release. Keep the Android signing keystore and passwords out of Git and chat.

## Continuation prompt

Copy this prompt into a future coding session to continue the work:

> Continue building BloomWell in `C:\BLOOMWELL`. First inspect the current code and README. The UI has Today, Cycle, Nutrition, Insights, Health, Reminders, and Profile. It now has a Supabase email/password account gate, per-user JSONB storage with RLS migration, explicit import of legacy local records, export, and account deletion. Those flows have not been tested against a real Supabase project yet. Setup requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and running `supabase/migrations/20261018000000_create_bloomwell_user_data.sql`. Never request secrets in chat; do not expose Supabase service-role or Gemini keys. Gemini photo analysis remains opt-in and needs a server-only `GEMINI_API_KEY`; explain Google's unpaid-service terms before consent. Cycle/nutrition outputs are estimates, not medical facts.
>
> **Before APK:** user requested a directly installable/shareable Android APK but explicitly said to verify the app and make it presentable first. Do NOT build the APK until the owner has configured and verified Supabase account isolation/sync, Gemini if enabled, deployed a stable HTTPS URL, and tested on a physical Android device. Then add Capacitor pointed to the deployed URL, create a private signing key, build and sign a release APK, and test install/update/data isolation on multiple phones. Never embed secrets or the keystore in the app/repository.
>
> Test real Supabase/Gemini only with credentials configured locally, never pasted to chat. Add automated tests for auth, row isolation, data migration/export/deletion, estimates, and API handling; improve reminders; complete WCAG and India-specific privacy/security/legal review. Update this README and report verification gaps honestly; do not claim production readiness until they are closed.
