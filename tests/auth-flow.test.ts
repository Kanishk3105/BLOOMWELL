import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_RESEND_COOLDOWN_SECONDS,
  getAuthCallbackError,
  getAuthErrorMessage,
  getAuthRedirectUrl,
  tryLockAuthRequest,
} from '../lib/auth-flow';

describe('Supabase email confirmation flow', () => {
  it('uses localhost by default and an explicit deployment origin when configured', () => {
    expect(getAuthRedirectUrl(undefined, 'http://localhost:3000')).toBe('http://localhost:3000');
    expect(getAuthRedirectUrl('https://bloomwell.example.com/', 'http://localhost:3000'))
      .toBe('https://bloomwell.example.com');
  });

  it('gives a recovery path for expired or already-used callback links', () => {
    expect(getAuthCallbackError('?error_code=otp_expired&error_description=Email+link+expired'))
      .toContain('Request a fresh email code');
    expect(getAuthCallbackError('?error=access_denied')).toContain('could not confirm');
    expect(getAuthCallbackError('')).toBeNull();
  });

  it('explains expired codes and rate limits without suggesting automatic retries', () => {
    expect(getAuthErrorMessage({ code: 'otp_expired', message: 'expired' })).toContain('already used');
    expect(getAuthErrorMessage({ message: 'email rate limit exceeded' })).toContain('No automatic retry');
  });

  it('uses a visible, conservative resend cooldown', () => {
    expect(CONFIRMATION_RESEND_COOLDOWN_SECONDS).toBe(60);
  });

  it('allows only one in-flight auth request until the caller releases its lock', () => {
    const lock = { current: false };
    expect(tryLockAuthRequest(lock)).toBe(true);
    expect(tryLockAuthRequest(lock)).toBe(false);
    lock.current = false;
    expect(tryLockAuthRequest(lock)).toBe(true);
  });
});
