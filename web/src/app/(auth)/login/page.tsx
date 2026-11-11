import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sign in' };

// Design-reference pixel size of /public/login-background.jpg. Every overlay
// element below is positioned as a percentage of these dimensions so it
// stays aligned with the image at any viewport width — see login-form.tsx.
const BG_WIDTH = 1536;
const BG_HEIGHT = 1024;

export default function LoginPage() {
  return (
    <div
      className="relative"
      style={{
        width: `min(100vw, calc(100vh * ${BG_WIDTH} / ${BG_HEIGHT}))`,
        aspectRatio: `${BG_WIDTH} / ${BG_HEIGHT}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-ratio design background, not a content image */}
      <img
        src="/login-background.jpg"
        alt="DeshIT-BD SME ERP — All-in-One Business Management Solution for Small & Medium Enterprises"
        className="absolute inset-0 h-full w-full select-none object-contain"
        draggable={false}
      />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
