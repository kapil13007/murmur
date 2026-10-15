// File: src/auth/AuthLayout.jsx
import Logo from '../components/Logo';

function BrandPanel() {
  return (
    <div className="relative hidden flex-1 overflow-hidden rounded-3xl bg-gradient-to-br from-dawn-400 via-dawn-200 to-fathom-100 p-12 lg:flex lg:flex-col lg:justify-between">
      <p className="font-display text-[44px] leading-[1.05] text-vast-950">
        Don&apos;t type,
        <br />
        <span className="italic">just speak.</span>
      </p>
      <div className="space-y-3">
        <div className="max-w-sm rounded-2xl bg-white/60 p-4 text-sm text-vast-600 backdrop-blur">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-vast-500">You said</p>
          um so I think we should, uh, meet at 3… actually let&apos;s do 4 pm
        </div>
        <div className="ml-10 max-w-sm rounded-2xl bg-vast-950 p-4 text-sm text-sand-50 shadow-pop">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dawn-500">Murmur typed</p>
          I think we should meet at 4 PM.
        </div>
      </div>
      <p className="text-sm text-vast-700">4x faster than typing, in every app on your computer.</p>
    </div>
  );
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen gap-6 bg-canvas p-4">
      <div className="flex flex-1 flex-col px-6 py-6 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-4xl text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </div>
      <BrandPanel />
    </div>
  );
}
