import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useClock } from '../../hooks/useClock';
import { LOCK_HOLD_MS, REVEAL_MS, STREAM_DELAY_MS, tsMillis } from '../../utils/giveaway';
import { AUTO_POST_WINDOW_MS, DRAW_REVEAL_MS, WINNER_HOLD_MS, drawnEntries, drumBalls, formatMulti, isActive, pad2, prizeText, recentBalls, who } from '../../utils/ball';
import { inputCls } from '../admin/predictions/shared';
import { announceProblem, ballAction } from './ballApi';
import { useBallRun } from './useBallRun';
import BallPayout from './BallPayout';
import HuntLink from './HuntLink';

export function prizeForm(prize) {
  return {
    tickets: String(prize && prize.tickets != null ? prize.tickets : 200),
    amount: prize && prize.prize ? String(prize.prize.amount) : '',
    kind: (prize && prize.prize && prize.prize.kind) || 'cash',
  };
}

export function prizePayload(form) {
  const amount = Number(form.amount);
  return {
    tickets: Math.max(0, Math.floor(Number(form.tickets) || 0)),
    prize: form.amount !== '' && Number.isFinite(amount) && amount > 0 ? { kind: form.kind, amount } : null,
  };
}

export function PrizeFields({ form, setForm }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="block">
        <span className="cr-lbl">tickets</span>
        <input className={inputCls} inputMode="numeric" aria-label="Tickets" value={form.tickets} onChange={(e) => setForm({ ...form, tickets: e.target.value })} />
      </label>
      <label className="block">
        <span className="cr-lbl">$ prize</span>
        <input className={inputCls} inputMode="decimal" aria-label="Dollar prize" placeholder="none" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </label>
      <label className="block">
        <span className="cr-lbl">paid as</span>
        <select className={inputCls} aria-label="Prize kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="cash">Cash</option>
          <option value="bonus">Bonus buy</option>
        </select>
      </label>
    </div>
  );
}

// A giveaway winner reveal (or its lock hold) is on screen right now. On the
// OBS overlay the winner screen stays up for as long as the giveaway is
// rolling with a winner, until staff confirm or reroll. Stage plays one timed
// reveal from rolledAt. The Locked-in hold runs from playing.startedAt.
function giveawayOnScreen(giveaway, now, reveals) {
  if (!giveaway) return false;
  if (giveaway.status === 'rolling') {
    if (reveals !== 'stage') return !!giveaway.winner;
    const at = tsMillis(giveaway.rolledAt);
    return at != null && now - at < REVEAL_MS + LOCK_HOLD_MS;
  }
  if (giveaway.status === 'playing' && giveaway.playing && giveaway.playing.fromConfirm) {
    const started = tsMillis(giveaway.playing.startedAt);
    return started != null && now - started < LOCK_HOLD_MS;
  }
  return false;
}

// A staff action that also posts a chat line: when the line was refused (not
// "already posted" or "scratched"), say so and offer a retry.
function useChatCheck() {
  const [fail, setFail] = useState(null);
  const track = (result, { id, event, drawNo }) => {
    if (!result || !result.ok) return;
    const target = id || (result.data && result.data.id);
    const problem = announceProblem(true, { announce: result.data && result.data.announce });
    setFail(problem ? { id: target, event, drawNo, reason: problem } : null);
  };
  const retry = async () => {
    if (!fail) return;
    const body = { action: 'announce', id: fail.id, event: fail.event };
    if (fail.drawNo != null) body.drawNo = fail.drawNo;
    const { ok, data } = await ballAction(body);
    const problem = announceProblem(ok, data);
    setFail(problem ? { ...fail, reason: problem } : null);
  };
  return { fail, track, retry };
}

function OpenForm({ initial, track, waitForResults = false }) {
  const [form, setForm] = useState(() => prizeForm(initial));
  const [follow, setFollow] = useState(true);
  const { busy, error, run } = useBallRun();
  return (
    <div className="mt-3 space-y-2">
      <PrizeFields form={form} setForm={setForm} />
      <label className="flex items-center gap-2 text-xs text-white/70">
        <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
        Followers only (mods and VIPs always in)
      </label>
      <button
        type="button"
        className="cr-btn is-go w-full"
        disabled={!!busy || waitForResults}
        title={waitForResults ? 'Wait for the results line' : undefined}
        onClick={async () => track(await run({ action: 'open', prize: prizePayload(form), requireFollow: follow }), { event: 'opened' })}
      >
        Open the drum
      </button>
      {waitForResults && <p className="text-xs font-mono text-white/55">Wait for the results line</p>}
      {error && <p className="text-xs font-mono text-red-destructive">{error}</p>}
    </div>
  );
}

function LastWinner({ round, results }) {
  const w = round.winner;
  const settledMs = tsMillis(round.settledAt);
  const stale = !results.posted && settledMs != null && Date.now() - settledMs > AUTO_POST_WINDOW_MS;
  return (
    <div>
      <p className="cr-lbl">last winning ball</p>
      <p className="mt-1 text-sm text-white-body">
        {`@${who(w)} · ${w.slotName}`} <span className="font-mono text-orange-admin">{formatMulti(w.multiplier)}</span>
      </p>
      <p className="cr-lbl mt-1">{`won ${prizeText(round.prize)}`}</p>
      <p className="mt-1 text-xs font-mono text-white/55">
        {results.posted
          ? 'Chat line posted.'
          : results.posting
            ? 'Posting to chat…'
            : results.error
              ? `Chat line failed: ${results.error}`
              : stale
                ? 'Chat line not posted.'
                : 'Chat line due after the stream delay.'}
        {!results.posted && !results.posting && (results.error || stale) && (
          <button type="button" className="ml-2 underline" onClick={results.retry}>
            Retry chat line
          </button>
        )}
      </p>
    </div>
  );
}

function PrizeLine({ round, run, busy }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => prizeForm(round.prize));
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-white-body">{prizeText(round.prize)}</p>
        <button
          type="button"
          className="cr-btn flex-none px-2"
          onClick={() => {
            setForm(prizeForm(round.prize));
            setEditing(true);
          }}
        >
          Edit prize
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-cr-keep-open="">
      <PrizeFields form={form} setForm={setForm} />
      <div className="flex gap-2">
        <button type="button" className="cr-btn" onClick={() => setEditing(false)}>
          Keep
        </button>
        <button
          type="button"
          className="cr-btn is-go"
          disabled={!!busy}
          onClick={async () => {
            const { ok } = await run({ action: 'update_prize', id: round.id, prize: prizePayload(form) });
            if (ok) setEditing(false);
          }}
        >
          Save prize
        </button>
      </div>
    </div>
  );
}

function Rack({ round, run, confirm, setConfirm, busy, track, now }) {
  const rack = round.rack || [];
  if (rack.length === 0) return <p className="cr-lbl mt-3">No balls drawn yet.</p>;
  return (
    <ol className="mt-3 space-y-1" aria-label="Rack">
      {rack.map((e) => {
        // Scratching mid-reveal would cut the takeover short (the server
        // refuses it too).
        const drawnAt = tsMillis(e.drawnAt);
        const revealing = drawnAt != null && now < drawnAt + DRAW_REVEAL_MS;
        const hint = revealing ? 'Wait for the reveal' : undefined;
        return (
        <li key={e.drawNo} className="flex items-center gap-2 text-sm">
          <span className="font-mono text-white/45">{pad2(e.drawNo)}</span>
          <span className={`min-w-0 flex-1 truncate ${e.scratched ? 'text-white/40 line-through' : 'text-white-body'}`}>
            <span>{e.slotName}</span> <span className="text-white/45">@{who(e)}</span>
          </span>
          {!e.scratched &&
            (confirm === `scratch:${e.drawNo}` ? (
              <button
                type="button"
                className="cr-btn is-go flex-none px-2"
                disabled={!!busy || revealing}
                title={hint}
                onClick={async () => {
                  setConfirm(null);
                  track(await run({ action: 'scratch', id: round.id, drawNo: e.drawNo }), { id: round.id, event: 'scratch', drawNo: e.drawNo });
                }}
              >
                Confirm scratch
              </button>
            ) : (
              <button type="button" className="cr-btn flex-none px-2" disabled={!!busy || revealing} title={hint} onClick={() => setConfirm(`scratch:${e.drawNo}`)}>
                Scratch
              </button>
            ))}
        </li>
        );
      })}
    </ol>
  );
}

function JustIn({ balls }) {
  const list = recentBalls(drumBalls(balls), 8);
  if (list.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="cr-lbl">just in</p>
      <ul className="mt-1 space-y-0.5">
        {list.map((b) => (
          <li key={b.id} className="flex justify-between gap-2 text-xs">
            <span className="text-white/70">{who(b)}</span>
            <span className="truncate text-white-body">{b.slotName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TwoPress({ id, confirm, setConfirm, label, confirmLabel, onConfirm, disabled }) {
  return confirm === id ? (
    <button
      type="button"
      className="cr-btn is-go"
      disabled={disabled}
      onClick={() => {
        setConfirm(null);
        onConfirm();
      }}
    >
      {confirmLabel}
    </button>
  ) : (
    <button type="button" className="cr-btn" disabled={disabled} onClick={() => setConfirm(id)}>
      {label}
    </button>
  );
}

function ActiveRound({ round, balls, ready, giveaway, reveals, drawAnnounce, track }) {
  const { busy, error, run } = useBallRun();
  const [confirm, setConfirm] = useState(null);
  const now = useClock({ intervalMs: 500 });
  const drum = drumBalls(balls);
  const drawn = drawnEntries(round);
  const last = tsMillis(round.lastDrawAt);
  const ballBusy = last != null && now < last + DRAW_REVEAL_MS;
  const gvwBusy = giveawayOnScreen(giveaway, now, reveals);
  const open = round.status === 'open';

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="cr-lbl">{open ? 'drum open · !slot' : 'lineup closed'}</p>
          <p className="cr-timecode">{open ? 'OPEN' : 'CLOSED'}</p>
        </div>
        <div className="text-right">
          <p className="cr-lbl">in the drum</p>
          <p className="cr-big text-orange-admin">{ready ? drum.length : '—'}</p>
        </div>
        <div className="text-right">
          <p className="cr-lbl">drawn</p>
          <p className="cr-big text-orange-admin">{drawn.length}</p>
        </div>
      </div>
      <PrizeLine round={round} run={run} busy={busy} />
      <HuntLink round={round} />
      {open && (
        <button
          type="button"
          className="cr-btn is-go mt-3 w-full"
          disabled={!!busy || ballBusy || gvwBusy}
          onClick={() => run({ action: 'draw', id: round.id })}
        >
          {ballBusy ? 'Ball on screen…' : gvwBusy ? 'Giveaway on screen…' : 'Draw ball'}
        </button>
      )}
      <Rack round={round} run={run} confirm={confirm} setConfirm={setConfirm} busy={busy} track={track} now={now} />
      {open && <JustIn balls={balls} />}
      {!open && <BallPayout round={round} />}
      <div className="mt-3 flex gap-2">
        {open ? (
          <TwoPress
            id="close"
            confirm={confirm}
            setConfirm={setConfirm}
            label="Close lineup"
            confirmLabel="Confirm close"
            disabled={!!busy}
            onConfirm={() => run({ action: 'close', id: round.id })}
          />
        ) : (
          <button type="button" className="cr-btn" disabled={!!busy} onClick={() => run({ action: 'reopen', id: round.id })}>
            Reopen
          </button>
        )}
        <TwoPress
          id="cancel"
          confirm={confirm}
          setConfirm={setConfirm}
          label="Cancel round"
          confirmLabel="Confirm cancel"
          disabled={!!busy}
          onConfirm={() => run({ action: 'cancel', id: round.id })}
        />
      </div>
      {error && <p className="mt-2 text-xs font-mono text-red-destructive">{error}</p>}
      {drawAnnounce.error && (
        <p className="mt-2 text-xs font-mono text-red-destructive">
          {`Chat line failed: ${drawAnnounce.error}`}
          <button type="button" className="ml-2 underline" onClick={drawAnnounce.retry}>
            Retry chat line
          </button>
        </p>
      )}
    </div>
  );
}

// Goofer Ball in the control room (spec: Control room). Open a drum, draw
// balls, scratch, close the lineup, pay out.
export default function BallTab() {
  const cr = useControlRoom();
  const round = cr.ballRound;
  const chat = useChatCheck();
  // A reopen right after a settle would swap the round the results line is
  // posted from: hold the button until that line has gone out.
  const settledMs = tsMillis(round && round.settledAt);
  const holdingResults =
    !!round && round.status === 'settled' && !!round.winner && !(round.announced && round.announced.results) && settledMs != null;
  const now = useClock({ intervalMs: 500, active: holdingResults });
  const waitForResults = holdingResults && now < settledMs + STREAM_DELAY_MS + WINNER_HOLD_MS;
  return (
    <div>
      {isActive(round) ? (
        <ActiveRound
          key={round.id}
          round={round}
          balls={cr.balls || []}
          ready={!!cr.ballsReady}
          giveaway={cr.giveaway}
          reveals={cr.reveals}
          drawAnnounce={cr.ballDrawAnnounce}
          track={chat.track}
        />
      ) : (
        <>
          {round && round.status === 'settled' && round.winner ? (
            <LastWinner round={round} results={cr.ballResults} />
          ) : (
            <>
              <p className="cr-lbl">goofer ball</p>
              <p className="cr-timecode is-quiet">IDLE</p>
              <p className="mt-2 text-sm text-white/55">No drum open.</p>
            </>
          )}
          <OpenForm key={round ? round.id : 'none'} initial={round && round.prize} track={chat.track} waitForResults={waitForResults} />
        </>
      )}
      {chat.fail && round && chat.fail.id === round.id && (
        <p className="mt-2 text-xs font-mono text-red-destructive">
          {`Chat line failed: ${chat.fail.reason}`}
          <button type="button" className="ml-2 underline" onClick={chat.retry}>
            Retry chat line
          </button>
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Link to="/gamba/ball" className="cr-lbl hover:text-white-body">
          CH 42 ↗
        </Link>
      </div>
    </div>
  );
}
