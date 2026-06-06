import React from 'react';
import { Link } from 'react-router-dom';

// Brand-register footer. Mounted in App.js only on public/brand routes
// (hidden on /gamba, /admin, and OAuth callbacks). Carries the legal
// pointer to /terms plus the standing gambling disclaimer.
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/8 px-6 sm:px-10 py-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/35 font-mono">
          © {year} GooferG · Off-air but archived
        </span>
        <Link
          to="/terms"
          className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 hover:text-emerald-signal transition-colors duration-200 font-mono"
        >
          Terms &amp; Conditions →
        </Link>
      </div>
      <p className="mt-6 px-1 text-center text-[0.625rem] font-bold tracking-eyebrow-sm uppercase font-mono text-white/30">
        We do not take responsibility for any losses from gambling. Play
        responsibly. Must be 18+.
      </p>
    </footer>
  );
}
