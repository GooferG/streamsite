import { useId, useState } from 'react';
import Panel from '../onAir/Panel';
import OnAirButton from '../onAir/OnAirButton';
import { MONO } from '../onAir/classes';
import { formatMoney } from '../../utils/money';
import { entryName, guessOf, lineupRows } from './huntBoard';
import { timeAgo } from './huntTime';
import { signedMoney } from './huntStats';
import ViewerAvatar from './ViewerAvatar';

// "Guesses so far" / "Tonight's lineup". While a round is open, viewers see
// their own row and face-down rows for everyone else (entries are sealed).
const FACE_DOWN_ROWS = 8;
const GRID =
  'grid grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 sm:grid-cols-[44px_40px_minmax(0,1fr)_minmax(120px,auto)_110px] sm:gap-4 sm:pl-3.5 sm:pr-[18px]';
const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');

function Row({ row, mode, currency, now }) {
  const settled = mode === 'settled';
  const lit = row.winnerPlace === 1 ? 'winner' : row.isMe ? 'viewer' : null;
  const lead = row.no == null ? '··' : pad2(settled ? row.place : row.no);
  const leadTone =
    row.winnerPlace === 1
      ? 'text-onair-winner-warm'
      : row.winnerPlace === 2
        ? 'text-onair-ink-2'
        : row.isMe
          ? 'text-onair-viewer-light'
          : 'text-onair-ink-5';
  const valueTone =
    row.winnerPlace === 1
      ? 'text-onair-winner-light'
      : row.isMe || row.winnerPlace === 2
        ? 'text-white-body'
        : settled
          ? 'text-onair-ink-3'
          : 'text-onair-ink-2';
  const meta = settled ? signedMoney(row.off, currency, { decimals: 0 }) : timeAgo(row.submittedAt, now) || 'just now';
  const metaTone = !settled && row.isMe ? 'text-onair-signal' : 'text-onair-ink-5';
  return (
    <Panel as="li" radius="row" lit={lit} className={`${GRID} transition-[filter] duration-150 hover:brightness-[1.15]`}>
      <span className={`${MONO} text-center text-[0.8125rem] font-bold ${leadTone}`}>{lead}</span>
      <ViewerAvatar
        src={row.avatar}
        name={row.name}
        className="h-8 w-8 bg-gradient-to-br from-onair-surface-raised to-onair-ink-7 text-[0.9375rem] text-onair-ink-2 sm:h-10 sm:w-10"
      />
      <div className="min-w-0">
        <p className="truncate text-[0.9375rem] font-bold sm:text-[1.0625rem]">
          {row.name}
          {row.isMe && <span className="font-medium text-onair-viewer-light"> (you)</span>}
        </p>
        <p className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-5`}>
          {row.no == null ? 'Your slip · sealed' : `Entry #${pad3(row.no)}`}
        </p>
      </div>
      <div className="text-right">
        <p className={`whitespace-nowrap text-lg font-extrabold tabular-nums sm:text-[1.375rem] ${valueTone}`}>
          {formatMoney(row.guess, currency, { decimals: 0 })}
        </p>
        <p className={`text-xs sm:hidden ${metaTone}`}>{meta}</p>
      </div>
      <p className={`hidden text-right text-[0.8125rem] sm:block ${metaTone}`}>{meta}</p>
    </Panel>
  );
}

function FaceDownRow({ index }) {
  return (
    <Panel as="li" radius="row" className={GRID} data-testid="face-down-row">
      <span className={`${MONO} text-center text-[0.8125rem] font-bold text-onair-ink-6`} aria-hidden="true">
        ··
      </span>
      <span className="h-8 w-8 rounded-full bg-white/5 sm:h-10 sm:w-10" aria-hidden="true" />
      <span className="block h-3 rounded-full bg-white/10" style={{ width: `${45 + ((index * 37) % 40)}%` }} aria-hidden="true" />
      <span className={`${MONO} text-right text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Sealed</span>
      <span className="hidden sm:block" aria-hidden="true" />
    </Panel>
  );
}

function sealedBody({ round, myEntry, myId, mode, currency, now }) {
  const count = (round && round.entryCount) || 0;
  const mine = guessOf(myEntry) != null ? myEntry : null;
  const myRow = mine && {
    id: mine.id,
    twitchId: myId,
    name: entryName(mine),
    avatar: mine.profileImageUrl || null,
    guess: mine.payoutGuess,
    no: null,
    place: null,
    off: null,
    submittedAt: mine.lastEditAt || mine.submittedAt || null,
    isMe: true,
    winnerPlace: null,
  };
  const others = Math.max(0, count - (myRow ? 1 : 0));
  const shown = Math.min(others, FACE_DOWN_ROWS);
  if (!myRow && others === 0) return null;
  return (
    <>
      <ol className="flex flex-col gap-2" aria-label={`${count} sealed ${count === 1 ? 'guess' : 'guesses'}`}>
        {myRow && <Row row={myRow} mode={mode} currency={currency} now={now} />}
        {Array.from({ length: shown }, (_, i) => (
          <FaceDownRow key={i} index={i} />
        ))}
      </ol>
      {others > shown && (
        <p className={`${MONO} mt-1 text-center text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>
          +{others - shown} more sealed
        </p>
      )}
    </>
  );
}

export default function HuntLineup({ mode, sealed, entries, round, myEntry, myId, currency, now }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const settled = mode === 'settled';
  const title = settled ? "Tonight's lineup" : 'Guesses so far';
  const label = sealed ? 'Sealed until entries close' : settled ? 'Closest first' : 'Low to high';

  let body;
  if (sealed) {
    body = sealedBody({ round, myEntry, myId, mode, currency, now });
  } else {
    const { rows, total, hiddenCount, pinned } = lineupRows({ mode, entries, round, myId, expanded });
    body =
      total === 0 ? null : (
        <>
          <ol className="flex flex-col gap-2">
            {rows.map((r) => (
              <Row key={r.id} row={r} mode={mode} currency={currency} now={now} />
            ))}
          </ol>
          {pinned && (
            <div className="mt-1">
              <p className={`${MONO} mb-1.5 px-1 text-[0.625rem] tracking-[0.2em] text-onair-viewer-light`}>Your spot</p>
              <ol>
                <Row row={pinned} mode={mode} currency={currency} now={now} />
              </ol>
            </div>
          )}
          {(hiddenCount > 0 || expanded) && (
            <OnAirButton
              variant="ghost"
              size="sm"
              className="self-center"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show fewer' : `Show all ${total}`}
            </OnAirButton>
          )}
        </>
      );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id={headingId} className="text-2xl font-extrabold">
          {title}
        </h2>
        <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>{label}</span>
      </div>
      {body || (
        <Panel className="px-5 py-6 text-center text-sm text-onair-ink-4">
          {mode === 'open' ? 'No guesses yet. Be the first on the board.' : 'No guesses this round.'}
        </Panel>
      )}
    </section>
  );
}
