export const CONFIRMATION_RESEND_COOLDOWN_SECONDS = 60;

type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

type RequestLock = { current: boolean };

export function tryLockAuthRequest(lock: RequestLock) {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function getAuthRedirectUrl(configuredSiteUrl: string | undefined, currentOrigin: string) {
  const configuredUrl = configuredSiteUrl?.trim();
  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : currentOrigin;
}

export function getAuthCallbackError(search: string) {
  const params = new URLSearchParams(search);
  const code = `${params.get('error_code') ?? ''} ${params.get('error') ?? ''}`.toLowerCase();
  const description = (params.get('error_description') ?? '').toLowerCase();

  if (!code.trim() && !description.trim()) return null;

  if (/otp_expired|expired|already.?used|invalid.?otp|invalid.?token/.test(`${code} ${description}`)) {
    return 'This confirmation link has expired, is invalid, or was already used. Request a fresh email code below; do not reopen the old link.';
  }

  return 'BloomWell could not confirm that email link. Request a fresh email code below or return to sign in if your email is already confirmed.';
}

export function getAuthErrorMessage(error: AuthErrorLike) {
  const details = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();

  if (/otp_expired|expired|already.?used|invalid.?otp|invalid.?token/.test(details)) {
    return 'That confirmation code is expired, invalid, or already used. Request a fresh code and enter it once.';
  }

  if (/rate.?limit|too many requests|over_email_send_rate_limit|email_rate_limit_exceeded/.test(details) || error.status === 429) {
    return 'Supabase temporarily limited confirmation emails. No automatic retry was sent. Wait for the cooldown, check your inbox and spam folder, then request one new code. If this continues, the project owner should review Supabase SMTP and email-provider limits.';
  }

  if (/already registered|user already exists/.test(details)) {
    return 'An account may already exist for this email. Try signing in instead; confirmation is still required for new accounts.';
  }

  return error.message || 'Could not complete this account request. Please try again.';
}
