import SectionHeader from './SectionHeader';
import { GAMBA_TOOLS } from '../data/gambaTools';

// One short in-register line per tool (sentence case, voice-rule compliant).
// Keyed by GAMBA_TOOLS id; unknown ids fall back to a generic line.
const TOOL_BLURBS = {
  leaderboard: "See who's climbing the monthly standings.",
  'hunt-tracker': 'Follow the bonus hunt live, bonus by bonus.',
  'bonus-hunts': 'Browse past hunts and how they paid out.',
  wheel: 'Spin up a random slot to play next.',
  suggest: 'Drop a slot for the next hunt.',
};

export default function HomeGambaTools({
  setPage,
  sectionId = 'gamba-tools',
  className = 'py-16 px-6 sm:px-10',
  innerClassName = 'max-w-7xl 2xl:max-w-[1440px] mx-auto',
  segment = '05',
  eyebrow = 'Back of house · The gamba wing',
  title = 'The gamba tools',
}) {
  return (
    <section id={sectionId} className={className}>
      <div className={innerClassName}>
        <SectionHeader
          segment={segment}
          eyebrow={eyebrow}
          title={title}
          accent="white"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMBA_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setPage(`gamba/${tool.id}`)}
                className="group text-left bg-zinc-card border border-white/8 rounded-lg p-4 transition-colors duration-200 hover:border-purple-gamba/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-gamba"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  {Icon && (
                    <Icon
                      size={16}
                      className="text-purple-bright"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-sm font-bold tracking-tight text-white-body group-hover:text-white-body">
                    {tool.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto text-white/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-purple-bright"
                  >
                    →
                  </span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  {TOOL_BLURBS[tool.id] || 'Open this tool in the gamba wing.'}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
