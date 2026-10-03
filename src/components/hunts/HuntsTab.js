import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel } from '../../utils/huntFormat';
import { roundCurrency } from '../../utils/predictionRound';
import useTuningPhrase from '../../hooks/useTuningPhrase';
import SuggestionSubmit from '../SuggestionSubmit';
import SuggestionList from '../SuggestionList';
import CommunityHuntsPromo from './CommunityHuntsPromo';
import { huntMode, huntStats, median, signedMoney, tabHuntRef, topPrizeText, winnerPrizeText } from './huntStats';
import { entryName, guessOf, guessPosition, meterModel, rankEntries, tickerItems } from './huntBoard';
import { formatEpisodeDate, screenClock } from './huntTime';
import useHunt from './useHunt';
import useNow from './useNow';
import HuntMonitor from './HuntMonitor';
import HuntLineup from './HuntLineup';
import HuntRecap from './HuntRecap';
import HuntSlip from './HuntSlip';
import RunnerUpCard from './RunnerUpCard';
import PastEpisodes from './PastEpisodes';

const RECAP = {
  docket: 'On the docket',
  opening: 'Opening now',
  final: 'Hunt recap',
};

function recapKind(mode, isLive) {
  if (mode === 'open') return 'docket';
  if (mode === 'locked') return 'opening';
  if (mode === 'offair' && isLive) return 'opening';
  return 'final';
}

const episodeTitle = (h) => `${huntTypeLabel(h.huntType)} hunt · ${formatEpisodeDate(h.endedAt || h.startedAt)}`;

// The Hunts tab, composed from raw data: the latest round (undefined while
// loading), its entries (empty while sealed), the viewer's entry, and the
// communityhunts overview. Two columns from lg; below lg the columns become
// display:contents and the pieces reorder so the slip sits under the monitor.
export default function HuntsTab({ round, entries = [], sealed = false, myEntry = null, viewer = null, onSignIn, live = null, recent = [] }) {
  const loading = round === undefined;
  const r = loading ? null : round;
  const mode = loading ? 'tuning' : huntMode(r);
  const myId = viewer ? viewer.twitchId : null;

  const ref = tabHuntRef(r, live, recent);
  const tab = useHunt(ref.huntId, ref.summary);
  const [episodeId, setEpisodeId] = useState(null);
  const episodes = (recent || []).filter((h) => h.id !== ref.huntId);
  const episodeSummary = episodes.find((h) => h.id === episodeId) || null;
  const episode = useHunt(episodeSummary ? episodeSummary.id : null, episodeSummary);
  const recapRef = useRef(null);

  const phrase = useTuningPhrase(loading);
  const now = useNow(30 * 1000, mode === 'open' || mode === 'locked' || (mode === 'offair' && ref.isLive));

  useEffect(() => {
    if (episodeId && recapRef.current && typeof recapRef.current.scrollIntoView === 'function') {
      recapRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [episodeId]);

  const currency = roundCurrency(r) || (tab.hunt && tab.hunt.currency) || null;
  const stats = huntStats(tab.hunt, r);
  const prize = topPrizeText(r);
  const winners = ((r && r.winners) || []).filter(Boolean);
  const winner = winners.find((w) => w.place === 1) || null;
  const runnerUp = winners.find((w) => w.place === 2) || null;
  const revealed = sealed ? [] : entries;
  const guessCount = sealed ? (r && r.entryCount) || 0 : revealed.filter((e) => guessOf(e) != null).length;
  const chatMedian = mode === 'locked' || mode === 'settled' ? median(revealed.map(guessOf)) : null;
  const meter = meterModel({ mode, sealed, entries: revealed, myEntry, myId, startCost: stats.startCost, wonSoFar: stats.wonSoFar, round: r });
  const offair = { isLive: ref.isLive, hasHunt: !!tab.hunt, title: tab.hunt ? `${huntTypeLabel(tab.hunt.huntType)} hunt` : null };
  const ticker =
    mode === 'tuning'
      ? []
      : tickerItems(mode, {
          stats,
          guessCount,
          prize,
          winner: winner && { name: entryName(winner), prize: winnerPrizeText(winner.prize) },
          runnerUp: runnerUp && { name: entryName(runnerUp), prize: winnerPrizeText(runnerUp.prize) },
          isLive: ref.isLive,
          money: (v) => formatMoney(v, currency),
          signed: (v) => signedMoney(v, currency),
        });
  const clock = screenClock(mode, { round: r, hunt: tab.hunt, now, isLive: ref.isLive });

  const actual = r && r.actual && r.actual.payout;
  const ranked = mode === 'settled' && typeof actual === 'number' ? rankEntries(revealed, actual) : [];
  const myRankIndex = myId ? ranked.findIndex((e) => (e.twitchId || e.id) === myId) : -1;
  const rank = myRankIndex >= 0 ? { place: myRankIndex + 1, of: ranked.length } : null;
  const position = mode === 'locked' && myId ? guessPosition(revealed, myId) : null;

  const showLineup = mode === 'open' || mode === 'locked' || mode === 'settled';
  const showRecap = mode !== 'tuning' && (!!tab.hunt || (r && mode !== 'offair'));
  const hasRunnerUp = mode === 'settled' && winners.some((w) => w.place >= 2);

  const kind = recapKind(mode, ref.isLive);
  const recap =
    episodeId && episode.hunt
      ? {
          kind: 'final',
          title: episodeTitle(episode.hunt),
          stats: huntStats(episode.hunt, null),
          currency: episode.hunt.currency || null,
          loading: episode.loading,
          error: episode.error,
          onBack: () => setEpisodeId(null),
        }
      : { kind, title: RECAP[kind], stats, currency, loading: tab.loading, error: tab.error, onBack: null };

  return (
    <div className="flex flex-col gap-6 font-onair text-onair-ink-1">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-6">
          <div className="order-1 min-w-0">
            <HuntMonitor
              mode={mode}
              round={r}
              stats={stats}
              meter={meter}
              currency={currency}
              guessCount={guessCount}
              prize={prize}
              winner={winner}
              chatMedian={chatMedian}
              offair={offair}
              clock={clock}
              ticker={ticker}
              phrase={phrase}
            />
          </div>
          {showLineup && (
            <div className="order-3 min-w-0">
              <HuntLineup mode={mode} sealed={sealed} entries={revealed} round={r} myEntry={myEntry} myId={myId} currency={currency} now={now} />
            </div>
          )}
          {(showRecap || recap.onBack) && (
            <div className="order-4 min-w-0 scroll-mt-24" ref={recapRef}>
              <HuntRecap {...recap} />
            </div>
          )}
          {r && r.acceptSuggestions && (
            <div className="order-7 flex min-w-0 flex-col gap-6">
              <SuggestionSubmit hunt={r} />
              <SuggestionList huntId={r.id} adminMode={false} />
            </div>
          )}
        </div>
        <div className="contents lg:flex lg:w-[340px] lg:flex-none lg:flex-col lg:gap-5">
          {!loading && (
            <div className="order-2">
              <HuntSlip
                mode={mode}
                round={r}
                viewer={viewer}
                onSignIn={onSignIn}
                myEntry={myEntry}
                currency={currency}
                startCost={stats.startCost}
                prize={prize}
                guessCount={guessCount}
                position={position}
                rank={rank}
              />
            </div>
          )}
          {hasRunnerUp && (
            <div className="order-5">
              <RunnerUpCard winners={winners} />
            </div>
          )}
          {episodes.length > 0 && (
            <div className="order-6">
              <PastEpisodes hunts={episodes} activeId={episodeId} onSelect={setEpisodeId} />
            </div>
          )}
        </div>
      </div>
      <CommunityHuntsPromo />
    </div>
  );
}
