import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel } from '../../utils/huntFormat';
import { roundCurrency } from '../../utils/predictionRound';
import useTuningPhrase from '../../hooks/useTuningPhrase';
import useMediaQuery from '../../hooks/useMediaQuery';
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

// What a screen reader hears when the round moves on (never on first load).
function announce(mode, winner) {
  if (mode === 'open') return 'Predictions are open.';
  if (mode === 'locked') return 'Entries closed. Results land when the last bonus opens.';
  if (mode === 'settled') return winner ? `Results are in. ${entryName(winner)} wins.` : 'Results are in. No eligible guesses.';
  return 'The round is over.';
}

// The Hunts tab, composed from raw data: the latest round (undefined while
// loading), its entries (empty while sealed or still loading), the viewer's
// entry, and the communityhunts overview.
//
// Layout: one column below lg in reading order (monitor, slip, lineup, recap,
// runner-up, past episodes, suggestions). From lg the slip and the rail cards
// move to a 340px right column. The slip renders in one place at a time, so
// screen-reader and keyboard order always match what is on screen.
export default function HuntsTab({
  round,
  roundError = false,
  entries = [],
  sealed = false,
  entriesLoading = false,
  myEntry = null,
  viewer = null,
  onSignIn,
  live = null,
  recent = [],
}) {
  const loading = round === undefined && !roundError;
  const r = loading ? null : round || null;
  const mode = loading ? 'tuning' : huntMode(r);
  const myId = viewer ? viewer.twitchId : null;
  const wide = useMediaQuery('(min-width: 1024px)');

  const ref = tabHuntRef(r, live, recent);
  const tab = useHunt(ref.huntId, ref.summary);
  const [episodeId, setEpisodeId] = useState(null);
  // Past episodes are finished hunts: never the tab's own hunt, never one still live.
  const episodes = (recent || []).filter((h) => h.id !== ref.huntId && h.status !== 'live' && !(live && h.id === live.id));
  const episodeSummary = episodes.find((h) => h.id === episodeId) || null;
  const episode = useHunt(episodeSummary ? episodeSummary.id : null, episodeSummary);
  const recapHeadingRef = useRef(null);

  const phrase = useTuningPhrase(loading);
  const now = useNow(30 * 1000, mode === 'open' || mode === 'locked' || (mode === 'offair' && ref.isLive));

  // Swapping the recap (to an episode or back) moves focus to its heading,
  // which also scrolls it into view.
  const lastEpisode = useRef(episodeId);
  useEffect(() => {
    if (lastEpisode.current === episodeId) return;
    lastEpisode.current = episodeId;
    if (recapHeadingRef.current) recapHeadingRef.current.focus();
  }, [episodeId]);

  const currency = roundCurrency(r) || (tab.hunt && tab.hunt.currency) || null;
  const stats = huntStats(tab.hunt, r);
  const prize = topPrizeText(r);
  const winners = ((r && r.winners) || []).filter(Boolean);
  const winner = winners.find((w) => w.place === 1) || null;
  const runnerUp = winners.find((w) => w.place === 2) || null;

  // Polite announcement when the round changes state (entries close, results land).
  const [announcement, setAnnouncement] = useState('');
  const lastMode = useRef(mode);
  useEffect(() => {
    const from = lastMode.current;
    lastMode.current = mode;
    if (from === mode || from === 'tuning' || mode === 'tuning') return;
    setAnnouncement(announce(mode, winner));
  }, [mode, winner]);

  // Entries still loading stay face down, counted from the round, rather than
  // flashing "no guesses".
  const veiled = sealed || entriesLoading;
  const revealed = veiled ? [] : entries;
  const guessCount = veiled ? (r && r.entryCount) || 0 : revealed.filter((e) => guessOf(e) != null).length;
  const chatMedian = mode === 'locked' || mode === 'settled' ? median(revealed.map(guessOf)) : null;
  const meter = meterModel({
    mode,
    sealed: veiled,
    entries: revealed,
    myEntry,
    myId,
    startCost: stats.startCost,
    wonSoFar: stats.wonSoFar,
    round: r,
  });
  const offair = {
    isLive: ref.isLive,
    hasHunt: !!tab.hunt,
    noSignal: roundError,
    title: tab.hunt ? `${huntTypeLabel(tab.hunt.huntType)} hunt` : null,
  };
  let ticker = [];
  if (roundError) ticker = ['No signal', 'Refresh to retune'];
  else if (mode !== 'tuning') {
    ticker = tickerItems(mode, {
      stats,
      guessCount,
      prize,
      winner: winner && { name: entryName(winner), prize: winnerPrizeText(winner.prize) },
      runnerUp: runnerUp && { name: entryName(runnerUp), prize: winnerPrizeText(runnerUp.prize) },
      isLive: ref.isLive,
      money: (v) => formatMoney(v, currency),
      signed: (v) => signedMoney(v, currency),
    });
  }
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

  const slip = loading ? null : (
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
  );
  const railCards = (
    <>
      {hasRunnerUp && <RunnerUpCard winners={winners} />}
      {episodes.length > 0 && <PastEpisodes hunts={episodes} activeId={episodeId} onSelect={setEpisodeId} />}
    </>
  );

  return (
    <div className="flex flex-col gap-6 font-onair text-onair-ink-1">
      <p className="sr-only" aria-live="polite" data-testid="hunt-announcer">
        {announcement}
      </p>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:flex-1">
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
          {!wide && slip}
          {showLineup && (
            <HuntLineup
              mode={mode}
              sealed={veiled}
              pending={!sealed && entriesLoading}
              entries={revealed}
              round={r}
              myEntry={myEntry}
              myId={myId}
              currency={currency}
              now={now}
            />
          )}
          {(showRecap || recap.onBack) && <HuntRecap {...recap} headingRef={recapHeadingRef} />}
          {!wide && railCards}
          {r && r.acceptSuggestions && (
            <div className="flex min-w-0 flex-col gap-6">
              <SuggestionSubmit hunt={r} />
              <SuggestionList huntId={r.id} adminMode={false} />
            </div>
          )}
        </div>
        {wide && (
          <div className="flex w-[340px] flex-none flex-col gap-5">
            {slip}
            {railCards}
          </div>
        )}
      </div>
      <CommunityHuntsPromo />
    </div>
  );
}
