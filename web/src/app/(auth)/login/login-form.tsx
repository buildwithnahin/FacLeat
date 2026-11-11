'use client';

import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAction, type LoginState } from '@/server/actions/auth';
import { QUICK_LOGIN_ROLES } from '@/lib/quick-login-accounts';

// Pixel rectangles measured against the /public/login-background.jpg design
// reference (1536x1024) — see login page's BG_WIDTH/BG_HEIGHT. Converted to
// percentages so every overlay element stays aligned with the image at any
// rendered size.
const BG_WIDTH = 1536;
const BG_HEIGHT = 1024;

function rectStyle(x0: number, y0: number, x1: number, y1: number): React.CSSProperties {
  return {
    left: `${(x0 / BG_WIDTH) * 100}%`,
    top: `${(y0 / BG_HEIGHT) * 100}%`,
    width: `${((x1 - x0) / BG_WIDTH) * 100}%`,
    height: `${((y1 - y0) / BG_HEIGHT) * 100}%`,
  };
}

// Left edge starts at 1113 (not 1145) — the baked-in placeholder text in the
// background image actually starts at x=1123 (measured directly from the
// source image's pixels), so anything short of that leaves a sliver of the
// underlying "admin@annex.local" / dots visible under our real input.
const EMAIL_RECT = rectStyle(1113, 305, 1440, 335);
const PASSWORD_RECT = rectStyle(1113, 385, 1390, 415);
const EYE_TOGGLE_RECT = rectStyle(1418, 391, 1446, 413);
const FORGOT_PASSWORD_RECT = rectStyle(1340, 440, 1456, 458);
const SUBMIT_RECT = rectStyle(1085, 475, 1450, 522);
const QUICK_LOGIN_RECT = rectStyle(1085, 533, 1450, 662);

// Cosmetic only — shown in the password field so quick-login visibly "fills
// in" both fields like a real autofill. It is never sent anywhere: the
// actual quick-login request only carries the roleKey (see submitQuickLogin
// below and quick-login-accounts.ts) — the real password is resolved and
// checked entirely server-side and never reaches this client.
const QUICK_LOGIN_DISPLAY_PASSWORD = '••••••••••';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);

  // Purely cosmetic — fills the visible fields so quick-login looks like a
  // real autofill. The actual submission carries the role via the clicked
  // button's own name="quickRole" value={role.key} (native HTML submit
  // button behavior below), never via these field values or any JS-timed
  // step — so there's no race between "did the field update land before
  // submit" the way there was with the earlier ref+requestAnimationFrame
  // approach (which is exactly what caused it to submit the stale empty
  // quickRole on a fast first click and fall through to the real
  // email/password path with the fake display password).
  function fillQuickLoginPreview(email: string) {
    setEmailValue(email);
    setPasswordValue(QUICK_LOGIN_DISPLAY_PASSWORD);
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        aria-label="Email Address"
        disabled={pending}
        value={emailValue}
        onChange={(e) => setEmailValue(e.target.value)}
        className="absolute rounded border-0 bg-white text-[1.1vw] text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
        style={EMAIL_RECT}
      />

      <input
        id="password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        required
        placeholder="••••••••"
        aria-label="Password"
        disabled={pending}
        value={passwordValue}
        onChange={(e) => setPasswordValue(e.target.value)}
        className="absolute rounded border-0 bg-white text-[1.1vw] text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
        style={PASSWORD_RECT}
      />

      <button
        type="button"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        aria-pressed={showPassword}
        onClick={() => setShowPassword((v) => !v)}
        className="absolute"
        style={EYE_TOGGLE_RECT}
      />

      <div className="absolute" style={FORGOT_PASSWORD_RECT}>
        <button
          type="button"
          aria-label="Forgot password"
          onClick={() => setShowForgotHint((v) => !v)}
          className="h-full w-full"
        />
        {showForgotHint && (
          <p
            role="status"
            className="absolute right-0 top-full z-10 mt-1 w-[16vw] rounded-md border border-slate-200 bg-white p-2 text-[0.75vw] text-slate-600 shadow-lg"
          >
            Please contact your system administrator to reset your password.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-label="Sign in"
        className="absolute rounded-lg bg-[#083366] text-[1.15vw] font-semibold text-white transition-colors hover:bg-[#0a3f7a] disabled:opacity-70"
        style={SUBMIT_RECT}
      >
        {pending ? 'Signing in…' : 'Sign in →'}
      </button>

      {/* The error message and the quick-login grid occupy the same space
          by design (there's no free room left in the card below the Sign In
          button) — they're mutually exclusive, never both shown at once, so
          there's no overlap. Previously the error rendered as transparent
          text floating on top of the (still fully clickable) "Super Admin"
          button, which is exactly what looked like a broken first tap. */}
      {state?.error ? (
        <div
          className="absolute flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-[0.6vw] text-center"
          style={QUICK_LOGIN_RECT}
        >
          <p role="alert" className="text-[0.85vw] font-medium text-red-600">
            {state.error}
          </p>
        </div>
      ) : (
        <div
          className="absolute grid grid-cols-3 content-start gap-[0.5%]"
          style={QUICK_LOGIN_RECT}
          aria-label="Quick login"
        >
          {QUICK_LOGIN_ROLES.map((role) => (
            <button
              key={role.key}
              type="submit"
              name="quickRole"
              value={role.key}
              disabled={pending}
              onClick={() => fillQuickLoginPreview(role.email)}
              className="truncate rounded-md border border-slate-200 bg-slate-50 px-[0.4vw] py-[0.45vw] text-[0.78vw] font-medium text-slate-700 transition-colors hover:border-[#083366] hover:bg-[#083366]/5 hover:text-[#083366] disabled:opacity-50"
            >
              {role.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
