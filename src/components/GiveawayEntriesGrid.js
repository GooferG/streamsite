import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fLimit,
} from 'firebase/firestore';
import { Users } from 'lucide-react';
import { db } from '../config/firebase';

const MAX_VISIBLE = 60;

function DiscordBadge() {
  // Tiny corner badge for Discord-linked weight bonus.
  return (
    <span
      className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#5865F2] text-white border border-zinc-broadcast text-[8px] font-bold font-mono"
      title="Discord linked — extra entry weight"
    >
      D
    </span>
  );
}

function avatarColorFromName(name) {
  // Deterministic muted accent color from name hash. Keeps the palette
  // intentionally dim so avatars don't compete with the registered viewers.
  const palette = [
    'bg-zinc-card text-white/55 border-white/15',
    'bg-zinc-broadcast text-white/60 border-white/20',
    'bg-purple-gamba/30 text-purple-bright/80 border-purple-bright/30',
    'bg-emerald-signal/15 text-emerald-signal/70 border-emerald-signal/25',
    'bg-orange-admin/15 text-orange-admin/70 border-orange-admin/25',
  ];
  if (!name) return palette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function FallbackAvatar({ name, className = '' }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className={`flex items-center justify-center font-mono font-bold border-2 ${avatarColorFromName(name)} ${className}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function EntryTile({ entry, state }) {
  // state: 'normal' | 'winner' | 'dimmed' | 'skipped'
  const ring =
    state === 'winner'
      ? 'border-orange-admin/80 ring-2 ring-orange-admin/40'
      : 'border-white/15';
  const opacity =
    state === 'dimmed'
      ? 'opacity-30'
      : state === 'skipped'
        ? 'opacity-25'
        : 'opacity-100';
  const scale = state === 'winner' ? 'scale-110' : 'scale-100';
  const discord = (entry.weight || 1) > 1;

  return (
    <div
      className={`group flex flex-col items-center gap-1.5 transition-all duration-300 ${opacity} ${scale}`}
      style={{ animation: 'entryPop 0.28s ease-out' }}
    >
      <div className="relative">
        {entry.profileImageUrl ? (
          <img
            src={entry.profileImageUrl}
            alt=""
            className={`w-14 h-14 rounded-full border-2 ${ring} transition-all duration-300`}
            loading="lazy"
          />
        ) : (
          <FallbackAvatar
            name={entry.displayName || entry.twitchName}
            className={`w-14 h-14 rounded-full text-base transition-all duration-300 ${ring}`}
          />
        )}
        {discord && <DiscordBadge />}
        {state === 'skipped' && (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="w-full h-[2px] bg-red-destructive rotate-[-30deg]" />
          </span>
        )}
      </div>
      <span
        className={`text-[10px] font-bold tracking-eyebrow-md uppercase font-mono text-center max-w-[6.5rem] truncate ${
          state === 'winner' ? 'text-orange-admin' : 'text-white/70'
        }`}
      >
        {entry.displayName || entry.twitchName}
      </span>
    </div>
  );
}

/**
 * Live grid of giveaway entries.
 *
 * Props:
 *  - giveawayId: string
 *  - rolling: bool        (dim non-winners, scale winner)
 *  - winnerTwitchId: string | null
 *  - skippedIds: string[] (mark as skipped)
 *  - dense: bool          (smaller tiles when used in tight layouts)
 */
export default function GiveawayEntriesGrid({
  giveawayId,
  rolling = false,
  winnerTwitchId = null,
  skippedIds = [],
}) {
  const [entries, setEntries] = useState([]);
  const skippedSet = useMemo(() => new Set(skippedIds || []), [skippedIds]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!giveawayId) return undefined;
    const q = query(
      collection(db, 'giveaways', giveawayId, 'entries'),
      orderBy('enteredAt', 'desc'),
      fLimit(MAX_VISIBLE + 1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [giveawayId]);

  const visible = entries.slice(0, MAX_VISIBLE);
  const overflowApprox = Math.max(0, entries.length - MAX_VISIBLE);

  if (entries.length === 0) {
    return (
      <div className="border border-white/8 bg-zinc-card/30 py-12 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 mb-3 text-white/35">
          <Users size={16} aria-hidden="true" />
        </div>
        <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
          No entries yet
        </p>
        <p className="text-sm text-white/55">
          Viewers will appear here as they type the keyword.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="grid gap-4 gap-y-5"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(5.5rem, 1fr))',
        }}
      >
        {visible.map((entry) => {
          let state = 'normal';
          if (rolling && winnerTwitchId) {
            state = entry.id === winnerTwitchId ? 'winner' : 'dimmed';
          }
          if (skippedSet.has(entry.id)) state = 'skipped';
          return <EntryTile key={entry.id} entry={entry} state={state} />;
        })}
      </div>

      {overflowApprox > 0 && (
        <div className="mt-5 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/15 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
            +{overflowApprox} more waiting
          </span>
        </div>
      )}

      <style>{`
        @keyframes entryPop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
