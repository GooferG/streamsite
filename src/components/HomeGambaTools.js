import SectionHeader from './SectionHeader';
import { GAMBA_TOOLS } from '../data/gambaTools';

// One short in-register line per tool (sentence case, voice-rule compliant).
// Keyed by GAMBA_TOOLS id; unknown ids fall back to a generic line.
const TOOL_BLURBS = {
  leaderboard: "See who's climbing the monthly standings.",
  'hunt-tracker': 'Follow the bonus hunt live, bonus by bonus.',
  'bonus-hunts': 'Browse past hunts and how they paid out.',
  'bonus-battle': 'Pit two bonuses against each other.',
  wheel: 'Spin up a random slot to play next.',
  suggest: 'Drop a slot for the next hunt.',
};

// UHF-dial channel numbers for the EPG listing. Each tool is a "channel".
const CHANNEL_BASE = 41;

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
        <div className="border border-white/8 rounded-lg overflow-hidden bg-zinc-card/40 divide-y divide-white/5">
          {GAMBA_TOOLS.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setPage(`gamba/${tool.id}`)}
                className="group w-full text-left grid grid-cols-[3.5rem_1fr_auto] sm:grid-cols-[5rem_auto_1fr_auto] items-center gap-x-3 sm:gap-x-6 px-4 sm:px-6 py-4 transition-colors duration-200 hover:bg-purple-gamba/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-gamba"
              >
                <span className="font-mono text-xs sm:text-sm font-bold tracking-eyebrow-sm text-purple-bright tabular-nums">
                  CH {CHANNEL_BASE + i}
                </span>
                {Icon && (
                  <Icon
                    size={16}
                    className="hidden sm:block text-white/40 group-hover:text-purple-bright transition-colors duration-200"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0">
                  <span className="block text-sm sm:text-base font-bold tracking-tight text-white-body leading-snug">
                    {tool.label}
                  </span>
                  <span className="block text-xs sm:text-sm text-white/55 leading-relaxed truncate">
                    {TOOL_BLURBS[tool.id] || 'Open this tool in the gamba wing.'}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-white/30 transition duration-200 group-hover:translate-x-0.5 group-hover:text-purple-bright"
                >
                  →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
