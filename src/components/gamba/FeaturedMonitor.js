import { Link } from 'react-router-dom';
import Monitor from '../onAir/Monitor';
import Chip from '../onAir/Chip';
import OnAirButton from '../onAir/OnAirButton';
import { Chips, Eyebrow, Hero, HeroRow, Question, Stage } from '../hunts/MonitorStage';
import { formatAvg, formatAvgFigure, signedMoney } from '../hunts/huntStats';
import { tickerItems } from '../hunts/huntBoard';
import { formatClock } from '../hunts/huntTime';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel } from '../../utils/huntFormat';
import { GAMBA_TOOLS, channelLabel } from '../../data/gambaTools';
import { leaderboardFacts, progressModel } from './guide';

// The guide's featured monitor (spec Part 4): one Monitor that shows Hunts
// while it is on air and the leaderboard otherwise. One instance, so the
// channel-change static plays when the takeover starts or ends.

const CH = Object.fromEntries(GAMBA_TOOLS.map((t) => [t.id, channelLabel(t)]));
const TAGS = {
  open: { tag: 'Open', tone: 'signal', readout: { label: 'Entries open', tone: 'signal' } },
  locked: { tag: 'Closed', tone: 'muted', readout: { label: 'Entries closed', tone: 'muted' } },
  offair: { tag: 'On air', tone: 'muted', readout: { label: 'Hunt live', tone: 'signal' } },
};

function Cta({ ghost, to, children }) {
  return (
    <div className="mt-2 flex justify-center">
      <OnAirButton as={Link} to={to} variant={ghost ? 'ghost' : 'viewer'} size="sm" className="min-h-11">
        {children}
      </OnAirButton>
    </div>
  );
}

// One notch per bonus (opened in signal-deep), or a bar past 60 bonuses.
// Set dressing: the opened count is in the hero's label.
function Progress({ model }) {
  if (!model) return null;
  if (model.style === 'bar') {
    return (
      <div className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-onair-ink-7" aria-hidden="true">
        <div className="h-full rounded-full bg-onair-signal-deep" style={{ width: `${(model.opened / model.total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-xl gap-1" aria-hidden="true" data-testid="hunt-notches">
      {Array.from({ length: model.total }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-full ${i < model.opened ? 'bg-onair-signal-deep' : 'bg-onair-ink-7'}`} />
      ))}
    </div>
  );
}

function RoundChip({ feature }) {
  if (feature.mode === 'open') {
    return (
      <Chip tone="signal">
        Predictions open · <b>{feature.guessCount}</b> in
      </Chip>
    );
  }
  if (feature.mode === 'locked') {
    return (
      <Chip>
        Entries closed · <b>{feature.guessCount}</b> {feature.guessCount === 1 ? 'guess' : 'guesses'}
      </Chip>
    );
  }
  return null;
}

function LiveHuntScreen({ feature, money }) {
  const { stats, hunt } = feature;
  const opened = stats.bonuses.length ? ` · ${stats.openedCount}/${stats.bonusCount} opened` : '';
  const side = [
    stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
    stats.stillNeedAvg != null && { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg) },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{huntTypeLabel(hunt.huntType)} hunt · Opening bonuses</Eyebrow>}>
      <HeroRow hero={<Hero text={money(stats.wonSoFar)} label={`Won so far${opened}`} />} side={side} />
      <Progress model={progressModel(stats)} />
      <Chips>
        <RoundChip feature={feature} />
      </Chips>
      {feature.mode === 'open' ? <Cta to="/gamba/hunts">Get your guess in</Cta> : <Cta ghost to="/gamba/hunts">Watch the opening</Cta>}
    </Stage>
  );
}

function PreHuntScreen({ feature, money }) {
  const { stats, round } = feature;
  const hero =
    stats.requiredAvg != null ? (
      <Hero text={formatAvgFigure(stats.requiredAvg)} suffix="x" label="Required avg to break even" />
    ) : stats.startCost != null ? (
      <Hero text={money(stats.startCost)} label="Break-even" />
    ) : null;
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{round.title} · {feature.mode === 'open' ? 'Predictions open' : 'Entries closed'}</Eyebrow>}>
      <Question>What does the hunt pay?</Question>
      {hero && <HeroRow hero={hero} side={[]} />}
      <Chips>
        {stats.bonusCount ? (
          <Chip>
            <b>{stats.bonusCount}</b> bonuses
          </Chip>
        ) : null}
        <RoundChip feature={feature} />
      </Chips>
      {feature.mode === 'open' ? <Cta to="/gamba/hunts">Get your guess in</Cta> : <Cta ghost to="/gamba/hunts">See the round</Cta>}
    </Stage>
  );
}

function LeaderboardScreen({ facts }) {
  if (facts.loading) {
    return (
      <Stage eyebrow={<Eyebrow tone="muted">Tuning…</Eyebrow>}>
        <Question>Monthly leaderboard</Question>
      </Stage>
    );
  }
  if (facts.noSignal) {
    return (
      <Stage eyebrow={<Eyebrow tone="muted">No signal</Eyebrow>}>
        <Question>No signal</Question>
        <p className="text-sm text-onair-ink-4">We can’t reach the standings right now. Refresh to retune.</p>
      </Stage>
    );
  }
  const side = [
    facts.leader && { label: 'Leader', value: `${facts.leader.name} · ${facts.leader.wagered}` },
    facts.leader && facts.leader.prize && { label: '1st prize', value: facts.leader.prize },
    facts.lead && { label: 'Lead', value: facts.lead },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="muted">Code BEAN on Rainbet · Monthly pool</Eyebrow>}>
      <HeroRow hero={<Hero text={facts.pool || '—'} label={facts.period || 'Current period'} />} side={side} />
      <Cta ghost to="/gamba/leaderboard">View standings</Cta>
    </Stage>
  );
}

export default function FeaturedMonitor({ featured, feature, leaderboard, resets, now, ready }) {
  if (featured === 'hunts' && feature) {
    const money = (v) => formatMoney(v, feature.currency);
    const signed = (v) => signedMoney(v, feature.currency);
    const tags = TAGS[feature.mode] || TAGS.offair;
    const items = tickerItems(feature.mode, {
      stats: feature.stats,
      guessCount: feature.guessCount,
      prize: feature.prize,
      isLive: feature.kind === 'live',
      money,
      signed,
    });
    return (
      <Monitor
        label="Featured channel"
        tint="signal"
        status={feature.kind === 'live' ? 'live' : null}
        channel={`${CH.hunts} · Hunts`}
        clock={formatClock(now)}
        channelKey={ready ? 'hunts' : null}
        readout={{ channel: CH.hunts, ...tags.readout }}
        chyron={items.length ? { tag: tags.tag, tone: tags.tone, items } : null}
      >
        <div className="[--hero-share:0.9] sm:[--hero-share:0.55]" style={{ containerType: 'inline-size' }}>
          {feature.kind === 'live' ? <LiveHuntScreen feature={feature} money={money} /> : <PreHuntScreen feature={feature} money={money} />}
        </div>
      </Monitor>
    );
  }

  const facts = leaderboardFacts(leaderboard);
  const clock = resets ? { long: resets.toUpperCase(), short: resets.toUpperCase() } : null;
  const standings = facts.standings || [];
  return (
    <Monitor
      label="Featured channel"
      tint="neutral"
      status={null}
      channel={`${CH.leaderboard} · Leaderboard${facts.period ? ` · ${facts.period}` : ''}`}
      clock={clock}
      channelKey={ready ? 'leaderboard' : null}
      readout={{ channel: CH.leaderboard, label: facts.noSignal ? 'No signal' : 'Standings', tone: 'muted' }}
      chyron={standings.length ? { tag: 'Standings', tone: 'muted', items: standings } : null}
    >
      <div className="[--hero-share:0.9] sm:[--hero-share:0.55]" style={{ containerType: 'inline-size' }}>
        <LeaderboardScreen facts={facts} />
      </div>
    </Monitor>
  );
}
