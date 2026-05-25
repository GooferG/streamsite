import React, { useState, useEffect } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function useNowTimestamp() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatTimecode(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function Field({ label, code, icon: Icon, type, value, onChange, placeholder, autoComplete }) {
  return (
    <label className="block">
      <div
        className="flex items-baseline gap-3 mb-2 text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono"
      >
        <span className="text-orange-admin tabular-nums">{code}</span>
        <span className="text-white/55">{label}</span>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none">
          <Icon size={16} aria-hidden="true" />
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full bg-zinc-broadcast/60 border border-white/10 pl-10 pr-4 py-3 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none focus:bg-zinc-broadcast/80 transition-colors duration-150"
        />
      </div>
    </label>
  );
}

export default function AdminLoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const now = useNowTimestamp();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err) {
      console.error('Login error:', err);
      setError('Authentication failed. Verify credentials and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center">
      <div className="relative w-full max-w-md">
        {/* Terminal shell */}
        <div className="relative overflow-hidden border border-white/8 bg-zinc-card/30">
          {/* Atmospheric backing — orange admin accent */}
          <div
            className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-orange-admin/10 blur-3xl motion-reduce:hidden"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
            aria-hidden="true"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
            }}
          />

          {/* Status bar */}
          <div
            className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono"
      >
            <span className="inline-flex items-center gap-2 text-orange-admin">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
              <span>ACCESS REQUIRED</span>
            </span>
            <span className="text-white/15">·</span>
            <span className="text-white/45">CHANNEL</span>
            <span className="text-white/70 tracking-eyebrow-lg">GG-ADMIN</span>
          </div>

          {/* Body */}
          <div className="relative px-6 sm:px-8 py-8">
            {/* Slate */}
            <div className="mb-7">
              <div
                className="flex items-baseline gap-3 mb-3 text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono"
      >
                <span className="text-white/30">TERMINAL</span>
                <span className="text-orange-admin tabular-nums">T-01</span>
              </div>
              <h1
                className="font-black leading-none tracking-tight text-white-body"
                style={{
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  fontSize: 'clamp(2rem, 6vw, 2.75rem)',
                }}
              >
                Operator sign-in.
              </h1>
              <p
                className="mt-3 text-[11px] tracking-eyebrow uppercase text-white/40 font-mono"
      >
                Authorized personnel only.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                className="mb-6 px-4 py-3 border border-red-destructive/40 bg-red-destructive/5 flex items-start gap-3"
                role="alert"
              >
                <AlertCircle
                  size={16}
                  className="text-red-destructive flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-bold tracking-eyebrow-md uppercase text-red-destructive/80 mb-0.5 font-mono"
      >
                    Signal rejected
                  </div>
                  <p className="text-sm text-white/80">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Field
                label="Email"
                code="01"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="operator@channel"
                autoComplete="email"
              />
              <Field
                label="Password"
                code="02"
                icon={Lock}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span
                  className="text-[10px] font-bold tracking-eyebrow-lg font-mono"
      >
                  {loading ? 'AUTH...' : 'AUTHENTICATE'}
                </span>
                {!loading && (
                  <span
                    className="text-[10px] font-bold tracking-eyebrow-lg opacity-70 font-mono"
      >
                    →
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div
            className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-t border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md text-white/30 font-mono"
      >
            <span>SECURE TERMINAL</span>
            <span className="text-white/15">·</span>
            <span className="text-orange-admin/70 tabular-nums">{formatTimecode(now)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
