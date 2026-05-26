import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fLimit,
} from 'firebase/firestore';
import { Pin } from 'lucide-react';
import { db } from '../config/firebase';

const MAX_CARDS = 80;

function formatCurrency(val) {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  return `$${Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// Deterministic rotation per twitchId so the same person always sits at the
// same angle on the wall.
function rotationFor(id) {
  if (!id) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // -7 to +7 degrees
  return ((h % 1400) - 700) / 100;
}

function colorAccentFor(id) {
  const palette = [
    'bg-[#f5e9c7]', // cream
    'bg-[#ffe0d6]', // peach
    'bg-[#dde8f0]', // pale blue
    'bg-[#f5d9d9]', // pink
    'bg-[#e1e7d2]', // pale olive
    'bg-[#f0e1f0]', // pale violet
  ];
  if (!id) return palette[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function Card({ entry, round, dim, winnerInfo }) {
  const rotation = rotationFor(entry.twitchId);
  const paper = colorAccentFor(entry.twitchId);
  const showPayout = round.kinds?.payout && typeof entry.payoutGuess === 'number';
  const showSlot = round.kinds?.topSlot && entry.topSlotGuess;

  return (
    <div
      className={`relative transition-all duration-500 ${dim ? 'opacity-30' : 'opacity-100'}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div
        className={`relative w-44 ${paper} text-zinc-900 shadow-[0_6px_12px_-6px_rgba(0,0,0,0.6)] p-3`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 25%, rgba(0,0,0,0.04) 0 1px, transparent 1px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.03) 0 1px, transparent 1px)',
          backgroundSize: '6px 6px, 8px 8px',
        }}
      >
        {/* Pin */}
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-destructive shadow-[0_2px_2px_rgba(0,0,0,0.4)]"
        />

        <div className="flex items-center gap-2 mb-2">
          {entry.profileImageUrl ? (
            <img
              src={entry.profileImageUrl}
              alt=""
              className="w-7 h-7 rounded-full border-2 border-zinc-800/30"
              loading="lazy"
            />
          ) : (
            <div className="w-7 h-7 rounded-full border-2 border-zinc-800/30 bg-zinc-800/10 flex items-center justify-center text-[11px] font-bold text-zinc-700/80">
              {(entry.displayName || entry.twitchName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-zinc-800/75 font-mono truncate flex-1">
            {entry.displayName || entry.twitchName}
          </p>
        </div>

        {showPayout && (
          <p
            className="text-3xl font-black leading-none text-zinc-900 tabular-nums"
            style={{ fontFamily: '"Caveat", "Patrick Hand", cursive' }}
          >
            {formatCurrency(entry.payoutGuess)}
          </p>
        )}
        {showSlot && (
          <p
            className="mt-1.5 text-[10px] font-bold tracking-eyebrow-md uppercase text-zinc-700/80 font-mono truncate"
            title={entry.topSlotGuess}
          >
            ◇ {entry.topSlotGuess}
          </p>
        )}

        {/* Winner stamp */}
        {winnerInfo && (
          <span
            className={`absolute -top-1 -right-2 rotate-[12deg] px-2 py-0.5 text-[10px] font-bold tracking-eyebrow-lg uppercase border-2 font-mono ${
              winnerInfo.place === 1
                ? 'text-orange-admin border-orange-admin bg-zinc-broadcast/85'
                : winnerInfo.place === 2
                  ? 'text-white-body border-white-body bg-zinc-broadcast/85'
                  : 'text-emerald-signal border-emerald-signal bg-zinc-broadcast/85'
            }`}
          >
            {winnerInfo.place === 1 ? '1st' : winnerInfo.place === 2 ? '2nd' : '3rd'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PredictionWall({ round }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!round?.id) return undefined;
    const q = query(
      collection(db, 'prediction_rounds', round.id, 'entries'),
      orderBy('submittedAt', 'asc'),
      fLimit(MAX_CARDS + 1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [round?.id]);

  const winnersByTwitchId = useMemo(() => {
    if (round?.status !== 'settled') return {};
    const map = {};
    (round.winners || []).forEach((w) => {
      map[w.twitchId] = w;
    });
    return map;
  }, [round]);

  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-zinc-card/20 py-12 text-center">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/15 mb-3 text-white/35">
          <Pin size={14} aria-hidden="true" />
        </div>
        <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
          Wall empty
        </p>
        <p className="text-sm text-white/55">
          Submit your slip to pin the first card.
        </p>
      </div>
    );
  }

  const visible = entries.slice(0, MAX_CARDS);
  const overflow = Math.max(0, entries.length - MAX_CARDS);
  const settled = round?.status === 'settled';

  return (
    <div
      className="relative px-4 py-6 sm:px-6 sm:py-8 border border-white/10"
      style={{
        backgroundColor: '#22201d',
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(255,200,140,0.04) 0 30%, transparent 60%), radial-gradient(circle at 80% 70%, rgba(180,220,255,0.03) 0 30%, transparent 60%), repeating-linear-gradient(45deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 4px)',
      }}
    >
      <div className="flex flex-wrap gap-4 sm:gap-6 justify-center">
        {visible.map((entry) => {
          const winnerInfo = winnersByTwitchId[entry.twitchId] || null;
          const dim = settled && !winnerInfo;
          return (
            <Card key={entry.id} entry={entry} round={round} dim={dim} winnerInfo={winnerInfo} />
          );
        })}
      </div>

      {overflow > 0 && (
        <div className="mt-6 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/20 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/65 font-mono">
            +{overflow} more pinned elsewhere
          </span>
        </div>
      )}
    </div>
  );
}
