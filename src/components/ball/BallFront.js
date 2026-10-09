import { useState } from 'react';
import Panel from '../onAir/Panel';
import { MONO } from '../onAir/classes';
import ChannelSet from './ChannelSet';
import DrumRig from './DrumRig';
import SlotFinder from './SlotFinder';
import { settledRows } from '../../utils/ballResults';
import { drawnEntries, drumBalls, formatMulti, isActive, leaderRow, liveRows, pad2, prizeText, takenSlots, who } from '../../utils/ball';
import { tsMillis } from '../../utils/giveaway';
import './ball.css';

const LABEL = `${MONO} text-[0.625rem] tracking-[0.2em] text-onair-ink-5`;

function dayLabel(ts) {
  const ms = tsMillis(ts);
  return ms == null ? '—' : new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A panel that folds away below lg (phones see the essentials first).
function Fold({ id, title, aside, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel as="section" aria-labelledby={id} className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[1.125rem] font-extrabold">
          {title}
        </h2>
        {aside && <span className={LABEL}>{aside}</span>}
      </div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${MONO} mt-2 text-[0.6875rem] tracking-[0.18em] text-onair-ink-4 lg:hidden`}>
        {open ? 'Hide' : 'Show'}
      </button>
      <div className={open ? 'mt-3 block' : 'mt-3 hidden lg:block'}>{children}</div>
    </Panel>
  );
}

function ActiveFacts({ round, drum }) {
  return (
    <>
      <p className="mt-3">
        <span className={`${MONO} inline-flex items-center gap-1.5 rounded-full bg-onair-live px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.18em] text-white`}>
          ● {round.status === 'open' ? 'Drum open' : 'Lineup closed'}
        </span>
      </p>
      <p className="mt-2 font-display text-[clamp(2.5rem,6vw,4rem)] leading-none text-white">{drum.length}</p>
      <p className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-wgoof-title-dim`}>
        {`Balls in the drum · ${drawnEntries(round).length} drawn`}
      </p>
      <p className={`${MONO} mt-2 inline-block bg-onair-paper px-2.5 py-1 text-[0.6875rem] font-bold tracking-[0.15em] text-onair-paper-ink`}>
        {`Top multi wins ${prizeText(round.prize)}`}
      </p>
    </>
  );
}

function SetStrip({ round, balls, still, lastWinner, children }) {
  const active = isActive(round);
  const drum = drumBalls(balls);
  return (
    <section aria-labelledby="ball-title" className="relative overflow-hidden rounded-onair-card shadow-onair-card">
      <ChannelSet fine={null} title={false} bug={false} live={false} />
      <div className="relative flex flex-wrap items-center gap-5 p-5 sm:p-6">
        <DrumRig balls={drum} count={drum.length} still={still} className="w-28 shrink-0 sm:w-40" />
        <div className="min-w-[12rem] flex-1">
          <h2 id="ball-title" className="gb-title font-display text-[clamp(1.75rem,4vw,3rem)] uppercase leading-none">
            Goofer Ball
          </h2>
          <p className={`${MONO} mt-1 text-[0.6875rem] font-bold tracking-[0.28em] text-onair-wgoof-title-dim`}>WGOOF · Channel 42 · Nightly draw</p>
          {active ? (
            <ActiveFacts round={round} drum={drum} />
          ) : (
            <>
              {lastWinner && (
                <p className="mt-3 text-[0.9375rem] font-bold text-onair-wgoof-title">
                  {`Last winning ball: ${lastWinner.winner.slotName} · ${formatMulti(lastWinner.winner.multiplier)} · @${who(lastWinner.winner)}`}
                </p>
              )}
              <p className="mt-2 text-[0.9375rem] text-onair-wgoof-title">Drum's closed. Next draw whenever the drum opens on stream.</p>
            </>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

const BALL_STATUS = { drum: 'In the drum', drawn: 'On the rack', scratched: 'Scratched, call another slot' };

function YourBall({ ball }) {
  return (
    <Panel as="section" aria-labelledby="ball-mine" className="p-4 ring-1 ring-onair-signal/40">
      <h2 id="ball-mine" className="text-[1.125rem] font-extrabold">
        Your ball
      </h2>
      <p className="mt-2 text-[0.9375rem] font-bold">{ball.slotName}</p>
      <p className={`${MONO} mt-1 text-[0.6875rem] tracking-[0.18em] text-onair-signal-light`}>
        {ball.status === 'drawn' && ball.drawNo ? `On the rack · Ball ${pad2(ball.drawNo)}` : BALL_STATUS[ball.status] || BALL_STATUS.drum}
      </p>
    </Panel>
  );
}

function DrumList({ balls, me }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const list = needle ? balls.filter((b) => `${who(b)} ${b.slotName}`.toLowerCase().includes(needle)) : balls;
  return (
    <Fold id="ball-drum" title="In the drum" aside={`${balls.length} called`}>
      <label className="block">
        <span className="sr-only">Find a ball</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find my ball…"
          className="w-full rounded-onair-tile border border-white/10 bg-transparent px-3 py-2 font-onair-mono text-[0.75rem] text-onair-ink-1 placeholder:text-onair-ink-5"
        />
      </label>
      <ul className="mt-2">
        {list.map((b) => (
          <li key={b.id} className={`flex items-center gap-3 border-t border-white/5 px-1 py-1.5 ${b.twitchId === me ? 'rounded-onair-tile bg-onair-signal/10' : ''}`}>
            <span className="gb-ball h-4 w-4 shrink-0 rounded-full" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-bold">
              {b.slotName}
              <span className="block font-onair-mono text-[0.6875rem] font-normal text-onair-viewer-light">@{who(b)}</span>
            </span>
            {b.twitchId === me && <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-signal`}>Your ball</span>}
            {b.twitchId !== me && b.status === 'drawn' && <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-winner-light`}>On the rack</span>}
          </li>
        ))}
      </ul>
    </Fold>
  );
}

function RackPanel({ round, hunt, stale }) {
  const rows = liveRows(round, hunt);
  const leader = leaderRow(rows);
  const aside = round.huntId ? (stale ? 'Stale · retrying' : 'Live from the hunt · 60s') : 'No hunt linked yet';
  return (
    <Panel as="section" aria-labelledby="ball-rack" className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ball-rack" className="text-[1.125rem] font-extrabold">
          Tonight's rack
        </h2>
        <span className={LABEL}>{aside}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-[0.875rem] text-onair-ink-4">No balls drawn yet.</p>
      ) : (
        <ol className="mt-2">
          {rows.map((r) => (
            <li key={r.drawNo} className="flex items-center gap-3 border-t border-white/5 py-1.5">
              <span className="gb-ball flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-onair-mono text-[0.625rem] font-bold text-onair-paper-ink">{pad2(r.drawNo)}</span>
              <span className="min-w-0 flex-1 truncate text-[0.875rem] font-bold">
                {r.slotName}
                <span className="block font-onair-mono text-[0.6875rem] font-normal text-onair-viewer-light">@{who(r)}</span>
              </span>
              {leader && leader.drawNo === r.drawNo && <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-winner-light`}>Leader</span>}
              <span className={`font-display text-[1.25rem] ${leader && leader.drawNo === r.drawNo ? 'text-onair-winner' : 'text-onair-ink-1'}`}>{formatMulti(r.multiplier)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function PastRow({ round }) {
  const [open, setOpen] = useState(false);
  const w = round.winner;
  const day = dayLabel(round.settledAt);
  return (
    <li className="border-t border-white/5 py-2">
      <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
        <span className={`${MONO} text-[0.6875rem] tracking-[0.15em] text-onair-ink-4`}>{day}</span>
        <span className="min-w-0 truncate text-[0.875rem] font-bold">
          {w.slotName}
          <span className="block font-onair-mono text-[0.6875rem] font-normal text-onair-viewer-light">{`@${who(w)} · ${prizeText(round.prize)}`}</span>
        </span>
        <span className="font-display text-[1.25rem] text-onair-winner-warm">{formatMulti(w.multiplier)}</span>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Show the rack for ${day}`}
        onClick={() => setOpen((o) => !o)}
        className={`${MONO} mt-1 text-[0.625rem] tracking-[0.18em] text-onair-ink-4`}
      >
        {open ? 'Hide rack' : 'Rack'}
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {settledRows(round).map((r) => (
            <li key={r.drawNo} className={`${MONO} rounded-full bg-white/5 px-2.5 py-1 text-[0.625rem] tracking-[0.15em] text-onair-ink-3`}>
              {`${pad2(r.drawNo)} ${r.slotName} ${formatMulti(r.multiplier)}`}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PastDraws({ past, loading, error, hasMore, onLoadMore }) {
  const settled = past.filter((r) => r.winner);
  return (
    <Fold id="ball-past" title="Past draws" aside="Winning balls">
      {settled.length === 0 && !loading && <p className="text-[0.875rem] text-onair-ink-4">{error ? 'No signal from the archive.' : 'No draws yet.'}</p>}
      <ul>
        {settled.map((r) => (
          <PastRow key={r.id} round={r} />
        ))}
      </ul>
      {hasMore && (
        <button type="button" onClick={onLoadMore} className={`${MONO} mt-3 text-[0.6875rem] tracking-[0.18em] text-onair-ink-3`}>
          Load more
        </button>
      )}
    </Fold>
  );
}

// CH 42 · Goofer Ball (spec: Site page). Pure: data comes in as props from
// useBallData (or a fixture).
export default function BallFront({ round, balls = [], hunt = null, stale = false, me = null, past = [], pastLoading = false, pastError = false, hasMore = false, onLoadMore, still = false }) {
  if (round === undefined) {
    return (
      <p role="status" className={`gb-site ${MONO} px-4 py-16 text-center text-xs font-bold tracking-[0.25em] text-onair-ink-3 motion-safe:animate-pulse`}>
        Tuning to Channel 42…
      </p>
    );
  }
  const active = isActive(round);
  const lastWinner = (round && round.status === 'settled' && round.winner ? round : null) || past.find((r) => r.winner) || null;
  const mine = active && me ? balls.find((b) => b.twitchId === me) : null;
  return (
    <div className="gb-site space-y-4 font-onair text-onair-ink-1">
      <SetStrip round={round} balls={active ? balls : []} still={still} lastWinner={lastWinner}>
        {active && round.status === 'open' && (
          <div className="w-full lg:w-[24rem]">
            <SlotFinder taken={takenSlots(round, balls)} />
          </div>
        )}
      </SetStrip>
      {mine && <YourBall ball={mine} />}
      {active && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RackPanel round={round} hunt={hunt} stale={stale} />
          <DrumList balls={balls} me={me} />
        </div>
      )}
      <PastDraws past={past} loading={pastLoading} error={pastError} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}
