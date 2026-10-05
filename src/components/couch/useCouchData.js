import useCommunityHunts from '../../hooks/useCommunityHunts';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import { useSchedule } from '../../hooks/useSchedule';
import useHunt from '../hunts/useHunt';
import useNow from '../hunts/useNow';
import usePredictionRound from '../hunts/usePredictionRound';
import { latestFinished } from './couchModel';
import useLastVisit from './useLastVisit';
import useLiveGiveaway from './useLiveGiveaway';
import useSteamGames from './useSteamGames';
import useTvReel from './useTvReel';

// App's Twitch poll plus the hooks below, mapped onto the couch model's input.
export function toCouchInput(p) {
  const s = p.streamData;
  const g = p.giveaway;
  return {
    now: p.now,
    timeZone: p.timeZone,
    statusReady: p.statusReady,
    isLive: p.isLive,
    stream: s ? { title: s.title, viewers: s.viewer_count ?? null, game: s.game_name || null, thumbnailUrl: s.thumbnail_url || null } : null,
    schedule: p.schedule.loading ? null : p.schedule.schedule,
    videos: p.videos || [],
    clips: p.clips || [],
    category: (p.channelData && p.channelData.game_name) || null,
    hunts: p.hunts,
    round: p.round.round,
    lastHunt: p.lastHunt && Array.isArray(p.lastHunt.bonuses) ? p.lastHunt : null,
    leaderboardEndsAt: p.leaderboard.endsAt ?? null,
    giveaway: g ? { status: g.status, keyword: g.keyword, prize: g.prize } : null,
    games: p.games,
    lastVisit: p.lastVisit,
    reel: p.reel,
  };
}

export default function useCouchData({ isLive, streamData, statusReady, videos, clips, channelData }) {
  const now = useNow(30000);
  const schedule = useSchedule();
  const hunts = useCommunityHunts();
  const round = usePredictionRound();
  const finished = latestFinished(hunts);
  const { hunt: lastHunt } = useHunt(finished ? finished.id : null, finished);
  const leaderboard = useLeaderboardData();
  const giveaway = useLiveGiveaway();
  const games = useSteamGames();
  const lastVisit = useLastVisit();
  const reel = useTvReel();
  return toCouchInput({
    now,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isLive,
    statusReady,
    streamData,
    videos,
    clips,
    channelData,
    schedule,
    hunts,
    round,
    lastHunt,
    leaderboard,
    giveaway,
    games,
    lastVisit,
    reel,
  });
}
