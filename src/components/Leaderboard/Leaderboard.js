import { useSearchParams } from 'react-router-dom';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import useNow from './useNow';
import { THEMES, DEFAULT_THEME_ID } from './themes';
import ThemeSwitcher from './ThemeSwitcher';

function resolveTheme(requestedId) {
  return THEMES.find((t) => t.id === requestedId) || THEMES[0];
}

export default function Leaderboard() {
  const data = useLeaderboardData();
  const now = useNow();
  const [params, setParams] = useSearchParams();

  const active = resolveTheme(params.get('theme'));
  const ActiveTheme = active.Component;

  const handleSelect = (id) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === DEFAULT_THEME_ID) {
          next.delete('theme');
        } else {
          next.set('theme', id);
        }
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div>
      <ThemeSwitcher
        themes={THEMES}
        activeId={active.id}
        defaultId={DEFAULT_THEME_ID}
        onSelect={handleSelect}
      />
      <div className="relative">
        <span className="pointer-events-none absolute top-2 right-2 z-20 px-2 py-1 text-[9px] font-bold tracking-eyebrow-sm uppercase font-mono text-white/55 bg-zinc-broadcast/70 border border-white/10 rounded">
          Demo · sample data
        </span>
        <ActiveTheme data={data} now={now} />
      </div>
      <p className="mt-2 px-1 text-center text-[10px] font-bold tracking-eyebrow-sm uppercase font-mono text-white/35">
        Demo only — sample data for layout preview. Not a real leaderboard or live standings.
      </p>
    </div>
  );
}

export { DEFAULT_THEME_ID };
