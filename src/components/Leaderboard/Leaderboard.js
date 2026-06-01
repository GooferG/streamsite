import { useSearchParams } from 'react-router-dom';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import useNow from './useNow';
import { THEMES, DEFAULT_THEME_ID } from './themes';

function resolveTheme(requestedId) {
  return THEMES.find((t) => t.id === requestedId) || THEMES[0];
}

export default function Leaderboard() {
  const data = useLeaderboardData();
  const now = useNow();
  const [params] = useSearchParams();

  const active = resolveTheme(params.get('theme'));
  const ActiveTheme = active.Component;

  return <ActiveTheme data={data} now={now} />;
}

export { DEFAULT_THEME_ID };
