import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import { useCountdown } from '../../hooks/useCountdown';
import useCommunityHunts from '../../hooks/useCommunityHunts';
import usePredictionRound from '../hunts/usePredictionRound';

// Everything the guide hub reads: the bean leaderboard poll, its reset
// countdown, the communityhunts overview poll (60s, server-cached 30s) and the
// latest prediction round (one Firestore listener, limit 1).
export default function useGuideData() {
  const leaderboard = useLeaderboardData();
  const countdown = useCountdown(leaderboard.endsAt);
  const hunts = useCommunityHunts();
  const { round, error: roundError } = usePredictionRound();
  return { leaderboard, countdown, hunts, round, roundError };
}
