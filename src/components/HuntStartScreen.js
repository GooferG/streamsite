import { useState } from 'react';
import { Play, LogIn, Save, Trash2 } from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import HuntHistory from './HuntHistory';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/40 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

export default function HuntStartScreen({
  isLoggedIn,
  history,
  localHuntPending,
  onStart,
  onClaimLocal,
  onDiscardLocal,
  onReexport,
  onReopenHunt,
  onDeleteHunt,
}) {
  const { loginWithTwitch } = useTwitchAuth();
  const [name, setName] = useState('');
  const [startBalance, setStartBalance] = useState('');

  const canStart = name.trim().length > 0;

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          <span>HUNT TRACKER</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">NEW HUNT</span>
        <span className="ml-auto text-white/35 tracking-eyebrow-md">
          CH 02 · standing by
        </span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        {/* Login nudge (anon) */}
        {!isLoggedIn && (
          <button
            type="button"
            onClick={loginWithTwitch}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-purple-gamba/40 bg-purple-gamba/5 text-left hover:bg-purple-gamba/10 transition-colors duration-150"
          >
            <span className="flex items-center gap-2.5">
              <LogIn size={15} className="text-purple-bright" aria-hidden="true" />
              <span className="text-sm font-bold text-white-body">
                Connect Twitch to save your hunts
                <span className="block text-[0.6875rem] font-normal text-white/50 mt-0.5">
                  Keep a track record across devices + recap exports.
                </span>
              </span>
            </span>
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-purple-bright font-mono">
              Login
            </span>
          </button>
        )}

        {/* Claim prompt */}
        {isLoggedIn && localHuntPending && (
          <div className="px-4 py-3 border border-emerald-signal/40 bg-emerald-signal/5">
            <p className="text-sm font-bold text-white-body mb-2">
              Save this in-progress hunt to your account?
              <span className="block text-[0.6875rem] font-normal text-white/50 mt-0.5">
                “{localHuntPending.name || 'Untitled'}” — found on this device.
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClaimLocal}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <Save size={12} aria-hidden="true" />
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Save it</span>
              </button>
              <button
                type="button"
                onClick={onDiscardLocal}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-white/65 hover:text-red-destructive hover:border-red-destructive/50 transition-colors duration-150"
              >
                <Trash2 size={12} aria-hidden="true" />
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Discard</span>
              </button>
            </div>
          </div>
        )}

        {/* Start form */}
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              <span className="text-emerald-signal tabular-nums">01</span> Hunt name <span className="text-emerald-signal">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canStart && onStart({ name, startBalance })}
              placeholder="Friday Night Bonanza"
              className={inputCls}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              <span className="text-emerald-signal tabular-nums">02</span> Start balance <span className="text-white/30 normal-case font-normal">· optional, editable later</span>
            </span>
            <input
              type="number"
              value={startBalance}
              onChange={(e) => setStartBalance(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canStart && onStart({ name, startBalance })}
              placeholder="0.00"
              className={`${inputCls} tabular-nums`}
            />
          </label>
          <button
            type="button"
            onClick={() => onStart({ name, startBalance })}
            disabled={!canStart}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
          >
            <Play size={14} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Start hunt</span>
          </button>
        </div>

        {/* History (logged in) */}
        {isLoggedIn && (
          <div className="pt-2">
            <HuntHistory
              history={history}
              onReexport={onReexport}
              onReopen={onReopenHunt}
              onDelete={onDeleteHunt}
            />
          </div>
        )}
      </div>
    </div>
  );
}
