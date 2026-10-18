import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy notice · BloomWell',
  description: 'How the BloomWell prototype handles account and health-tracking data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8fb,_#f8f4ff_38%,_#f5f7ff_100%)] px-4 py-10 text-slate-800 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-[32px] border border-white bg-white/90 p-6 shadow-[0_24px_70px_rgba(118,95,146,0.14)] sm:p-10">
        <Link href="/" className="text-sm font-medium text-violet-700 underline underline-offset-4">Back to BloomWell</Link>
        <p className="mt-8 text-xs uppercase tracking-[0.2em] text-violet-600">Privacy</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Privacy notice</h1>
        <p className="mt-3 text-sm text-slate-500">Prototype notice · 18 October 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Before you use the app</h2>
            <p>
              BloomWell can contain sensitive health details. This notice describes the intended handling in this prototype; it is not legal advice and is not a claim of regulatory compliance. The app owner must publish a reviewed privacy policy, retention rules, contact details, and lawful processing basis before inviting real users.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Account and health records</h2>
            <p>
              This temporary no-login version stores profile, cycle, meal, and reminder records only in the browser or installed app&apos;s local storage on this device. The application does not send these health records to Supabase, and they do not synchronize between devices.
            </p>
            <p className="mt-2">
              Anyone who can use this device or its unlocked app profile may be able to view the local records. Clearing browser/site data or uninstalling the app can permanently erase them. Export a backup if you need to keep a copy. The app owner cannot restore device-local records.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Meal photos</h2>
            <p>Photo preview is local to the device. Automatic photo analysis is unavailable in this local-only build. Manual food logging and typical-meal estimates remain available.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Your choices and limitations</h2>
            <p>
              You can export records from your profile and request account deletion from the account controls. Deletion of backups may follow the provider&apos;s retention schedule. Cycle forecasts and nutrition values are estimates, not medical advice or verified measurements. Do not rely on BloomWell for diagnosis, treatment, contraception, or emergencies.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">India and launch readiness</h2>
            <p>
              Before public release in India or elsewhere, the app owner must review applicable privacy and consumer-protection requirements, confirm age eligibility and consent flows, prepare a grievance/contact channel and incident response, and obtain qualified legal and security review. This prototype is not certified as compliant with India&apos;s DPDP Act or any health-data regulation.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
