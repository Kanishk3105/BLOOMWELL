'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  CONFIRMATION_RESEND_COOLDOWN_SECONDS,
  getAuthCallbackError,
  getAuthErrorMessage,
  getAuthRedirectUrl,
  tryLockAuthRequest,
} from '@/lib/auth-flow';

export type AuthenticatedAccount = {
  userId: string;
  email: string;
  supabase: SupabaseClient;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

type AuthGateProps = {
  children: (account: AuthenticatedAccount) => ReactNode;
};

type AuthMode = 'sign-in' | 'sign-up';

function getAccount(user: User | null) {
  return user ? { userId: user.id, email: user.email ?? '' } : null;
}

export function AuthGate({ children }: AuthGateProps) {
  const [supabase] = useState(getSupabaseBrowserClient);
  const [account, setAccount] = useState<ReturnType<typeof getAccount>>(null);
  const [loading, setLoading] = useState(() => Boolean(getSupabaseBrowserClient()));
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cloudConsent, setCloudConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(getAccount(session?.user ?? null));
      setLoading(false);
      setError('');
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError(`Could not restore your sign-in: ${sessionError.message}`);
      }
      setAccount(getAccount(data.session?.user ?? null));
      setLoading(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const callbackError = getAuthCallbackError(window.location.search);
    if (!callbackError) return;

    const callbackEmail = new URLSearchParams(window.location.search).get('email')?.trim() ?? '';
    const timer = window.setTimeout(() => {
      setPendingConfirmationEmail(callbackEmail);
      setConfirmationPending(true);
      setMode('sign-up');
      setError(callbackError);
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('error_code');
      url.searchParams.delete('error_description');
      window.history.replaceState(window.history.state, '', url);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !tryLockAuthRequest(requestInFlight)) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'sign-up') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(process.env.NEXT_PUBLIC_SITE_URL, window.location.origin),
          },
        });
        if (authError) {
          if (/rate.?limit|too many requests|over_email_send_rate_limit|email_rate_limit_exceeded/i.test(`${authError.code ?? ''} ${authError.message}`) || authError.status === 429) {
            setPendingConfirmationEmail(email.trim());
            setConfirmationPending(true);
            setResendCooldown(CONFIRMATION_RESEND_COOLDOWN_SECONDS);
          }
          throw authError;
        }
        if (data.session) {
          setAccount(getAccount(data.session.user));
        } else {
          setPendingConfirmationEmail(email.trim());
          setConfirmationPending(true);
          setVerificationCode('');
          setResendCooldown(CONFIRMATION_RESEND_COOLDOWN_SECONDS);
          setPassword('');
          setNotice('We sent a confirmation code if this address can be registered. Enter the code from the latest BloomWell email to verify your account.');
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        setAccount(getAccount(data.user));
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError instanceof Error ? authError : {}));
    } finally {
      setBusy(false);
      requestInFlight.current = false;
    }
  };

  const submitVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !pendingConfirmationEmail || !tryLockAuthRequest(requestInFlight)) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const { data, error: verificationError } = await supabase.auth.verifyOtp({
        email: pendingConfirmationEmail,
        token: verificationCode.trim(),
        type: 'signup',
      });
      if (verificationError) throw verificationError;
      setConfirmationPending(false);
      setPendingConfirmationEmail('');
      setVerificationCode('');
      setResendCooldown(0);
      setAccount(getAccount(data.user));
      setNotice('Email confirmed. Your account is ready.');
    } catch (authError) {
      setError(getAuthErrorMessage(authError instanceof Error ? authError : {}));
    } finally {
      setBusy(false);
      requestInFlight.current = false;
    }
  };

  const resendConfirmation = async () => {
    if (!supabase || !pendingConfirmationEmail || resendCooldown > 0 || !tryLockAuthRequest(requestInFlight)) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmationEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl(process.env.NEXT_PUBLIC_SITE_URL, window.location.origin),
        },
      });
      if (resendError) throw resendError;
      setResendCooldown(CONFIRMATION_RESEND_COOLDOWN_SECONDS);
      setVerificationCode('');
      setNotice('A new confirmation code was requested. Use the newest email only; older codes may no longer work.');
    } catch (authError) {
      const message = getAuthErrorMessage(authError instanceof Error ? authError : {});
      setError(message);
      if (/rate-limited|limited confirmation emails/i.test(message)) {
        setResendCooldown(CONFIRMATION_RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setBusy(false);
      requestInFlight.current = false;
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  };

  const deleteAccountFromAuth = async () => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.rpc('delete_my_bloomwell_account');
    if (deleteError) throw deleteError;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff8fb,_#f8f4ff_38%,_#f5f7ff_100%)] p-5">
        <p role="status" className="rounded-2xl bg-white/80 px-5 py-4 text-sm text-slate-600 shadow-sm">
          Checking your secure BloomWell account…
        </p>
      </main>
    );
  }

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff8fb,_#f8f4ff_38%,_#f5f7ff_100%)] p-5">
        <section className="w-full max-w-xl rounded-[32px] border border-white bg-white/90 p-7 shadow-[0_24px_70px_rgba(118,95,146,0.14)] sm:p-9">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-300 text-xl font-bold text-white">B</div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-600">BloomWell</p>
              <h1 className="text-xl font-semibold text-slate-900">Secure account setup needed</h1>
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            BloomWell now requires a private account before showing health records. The Supabase connection is not configured on this deployment, so no health data is loaded or saved.
          </p>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="font-medium text-slate-800">The app owner must configure these environment variables:</p>
            <code className="mt-2 block break-all text-sm text-violet-800">NEXT_PUBLIC_SUPABASE_URL</code>
            <code className="mt-1 block break-all text-sm text-violet-800">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Never put a Supabase secret/service-role key in these public variables. Finish the database setup and review the privacy notice before inviting people.
          </p>
          <Link href="/privacy" className="mt-5 inline-flex font-medium text-violet-700 underline underline-offset-4">Read the privacy notice</Link>
        </section>
      </main>
    );
  }

  if (account) {
    return <>{children({ ...account, supabase, signOut, deleteAccount: deleteAccountFromAuth })}</>;
  }

  if (confirmationPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff8fb,_#f8f4ff_38%,_#f5f7ff_100%)] p-4 sm:p-6">
        <section className="w-full max-w-md rounded-[32px] border border-white bg-white/90 p-6 shadow-[0_24px_70px_rgba(118,95,146,0.14)] backdrop-blur-xl sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-600">BloomWell email verification</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Confirm your email</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {pendingConfirmationEmail
              ? <>Enter the one-time code sent to <strong className="break-all">{pendingConfirmationEmail}</strong>. Use the newest message and submit its code once. You can return to sign in after verification.</>
              : 'This confirmation link may have expired or already been used. Enter the account email below to request a fresh code. A valid code is still required to verify your account.'}
          </p>

          <form onSubmit={submitVerification} className="mt-6 space-y-4">
            {!pendingConfirmationEmail ? (
              <label className="block text-sm font-medium text-slate-700">
                Account email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={pendingConfirmationEmail}
                  onChange={(event) => setPendingConfirmationEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-violet-400 focus:bg-white"
                />
              </label>
            ) : null}
            {pendingConfirmationEmail ? (
              <label className="block text-sm font-medium text-slate-700">
                Email confirmation code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,8}"
                  minLength={6}
                  maxLength={8}
                  required
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg tracking-[0.3em] text-slate-800 outline-none focus:border-violet-400 focus:bg-white"
                />
              </label>
            ) : null}
            {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
            {notice ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}
            <button
              type="submit"
              disabled={busy || !pendingConfirmationEmail || verificationCode.trim().length < 6}
              className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-600">
            {resendCooldown > 0 ? (
              <p role="status">You can request another code in {resendCooldown}s. Check your inbox and spam folder first.</p>
            ) : (
              <button
                type="button"
                onClick={() => void resendConfirmation()}
                disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingConfirmationEmail)}
                className="font-medium text-violet-700 underline underline-offset-4 disabled:opacity-60"
              >
                {busy ? 'Requesting…' : 'Resend confirmation code'}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmationPending(false);
              setPendingConfirmationEmail('');
              setVerificationCode('');
              setError('');
              setNotice('');
              setMode('sign-in');
            }}
            className="mt-5 text-sm font-medium text-slate-500 underline underline-offset-4"
          >
            Back to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff8fb,_#f8f4ff_38%,_#f5f7ff_100%)] p-4 sm:p-6">
      <section className="w-full max-w-md rounded-[32px] border border-white bg-white/90 p-6 shadow-[0_24px_70px_rgba(118,95,146,0.14)] backdrop-blur-xl sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-300 text-xl font-bold text-white">B</div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-600">BloomWell</p>
            <h1 className="text-xl font-semibold text-slate-900">Your health space</h1>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
          {(['sign-in', 'sign-up'] as const).map((authMode) => (
            <button
              key={authMode}
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(authMode);
                setError('');
                setNotice('');
              }}
              className={`rounded-full px-3 py-2 text-sm font-medium ${mode === authMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {authMode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <h2 className="text-2xl font-semibold text-slate-900">
          {mode === 'sign-in' ? 'Welcome back' : 'Create your private account'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your records are connected to your account. Sign in only on a device you trust.
        </p>

        <form onSubmit={submitAuth} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-violet-400 focus:bg-white"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-violet-400 focus:bg-white"
            />
          </label>

          {mode === 'sign-up' ? (
            <label className="flex items-start gap-2 rounded-2xl bg-violet-50/70 p-3 text-xs leading-5 text-slate-700">
              <input
                type="checkbox"
                required
                checked={cloudConsent}
                onChange={(event) => setCloudConsent(event.target.checked)}
                disabled={busy}
                className="mt-1 accent-violet-600"
              />
              <span>
                I understand my BloomWell records will be stored in the app owner&apos;s Supabase project and linked to this account. I have read the{' '}
                <Link href="/privacy" target="_blank" className="font-medium text-violet-700 underline">privacy notice</Link>.
              </span>
            </label>
          ) : null}

          {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
          {notice ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

          <button
            type="submit"
            disabled={busy || (mode === 'sign-up' && !cloudConsent)}
            className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in securely' : 'Create account'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          BloomWell provides tracking tools, not medical advice. Cycle and nutrition estimates are not diagnoses or verified measurements.
        </p>
      </section>
    </main>
  );
}
