import Monitor from '../onAir/Monitor';
import Chip from '../onAir/Chip';
import { MONO } from '../onAir/classes';
import { fitFigure } from '../onAir/fit';
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';
import { formatAvg, formatAvgFigure, signedMoney, winnerPrizeText } from './huntStats';
import { entryName } from './huntBoard';
import HuntMeter from './HuntMeter';
import ViewerAvatar from './ViewerAvatar';

// The Hunts tab's stage: one screen per mode on the On Air Monitor (spec
// "What each mode shows"). Screen content is the size container for the
// fitted hero; --hero-share shrinks the hero when side stats join its row.

const SCREENS = {
  tuning: { tint: 'neutral', status: null, readout: { label: 'CH 02 · Tuning', tone: 'muted' } },
  open: { tint: 'signal', status: 'live', tag: 'Open', tone: 'signal', readout: { label: 'CH 02 · Entries open', tone: 'signal' } },
  locked: { tint: 'signal', status: 'live', tag: 'Closed', tone: 'muted', readout: { label: 'CH 02 · Entries closed', tone: 'muted' } },
  settled: { tint: 'winner', status: 'replay', tag: 'Final', tone: 'winner', readout: { label: 'CH 02 · Entries closed', tone: 'muted' } },
  offair: { tint: 'neutral', status: 'replay', tag: 'Off air', tone: 'muted', readout: { label: 'CH 02 · No round', tone: 'muted' } },
};

const EYEBROW = { signal: 'text-onair-signal', winner: 'text-onair-winner-warm', muted: 'text-onair-ink-4' };
const HERO = { ink: 'text-onair-ink-1', loss: 'text-onair-loss', signal: 'text-onair-signal-light' };

function Eyebrow({ tone, children }) {
  return (
    <p className={`${MONO} text-[0.6875rem] tracking-[0.3em] [overflow-wrap:anywhere] sm:text-xs ${EYEBROW[tone]}`}>
      {children}
    </p>
  );
}

function Question({ children }) {
  return <h2 className="text-[1.375rem] font-bold tracking-[-0.01em] text-onair-ink-3 sm:text-3xl">{children}</h2>;
}

function Hero({ text, suffix = null, label, tone = 'ink' }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col items-center gap-1.5">
      <p
        className={`whitespace-nowrap font-extrabold leading-[0.9] tracking-[-0.03em] tabular-nums ${HERO[tone]}`}
        style={{ fontSize: fitFigure(`${text}${suffix || ''}`, { min: 3.25, max: 6 }) }}
      >
        {text}
        {suffix && <span className="text-[0.58em] text-onair-signal-light">{suffix}</span>}
      </p>
      {label && <p className={`${MONO} text-[0.6875rem] tracking-[0.25em] text-onair-ink-5`}>{label}</p>}
    </div>
  );
}

function SideStats({ items }) {
  if (!items.length) return null;
  return (
    <>
      <span className="hidden h-[84px] w-px bg-white/10 sm:block" aria-hidden="true" />
      <dl className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:flex-col sm:items-start sm:gap-2 sm:pb-1">
        {items.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5 text-sm text-onair-ink-5">
            <dt>{s.label}</dt>
            <dd className="text-lg font-bold tabular-nums text-onair-ink-1">{s.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function HeroRow({ hero, side }) {
  return (
    <div className="mt-1 flex w-full flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-center sm:gap-7">
      {hero}
      <SideStats items={side} />
    </div>
  );
}

function Chips({ children }) {
  return <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{children}</div>;
}

function Stage({ eyebrow, children }) {
  return (
    <div className="flex flex-col items-center gap-3 pb-1.5 pt-6 text-center sm:pt-[30px]">
      {eyebrow}
      {children}
    </div>
  );
}

// Open hero: required avg, else the start cost as break-even, else nothing.
function openHero(stats, money) {
  if (stats.requiredAvg != null) {
    return <Hero text={formatAvgFigure(stats.requiredAvg)} suffix="x" label="Required avg to break even" />;
  }
  if (stats.startCost != null) return <Hero text={money(stats.startCost)} label="Break-even" />;
  return null;
}

function OpenStage({ round, stats, money, guessCount, prize }) {
  const hero = openHero(stats, money);
  const side = [
    stats.totalBet != null && { label: 'Total bet', value: money(stats.totalBet) },
    stats.avgBet != null && { label: 'Avg bet', value: money(stats.avgBet) },
    stats.requiredAvg != null && stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{round.title} · Predictions open</Eyebrow>}>
      <Question>What does the hunt pay?</Question>
      {hero && <HeroRow hero={hero} side={side} />}
      <Chips>
        {stats.bonusCount ? (
          <Chip>
            <b>{stats.bonusCount}</b> bonuses
          </Chip>
        ) : null}
        <Chip tone="signal">
          <b>{guessCount}</b> {guessCount === 1 ? 'guess' : 'guesses'} in
        </Chip>
        {prize && <Chip>Closest takes {prize}</Chip>}
      </Chips>
    </Stage>
  );
}

function LockedStage({ round, stats, money, guessCount, prize, chatMedian }) {
  const hasBonuses = stats.bonuses.length > 0;
  const hero = hasBonuses ? (
    <Hero text={money(stats.wonSoFar)} label={`Won so far · ${stats.openedCount}/${stats.bonusCount} opened`} />
  ) : (
    openHero(stats, money)
  );
  const heroIsCost = !hasBonuses && stats.requiredAvg == null;
  const side = [
    stats.startCost != null && !heroIsCost && { label: 'Start cost', value: money(stats.startCost) },
    stats.stillNeedAvg != null && { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg) },
    chatMedian != null && { label: 'Chat median', value: money(chatMedian) },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{round.title} · Entries closed · Opening bonuses</Eyebrow>}>
      <Question>Bonuses opening</Question>
      {hero && <HeroRow hero={hero} side={side} />}
      <Chips>
        {stats.bonusCount ? (
          <Chip>
            <b>{stats.bonusCount}</b> bonuses
          </Chip>
        ) : null}
        <Chip>
          <b>{guessCount}</b> {guessCount === 1 ? 'guess' : 'guesses'}
        </Chip>
        {prize && <Chip>Closest takes {prize}</Chip>}
      </Chips>
    </Stage>
  );
}

function SettledStage({ round, currency, winner }) {
  const actual = round.actual && round.actual.payout;
  if (!winner) {
    return (
      <Stage eyebrow={<Eyebrow tone="winner">{round.title} · Final payout</Eyebrow>}>
        <Hero text={formatMoney(actual, currency)} label="No eligible guesses" />
      </Stage>
    );
  }
  const name = entryName(winner);
  const prize = winnerPrizeText(winner.prize);
  return (
    <Stage eyebrow={<Eyebrow tone="winner">{round.title} · And the closest guess is</Eyebrow>}>
      <ViewerAvatar
        src={winner.profileImageUrl}
        name={name}
        className="mt-2.5 h-[84px] w-[84px] bg-gradient-to-br from-onair-signal to-onair-signal-deep text-[2.25rem] text-onair-winner-ink shadow-onair-winner-ring sm:h-[108px] sm:w-[108px] sm:text-[2.625rem]"
      />
      <p
        className="max-w-full truncate font-extrabold leading-none tracking-[-0.025em]"
        style={{ fontSize: fitFigure(name, { min: 2.25, max: 3.75, share: '0.9' }) }}
      >
        {name}
      </p>
      <Chips>
        <Chip>
          Guessed <b>{formatMoney(winner.payoutGuess, currency, { decimals: 0 })}</b>
        </Chip>
        <Chip>
          Actual <b className="text-onair-winner-light">{formatMoney(actual, currency)}</b>
        </Chip>
        {prize && <Chip tone="winner">{prize}</Chip>}
      </Chips>
    </Stage>
  );
}

function OffAirStage({ stats, money, currency, offair }) {
  if (!offair.hasHunt) {
    return (
      <Stage eyebrow={<Eyebrow tone="muted">Off air</Eyebrow>}>
        <Question>Nothing on right now</Question>
        <p className="text-sm text-onair-ink-4">Predictions open when Goofer starts a round.</p>
      </Stage>
    );
  }
  if (offair.isLive) {
    const progress = stats.bonuses.length > 0 ? ` · ${stats.openedCount}/${stats.bonusCount} opened` : '';
    const side = [
      stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
      stats.stillNeedAvg != null && { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg) },
    ].filter(Boolean);
    return (
      <Stage eyebrow={<Eyebrow tone="signal">Hunt in progress · {offair.title}</Eyebrow>}>
        <Question>Predictions aren’t open this hunt</Question>
        <HeroRow hero={<Hero text={money(stats.wonSoFar)} label={`Won so far${progress}`} />} side={side} />
      </Stage>
    );
  }
  const side = [
    stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
    stats.won != null && stats.result != null && { label: 'Won', value: money(stats.won) },
    stats.avgMulti != null && { label: 'Avg multi', value: formatMultiplier(stats.avgMulti) },
  ].filter(Boolean);
  const hero =
    stats.result != null ? (
      <Hero text={signedMoney(stats.result, currency)} label="Result" tone={stats.result < 0 ? 'loss' : 'signal'} />
    ) : (
      <Hero text={money(stats.won)} label="Won" />
    );
  return (
    <Stage eyebrow={<Eyebrow tone="muted">Last hunt · {offair.title}</Eyebrow>}>
      <HeroRow hero={hero} side={side} />
    </Stage>
  );
}

export default function HuntMonitor({
  mode,
  round,
  stats,
  meter,
  currency,
  guessCount,
  prize,
  winner,
  chatMedian,
  offair,
  clock,
  ticker,
  phrase,
}) {
  const screen = SCREENS[mode] || SCREENS.offair;
  const status = mode === 'offair' && offair && offair.isLive ? 'live' : screen.status;
  const money = (v) => formatMoney(v, currency);
  const chyron = screen.tag && ticker && ticker.length ? { tag: screen.tag, tone: screen.tone, items: ticker } : null;
  return (
    <Monitor
      tint={screen.tint}
      status={status}
      channel="CH 02 · Hunts"
      clock={clock}
      channelKey={mode === 'tuning' ? null : mode}
      readout={screen.readout}
      chyron={chyron}
    >
      <div className="[--hero-share:0.9] sm:[--hero-share:0.55]" style={{ containerType: 'inline-size' }}>
        {mode === 'tuning' && (
          <Stage eyebrow={<Eyebrow tone="signal">{phrase}</Eyebrow>}>
            <Question>What does the hunt pay?</Question>
          </Stage>
        )}
        {mode === 'open' && <OpenStage round={round} stats={stats} money={money} guessCount={guessCount} prize={prize} />}
        {mode === 'locked' && (
          <LockedStage round={round} stats={stats} money={money} guessCount={guessCount} prize={prize} chatMedian={chatMedian} />
        )}
        {mode === 'settled' && <SettledStage round={round} currency={currency} winner={winner} />}
        {mode === 'offair' && <OffAirStage stats={stats} money={money} currency={currency} offair={offair} />}
        {meter && <HuntMeter meter={meter} currency={currency} />}
      </div>
    </Monitor>
  );
}
