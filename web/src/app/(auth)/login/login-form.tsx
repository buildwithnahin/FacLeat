'use client';

import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { loginAction, type LoginState } from '@/server/actions/auth';
import { QUICK_LOGIN_ROLES } from '@/lib/quick-login-accounts';

// Design-reference pixel size of /public/login-background.jpg (1536x1024).
// Every overlay element is positioned as a percentage of these dimensions
// so it stays perfectly aligned with the card at any viewport size.
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

// Cleanly covers the full input card areas in /public/login-background.jpg
// to replace static raster mockups with real, accessible, interactive controls.
const EMAIL_RECT = rectStyle(1076, 291, 1454, 337);
const PASSWORD_RECT = rectStyle(1076, 371, 1454, 417);
const REMEMBER_FORGOT_RECT = rectStyle(1076, 428, 1454, 452);
const SUBMIT_RECT = rectStyle(1076, 466, 1454, 514);
const QUICK_LOGIN_RECT = rectStyle(1076, 530, 1454, 660);

const QUICK_LOGIN_DISPLAY_PASSWORD = '••••••••••';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';

  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotHint, setShowForgotHint] = useState(false);

  function fillQuickLoginPreview(email: string) {
    setEmailValue(email);
    setPasswordValue(QUICK_LOGIN_DISPLAY_PASSWORD);
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {/* Email Input Box */}
      <div
        className="absolute flex items-center rounded-lg border border-slate-300 bg-white px-[0.7vw] shadow-sm transition-all focus-within:border-[#083366] focus-within:ring-2 focus-within:ring-[#083366]/20"
        style={EMAIL_RECT}
      >
        <Mail className="h-[1.05vw] w-[1.05vw] min-h-4 min-w-4 shrink-0 text-slate-400" />
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="admin@annex.local"
          aria-label="Email Address"
          disabled={pending}
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          className="ml-[0.5vw] h-full w-full border-0 bg-transparent text-[clamp(11px,0.92vw,14px)] font-medium text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
        />
      </div>

      {/* Password Input Box */}
      <div
        className="absolute flex items-center rounded-lg border border-slate-300 bg-white px-[0.7vw] shadow-sm transition-all focus-within:border-[#083366] focus-within:ring-2 focus-within:ring-[#083366]/20"
        style={PASSWORD_RECT}
      >
        <Lock className="h-[1.05vw] w-[1.05vw] min-h-4 min-w-4 shrink-0 text-slate-400" />
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          aria-label="Password"
          disabled={pending}
          value={passwordValue}
          onChange={(e) => setPasswordValue(e.target.value)}
          className="ml-[0.5vw] h-full w-full border-0 bg-transparent text-[clamp(11px,0.92vw,14px)] font-medium text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          onClick={() => setShowPassword((v) => !v)}
          className="ml-1 p-1 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none"
        >
          {showPassword ? (
            <Eye className="h-[1.05vw] w-[1.05vw] min-h-4 min-w-4" />
          ) : (
            <EyeOff className="h-[1.05vw] w-[1.05vw] min-h-4 min-w-4" />
          )}
        </button>
      </div>

      {/* Remember Me & Forgot Password Row */}
      <div
        className="absolute flex items-center justify-between bg-white text-[clamp(10px,0.78vw,13px)] text-slate-600 select-none"
        style={REMEMBER_FORGOT_RECT}
      >
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            name="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-[#083366] focus:ring-[#083366]"
          />
          <span className="font-medium text-slate-700">Remember me</span>
        </label>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowForgotHint((v) => !v)}
            className="font-medium text-[#083366] hover:underline focus:outline-none"
          >
            Forgot password?
          </button>
          {showForgotHint && (
            <p
              role="status"
              className="absolute right-0 top-full z-20 mt-1 w-[16vw] min-w-[210px] rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-600 shadow-xl"
            >
              Please contact your system administrator or IT helpdesk to reset your password.
            </p>
          )}
        </div>
      </div>

      {/* Sign In Button */}
      <button
        type="submit"
        disabled={pending}
        aria-label="Sign in"
        className="absolute flex items-center justify-center gap-2 rounded-lg bg-[#083366] text-[clamp(12px,1.05vw,16px)] font-semibold text-white shadow transition-all hover:bg-[#0a3f7a] active:scale-[0.99] disabled:opacity-70"
        style={SUBMIT_RECT}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Signing in…</span>
          </>
        ) : (
          <span>Sign in →</span>
        )}
      </button>

      {/* Error Banner or Quick Login Grid */}
      {state?.error ? (
        <div
          className="absolute flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2.5 text-center"
          style={QUICK_LOGIN_RECT}
        >
          <p role="alert" className="text-[clamp(11px,0.85vw,13px)] font-semibold text-red-600">
            {state.error}
          </p>
          <button
            type="button"
            onClick={() => {
              setEmailValue('');
              setPasswordValue('');
            }}
            className="mt-1 text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Clear and try again
          </button>
        </div>
      ) : (
        <div
          className="absolute grid grid-cols-3 content-start gap-[0.4vw]"
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
              className="truncate rounded-md border border-slate-200 bg-slate-50 px-[0.4vw] py-[0.45vw] text-[clamp(10px,0.76vw,12px)] font-medium text-slate-700 transition-all hover:border-[#083366] hover:bg-[#083366]/5 hover:text-[#083366] active:scale-95 disabled:opacity-50"
            >
              {role.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
