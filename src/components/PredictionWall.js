import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fLimit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { moneyParts } from '../utils/money';
import { fitFontSize } from '../utils/fitText';
import { roundCurrency, entriesSealed } from '../utils/predictionRound';
import { placeLabel, placeTone } from '../utils/predictionPlaces';
import { useAuth } from '../contexts/AuthContext';

const MAX_TILES = 80;
const FACE_DOWN_TILES = 10;
const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2';
const TILE = 'relative min-w-0 border px-3 pt-2 pb-3';

const SCANLINES = {
  backgroundImage:
    'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
};

const CORNERS = [
  { pos: 'top-1.5 left-1.5', glyph: '◤' },
  { pos: 'top-1.5 right-1.5', glyph: '◥' },
  { pos: 'bottom-1.5 left-1.5', glyph: '◣' },
  { pos: 'bottom-1.5 right-1.5', glyph: '◢' },
];

function entryNo(index) {
  return String(index + 1).padStart(3, '0');
}

// The tote board: every guess on a numbered tile, in the channel's chyron
// style. Header strip, static scanlines and viewfinder corners match the
// leaderboard broadcast frame.
function BoardFrame({ status, children }) {
  return (
    <section className="border border-white/8 bg-zinc-card/30" aria-label="Prediction board">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="text-white/70">The board</span>
        <span className="text-white/40">{status}</span>
      </div>
      <div className="relative px-4 sm:px-5 py-5">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={SCANLINES} aria-hidden="true" />
        {CORNERS.map(({ pos, glyph }) => (
          <span
            key={pos}
            className={`pointer-events-none select-none absolute ${pos} text-xs font-bold leading-none text-white/25`}
            aria-hidden="true"
          >
            {glyph}
          </span>
        ))}
        <div className="relative">{children}</div>
      </div>
    </section>
  );
}

function Avatar({ entry }) {
  if (entry.profileImageUrl) {
    return (
      <img
        src={entry.profileImageUrl}
        alt=""
        className="w-5 h-5 shrink-0 rounded-full border border-white/15"
        loading="lazy"
      />
    );
  }
  return (
    <span className="w-5 h-5 shrink-0 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-[0.5625rem] font-bold text-white/60">
      {(entry.displayName || entry.twitchName || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function Tile({ entry, index, currency, winner, dim }) {
  const { code, amount } = moneyParts(entry.payoutGuess, currency, { decimals: 0 });
  const tone = winner ? placeTone(winner.place) : 'border-white/10 bg-zinc-broadcast/70 text-white-body';
  return (
    <li
      className={`${TILE} ${tone} origin-top transition-opacity duration-300 motion-safe:animate-tote-flip ${dim ? 'opacity-40' : ''}`}
      style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
    >
      <div className="flex items-center justify-between gap-2 h-4 font-mono text-[0.5625rem] font-bold tracking-eyebrow-md uppercase">
        <span className="text-white/35 tabular-nums">{entryNo(index)}</span>
        {winner && <span className="px-1.5 border border-current leading-[0.9rem]">{placeLabel(winner.place)}</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
        <Avatar entry={entry} />
        <span className="truncate font-mono text-[0.625rem] font-bold tracking-eyebrow-sm uppercase text-white/70">
          {entry.displayName || entry.twitchName}
        </span>
      </div>
      <div className="mt-3" style={{ containerType: 'inline-size' }}>
        <span className="block font-mono text-[0.5625rem] font-bold tracking-eyebrow-md text-white/40">{code}</span>
        <p
          className="mt-1 text-xl font-black leading-none tabular-nums whitespace-nowrap"
          style={{ fontSize: fitFontSize(amount, { min: 0.875, max: 1.75 }) }}
        >
          {amount}
        </p>
      </div>
    </li>
  );
}

function FaceDownTile({ index }) {
  return (
    <li data-testid="face-down-tile" className={`${TILE} border-white/10 bg-zinc-broadcast/70`}>
      <span className="block h-4 font-mono text-[0.5625rem] font-bold tracking-eyebrow-md text-white/25 tabular-nums">
        {entryNo(index)}
      </span>
      <span className="mt-1.5 block h-3 bg-white/10" style={{ width: `${45 + ((index * 37) % 40)}%` }} />
      <span className="mt-4 block h-6 bg-white/[0.07]" style={{ width: `${55 + ((index * 23) % 40)}%` }} />
    </li>
  );
}

function BoardNote({ title, children }) {
  return (
    <div className="text-center">
      <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-1 font-mono">{title}</p>
      <p className="text-sm text-white/55">{children}</p>
    </div>
  );
}

export default function PredictionWall({ round }) {
  const { isStaff } = useAuth();
  const sealed = entriesSealed(round, isStaff);
  const [entries, setEntries] = useState([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setEntries([]);
    setDenied(false);
    if (!round?.id || sealed) return undefined;
    const q = query(
      collection(db, 'hunts', round.id, 'entries'),
      orderBy('submittedAt', 'asc'),
      fLimit(MAX_TILES + 1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      // Denied when the round reopened before this listener caught up.
      () => setDenied(true)
    );
    return unsub;
  }, [round?.id, sealed]);

  const winnersByTwitchId = useMemo(() => {
    if (round?.status !== 'settled') return {};
    const map = {};
    (round.winners || []).forEach((w) => {
      map[w.twitchId] = w;
    });
    return map;
  }, [round]);

  const count = round?.entryCount ?? 0;

  if ((sealed || denied) && count > 0) {
    return (
      <BoardFrame status="Sealed until lock">
        <ol className={GRID} aria-hidden="true">
          {Array.from({ length: Math.min(count, FACE_DOWN_TILES) }, (_, i) => (
            <FaceDownTile key={i} index={i} />
          ))}
        </ol>
        <div className="mt-5">
          <BoardNote title={`${count} ${count === 1 ? 'guess' : 'guesses'} face down`}>
            Flipped when predictions lock.
          </BoardNote>
        </div>
      </BoardFrame>
    );
  }

  if (sealed || denied || entries.length === 0) {
    return (
      <BoardFrame status="No guesses yet">
        <div className="py-6">
          <BoardNote title="Board empty">Submit your slip to put the first number up.</BoardNote>
        </div>
      </BoardFrame>
    );
  }

  const currency = roundCurrency(round);
  const visible = entries.slice(0, MAX_TILES);
  // The query stops at MAX_TILES + 1, so the round's counter sizes the rest.
  const overflow = Math.max(0, Math.max(count, entries.length) - MAX_TILES);
  const settled = round?.status === 'settled';

  return (
    <BoardFrame status="In order of entry">
      <ol className={GRID}>
        {visible.map((entry, i) => {
          const winner = winnersByTwitchId[entry.twitchId] || null;
          return (
            <Tile
              key={entry.id}
              entry={entry}
              index={i}
              currency={currency}
              winner={winner}
              dim={settled && !winner}
            />
          );
        })}
      </ol>
      {overflow > 0 && (
        <p className="mt-4 text-center text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/50 font-mono">
          +{overflow} more off the board
        </p>
      )}
    </BoardFrame>
  );
}
