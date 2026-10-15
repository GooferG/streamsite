import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import { useCountdown } from '../../hooks/useCountdown';
import useCommunityHunts from '../../hooks/useCommunityHunts';
import usePredictionRound from '../hunts/usePredictionRound';
import useBallRound from '../../hooks/useBallRound';
import useBallDrumCount from '../../hooks/useBallDrumCount';
import useRevealClock from '../../hooks/useRevealClock';
import { spoilerSafe } from '../../utils/ball';

// Everything the guide hub reads: the bean leaderboard poll, its reset
// countdown, the communityhunts overview poll (60s, server-cached 30s) and the
// latest prediction round (one Firestore listener, limit 1), plus the newest
// Goofer Ball round (limit 1) and its drum count. The ball round is held back
// like CH 42 so the hub never spoils a draw or winner before its chat line.
export default function useGuideData() {
  const leaderboard = useLeaderboardData();
  const countdown = useCountdown(leaderboard.endsAt);
  const hunts = useCommunityHunts();
  const { round, error: roundError } = usePredictionRound();
  const { round: rawBallRound } = useBallRound();
  const ballNow = useRevealClock({ round: rawBallRound });
  const ballRound = spoilerSafe({ round: rawBallRound }, ballNow).round;
  const ballCount = useBallDrumCount(ballRound && ballRound.status === 'open' ? ballRound.id : null);
  return { leaderboard, countdown, hunts, round, roundError, ball: { round: ballRound, count: ballCount } };
}
