import { RotateCcw } from 'lucide-react';

// Neutral house-brand chrome that sits above the active theme. Chips derive
// from the registry; reset only appears when off the default theme.
export default function ThemeSwitcher({ themes, activeId, defaultId, onSelect }) {
  const offDefault = activeId !== defaultId;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-3">
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg text-white/45 font-mono mr-1">
        STYLE
      </span>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Leaderboard style">
        {themes.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(t.id)}
              className={`px-3 py-1.5 text-[0.6875rem] font-bold tracking-eyebrow-sm uppercase font-mono border transition-colors duration-150 ${
                active
                  ? 'border-emerald-signal/60 bg-emerald-signal/10 text-emerald-signal'
                  : 'border-white/10 text-white/60 hover:text-white-body hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {offDefault && (
        <button
          type="button"
          onClick={() => onSelect(defaultId)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.625rem] font-bold tracking-eyebrow-sm uppercase font-mono text-white/45 hover:text-white-body transition-colors duration-150"
        >
          <RotateCcw size={11} aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  );
}
