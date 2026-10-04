import Monitor from '../onAir/Monitor';
import Chip from '../onAir/Chip';
import { fitFigure } from '../onAir/fit';
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';
import { formatAvg, formatAvgFigure, signedMoney, winnerPrizeText } from './huntStats';
import { entryName } from './huntBoard';
import HuntMeter from './HuntMeter';
import { Chips, Eyebrow, Hero, HeroRow, Question, Stage } from './MonitorStage';
import ViewerAvatar from './ViewerAvatar';
import { GAMBA_TOOLS, channelLabel } from '../../data/gambaTools';

// The Hunts tab's stage: one screen per mode on the On Air Monitor (spec
// "What each mode shows"). Screen content is the size container for the
// fitted hero; --hero-share shrinks the hero when side stats join its row.

const CH = channelLabel(GAMBA_TOOLS.find((t) => t.id === 'hunts'));
const SCREENS = {
  tuning: { tint: 'neutral', status: null, readout: { channel: CH, label: 'Tuning', tone: 'muted' } },
  open: { tint: 'signal', status: 'live', tag: 'Open', tone: 'signal', readout: { channel: CH, label: 'Entries open', tone: 'signal' } },
  locked: { tint: 'signal', status: 'live', tag: 'Closed', tone: 'muted', readout: { channel: CH, label: 'Entries closed', tone: 'muted' } },
  settled: { tint: 'winner', status: 'replay', tag: 'Final', tone: 'winner', readout: { channel: CH, label: 'Entries closed', tone: 'muted' } },
  offair: { tint: 'neutral', status: 'replay', tag: 'Off air', tone: 'muted', readout: { channel: CH, label: 'No round', tone: 'muted' } },
};

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

function BonusChip({ count }) {
  if (!count) return null;
  return (
    <Chips>
      <Chip>
        <b>{count}</b> bonuses
      </Chip>
    </Chips>
  );
}

function OffAirStage({ stats, money, currency, offair }) {
  if (offair.noSignal) {
    return (
      <Stage eyebrow={<Eyebrow tone="muted">No signal</Eyebrow>}>
        <Question>No signal</Question>
        <p className="text-sm text-onair-ink-4">We can’t reach the round right now. Refresh to retune.</p>
      </Stage>
    );
  }
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
        <BonusChip count={stats.bonusCount} />
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
      <BonusChip count={stats.bonusCount} />
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
  const base = SCREENS[mode] || SCREENS.offair;
  const screen =
    mode === 'offair' && offair && offair.noSignal ? { ...base, readout: { channel: CH, label: 'No signal', tone: 'muted' } } : base;
  const status = mode === 'offair' && offair && offair.isLive ? 'live' : screen.status;
  const money = (v) => formatMoney(v, currency);
  const chyron = screen.tag && ticker && ticker.length ? { tag: screen.tag, tone: screen.tone, items: ticker } : null;
  return (
    <Monitor
      tint={screen.tint}
      status={status}
      channel={`${CH} · Hunts`}
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
