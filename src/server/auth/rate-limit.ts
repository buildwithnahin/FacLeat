import 'server-only';

/**
 * In-process login attempt limiter, shared by the web Credentials provider
 * and the mobile login endpoint. Purely in-memory — resets on process
 * restart and isn't shared across instances, same tradeoff the web login
 * already accepted.
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function assertLoginAllowed(email: string) {
  const key = email.toLowerCase();
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || state.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  if (state.count >= LOGIN_MAX_ATTEMPTS) {
    throw new Error('Too many login attempts. Try again later.');
  }
}

export function recordLoginFailure(email: string) {
  const key = email.toLowerCase();
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || state.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  state.count += 1;
}

export function clearLoginFailures(email: string) {
  loginAttempts.delete(email.toLowerCase());
}
