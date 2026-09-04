import { useSearchParams } from 'react-router-dom';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import useNow from './useNow';
import { THEMES, DEFAULT_THEME_ID } from './themes';
import ThemeSwitcher from './ThemeSwitcher';

function resolveTheme(requestedId) {
  return THEMES.find((t) => t.id === requestedId) || THEMES[0];
}

// Shown in place of a theme while there is nothing to render. An empty board
// and a broken board look identical to a viewer, so we say which it is.
function SignalPanel({ isLoading, error }) {
  const title = isLoading ? 'TUNING IN…' : 'NO SIGNAL';
  const body = isLoading
    ? 'Pulling the latest count off the wire.'
    : 'Standings are unavailable right now. The board is recounted every 15 minutes and comes back on its own — no need to refresh.';
  return (
    <div
      role="status"
      className="rounded-md border border-white/10 bg-black/60 px-5 py-10 text-center"
    >
      <div className="text-[0.625rem] font-bold tracking-eyebrow-lg text-white/55 font-mono">
        RAINBET · CODE BEAN · LEADERBOARD
      </div>
      <div className="mt-2 font-display text-3xl sm:text-4xl uppercase tracking-tight text-white-body">
        {title}
      </div>
      <p className="mt-3 text-sm text-white/60 max-w-md mx-auto">{body}</p>
      {!isLoading && error ? (
        <p className="mt-2 text-[0.625rem] font-mono text-white/30 uppercase tracking-eyebrow-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function Leaderboard() {
  const data = useLeaderboardData();
  const now = useNow();
  const [params, setParams] = useSearchParams();

  const active = resolveTheme(params.get('theme'));
  const ActiveTheme = active.Component;
  const hasBoard = data.players.length > 0;

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
      { replace: true }
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
        {hasBoard ? (
          <ActiveTheme data={data} now={now} />
        ) : (
          <SignalPanel isLoading={data.isLoading} error={data.error} />
        )}
      </div>
      <p className="mt-2 px-1 text-center text-[0.625rem] font-bold tracking-eyebrow-sm uppercase font-mono text-white/35">
        Live standings · Code {data.referralCode} on {data.brand} · ranked by
        weighted wager · handles masked · recounted every 15 min
      </p>
    </div>
  );
}

export { DEFAULT_THEME_ID };
