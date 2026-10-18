# BloomWell

BloomWell is a responsive cycle, nutrition, and everyday health tracker built with Next.js, React, TypeScript, and Tailwind CSS.

## Temporary local-only mode

This build opens directly to the existing dashboard. Login, signup, email verification, OTP, and Supabase browser access have been removed from the app entry point.

Health records are saved in this browser or installed app's `localStorage` on the current device. They do not sync to other phones, and public website access does not make records public: this build does not write personal health records to Supabase. The historical Supabase migrations and RLS policies remain in the repository unchanged. Clearing browser/app data or uninstalling BloomWell may permanently delete local records; use Profile → Export my data for a backup. Records are not encrypted at rest by this app; use a device protected by a screen lock and do not use a shared device for sensitive details.

The previous local key (`bloomwell-user-data-v1`) is read and merged into the new local key without deleting its old copy. Existing Supabase account data is not downloaded or migrated; no authentication bypass is used to access it.

Meal photos can be previewed locally, but automatic Gemini analysis is unavailable in this local-only build. Manual meal logging and typical-meal estimates remain available. The private Supabase migration creates a non-public Storage bucket and owner-scoped policies for future use; the present app has no health-file upload/download feature.

## Run locally

Requirements: Node.js 20.9+ and npm.

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>.

No Supabase, Gemini, or other app secret is needed. `.env.local` remains ignored by Git; do not place secrets in `NEXT_PUBLIC_*` variables or source control.

## Build the static web app

Next.js static export is configured in `next.config.mjs`; `npm run build` creates the self-contained site in `out/`. The server-side nutrition API route was removed because Next.js static export cannot package that route. Vercel can host the static export, but server-only photo analysis would require a separately deployed backend and is intentionally unavailable here.

## Android APK

Capacitor settings are in [`capacitor.config.ts`](./capacitor.config.ts):

- App name: `BloomWell`
- Application ID: `com.bloomwell.health`
- Web assets: `out/`
- No development-server URL is configured.

Install/build prerequisites:

- Node.js 20.9+ and npm
- Java JDK 21 (Capacitor 8 Android build requirement)
- Android SDK with platform/build tools installed and licensed

Set `ANDROID_HOME` to your Android SDK directory and ensure its `platform-tools` and `cmdline-tools/latest/bin` folders are available. Build commands from the project root:

```powershell
npm install
npm run lint
npx tsc --noEmit
npm test
npm run build
npx cap sync android
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
```

The debug APK is expected at `android\app\build\outputs\apk\debug\app-debug.apk`. Verify that file exists and is non-empty before sharing. For direct installation, transfer it to the Android phone, open it in Files, allow installation from that source when prompted, and tap Install. A debug build is for testing; a distributable long-term release should use a privately stored signing key.

Android's application data persists across app restarts. Uninstalling the app or clearing its storage deletes the local records. The current app does not have Android cloud backup or cross-device sync.

## Supabase safety

The private-account migrations are retained at `supabase/migrations/`. Do not apply public grants or disable RLS to support local mode. The local-only app intentionally does not initialize a Supabase client. When account sync is reintroduced, require authentication and verify database and Storage isolation with separate users before release. [`tests/rls-isolation.sql`](./tests/rls-isolation.sql) is a transaction-based manual Supabase SQL test; it has not been run against a remote project.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Unit tests include local storage load/save/migration behavior and assertions that the exported build has no auth UI, server API route, or public secret configuration. They do not replace testing on a physical Android device or a live Supabase RLS test.

## Health and privacy notice

BloomWell is a personal tracking aid, not a diagnosis or substitute for professional care. Cycle and nutrition values are estimates. Local records can be seen by anyone with access to the unlocked device. Review the in-app privacy notice and applicable legal requirements before public distribution.
