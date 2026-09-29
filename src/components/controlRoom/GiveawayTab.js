import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Gift, Megaphone, Plus, RotateCcw } from 'lucide-react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useClock } from '../../hooks/useClock';
import { formFromGiveaway, formatClock, tsMillis } from '../../utils/giveaway';
import NewGiveawayForm from '../admin/giveaways/NewGiveawayForm';
import WinnerModal from '../admin/giveaways/WinnerModal';
import PlayPanel from '../admin/giveaways/PlayPanel';
import AnimatedCount from '../admin/giveaways/AnimatedCount';
import { useEventSubStatus } from '../admin/giveaways/EventSubStatus';
import { useGiveawayAction } from './useGiveawayAction';
import { useLatestGiveaway, useRecentEntrants } from './giveawayFeeds';

const HOT_SECONDS = 10;

function ChatDot({ chat }) {
  const on = chat.status === 'enabled';
  const label = chat.status === 'loading' ? 'Checking chat' : on ? 'Chat connected' : 'Chat not connected';
  const dot = on ? 'bg-emerald-signal' : chat.status === 'loading' ? 'bg-white/30' : 'bg-red-destructive';
  return (
    <span className="cr-lbl inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Footer({ chat }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <ChatDot chat={chat} />
      <Link to="/admin/giveaways" className="cr-lbl hover:text-white-body">
        Open in admin ↗
      </Link>
    </div>
  );
}

function ActionError({ error }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
      {error}
    </p>
  );
}

function Countdown({ giveaway }) {
  const closesAt = tsMillis(giveaway.closesAt);
  const startedAt = tsMillis(giveaway.startedAt) ?? tsMillis(giveaway.createdAt);
  const now = useClock({ intervalMs: 500, active: closesAt != null });
  if (closesAt == null) {
    return (
      <div>
        <p className="cr-lbl">No timer · type {giveaway.keyword}</p>
        <p className="cr-timecode">OPEN</p>
      </div>
    );
  }
  const left = Math.max(0, (closesAt - now) / 1000);
  const total = startedAt != null ? Math.max(1, (closesAt - startedAt) / 1000) : null;
  const pct = total ? Math.min(100, Math.max(0, 100 - (left / total) * 100)) : null;
  return (
    <div className="min-w-0 flex-1">
      <p className="cr-lbl">closes in · type {giveaway.keyword}</p>
      <p className={`cr-timecode ${left > 0 && left <= HOT_SECONDS ? 'is-hot' : ''}`} aria-live="off">
        {formatClock(left)}
      </p>
      {pct != null && (
        <div className="cr-bar" data-testid="cr-bar">
          <i style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
      )}
    </div>
  );
}

function Entries({ giveaway }) {
  return (
    <div className="text-right">
      <p className="cr-lbl">entered</p>
      <p className="cr-big text-orange-admin">
        <AnimatedCount value={giveaway.entryCount ?? 0} />
      </p>
    </div>
  );
}

function OpenView({ giveaway, chat }) {
  const { busy, error, run } = useGiveawayAction(giveaway.id);
  const entrants = useRecentEntrants(giveaway.id, true);
  const canLastCall =
    !!giveaway.announceLastCall && !!giveaway.lastCallMessage && !giveaway.lastCallAt && !!giveaway.closesAt;
  const nobody = (giveaway.entryCount ?? 0) === 0;
  return (
    <div>
      <p className="font-bold text-white-body truncate mb-3">{giveaway.prize}</p>
      <div className="flex items-end justify-between gap-3">
        <Countdown giveaway={giveaway} />
        <Entries giveaway={giveaway} />
      </div>
      <div className="flex gap-1.5 mt-3">
        {canLastCall && (
          <button type="button" className="cr-btn" disabled={!!busy} onClick={() => run('lastCall')}>
            <Megaphone size={12} aria-hidden="true" />
            {busy === 'lastCall' ? 'Posting…' : 'Last call'}
          </button>
        )}
        <button type="button" className="cr-btn" disabled={!!busy} onClick={() => run('close')}>
          {busy === 'close' ? 'Closing…' : 'Close'}
        </button>
        <button type="button" className="cr-btn is-go" disabled={!!busy || nobody} onClick={() => run('roll')}>
          <Gift size={12} aria-hidden="true" />
          {busy === 'roll' ? 'Rolling…' : 'Roll'}
        </button>
      </div>
      <ActionError error={error} />
      {entrants.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Newest entries">
          {entrants.map((e) => (
            <li key={e.id} className="flex justify-between gap-2 text-[0.6875rem] font-mono text-white/55">
              <span className="text-white-body truncate">{e.displayName || e.twitchName}</span>
              <span>{(e.weight || 1) > 1 ? `${e.weight} tickets` : '1 ticket'}</span>
            </li>
          ))}
        </ul>
      )}
      <Footer chat={chat} />
    </div>
  );
}

function ClosedView({ giveaway, chat }) {
  const { busy, error, run } = useGiveawayAction(giveaway.id);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const winners = (giveaway.winners || []).length;
  return (
    <div>
      <p className="font-bold text-white-body truncate mb-3">{giveaway.prize}</p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="cr-lbl">entries closed</p>
          <p className="cr-timecode">CLOSED</p>
        </div>
        <Entries giveaway={giveaway} />
      </div>
      <div className="flex gap-1.5 mt-3">
        {confirmEnd ? (
          <>
            <button type="button" className="cr-btn" onClick={() => setConfirmEnd(false)}>
              Cancel
            </button>
            <button type="button" className="cr-btn is-go" disabled={!!busy} onClick={() => run('end')}>
              {winners > 0 ? `End · ${winners} winner${winners === 1 ? '' : 's'}` : 'End with no winner'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="cr-btn" disabled={!!busy} onClick={() => setConfirmEnd(true)}>
              <Flag size={12} aria-hidden="true" />
              End
            </button>
            <button
              type="button"
              className="cr-btn is-go"
              disabled={!!busy || (giveaway.entryCount ?? 0) === 0}
              onClick={() => run('roll')}
            >
              <Gift size={12} aria-hidden="true" />
              {busy === 'roll' ? 'Rolling…' : 'Roll'}
            </button>
          </>
        )}
      </div>
      <ActionError error={error} />
      <Footer chat={chat} />
    </div>
  );
}

function IdleView({ latest, onStart, chat }) {
  return (
    <div>
      <p className="cr-lbl">giveaway</p>
      <p className="cr-timecode is-quiet">IDLE</p>
      <p className="text-sm text-white/55 mt-2">Nothing running.</p>
      <div className="flex gap-1.5 mt-3">
        <button type="button" className="cr-btn is-go" onClick={() => onStart(formFromGiveaway(latest))}>
          <Plus size={12} aria-hidden="true" />
          New giveaway
        </button>
        {latest && (
          <button
            type="button"
            className="cr-btn"
            onClick={() => onStart(formFromGiveaway(latest, { copyPrize: true }))}
          >
            <RotateCcw size={12} aria-hidden="true" />
            Run last again
          </button>
        )}
      </div>
      <Footer chat={chat} />
    </div>
  );
}

// One compact view per giveaway status. The winner and play steps reuse the
// admin components inline, so both surfaces behave the same.
export default function GiveawayTab({ scopeRef = null }) {
  const cr = useControlRoom();
  const g = cr.giveaway;
  const chat = useEventSubStatus();
  const [seed, setSeed] = useState(null);
  const latest = useLatestGiveaway(!g);

  if (seed) {
    return (
      <NewGiveawayForm
        inline
        seed={seed}
        chat={chat}
        onClose={() => setSeed(null)}
        onCreated={(_id, meta) => {
          setSeed(null);
          if (meta?.announceError) {
            cr.pushWarning(`Giveaway started, but chat announce failed: ${meta.announceError}`);
          }
        }}
      />
    );
  }
  if (!g) return <IdleView latest={latest} onStart={setSeed} chat={chat} />;
  if (g.status === 'rolling' && g.winner) {
    return (
      <>
        <WinnerModal
          inline
          key={g.id}
          giveaway={g}
          announce={cr.announce}
          scopeRef={scopeRef}
          globalHotkeys={cr.ducked}
        />
        <Footer chat={chat} />
      </>
    );
  }
  if (g.status === 'playing' && g.playing) {
    return (
      <>
        <PlayPanel inline key={`${g.id}:${g.playing.twitchId}`} giveaway={g} announce={cr.announce} />
        <Footer chat={chat} />
      </>
    );
  }
  if (g.status === 'closed') return <ClosedView giveaway={g} chat={chat} />;
  return <OpenView giveaway={g} chat={chat} />;
}
