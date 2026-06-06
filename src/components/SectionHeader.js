export default function SectionHeader({
  segment,
  eyebrow,
  title,
  accent = 'emerald',
  action,
}) {
  const headingColor =
    accent === 'white' ? 'text-white-body' : 'text-emerald-signal';
  const rule =
    accent === 'white'
      ? 'from-white/30 via-white/10 to-transparent'
      : 'from-emerald-signal/40 via-white/10 to-transparent';

  return (
    <div className="mb-8 sm:mb-10">
      <div className="font-mono text-[0.625rem] sm:text-xs font-bold tracking-eyebrow-lg uppercase text-white/45 mb-3">
        {segment && (
          <>
            <span className="text-white/30">SEGMENT {segment}</span>
            <span className="text-white/20 mx-2">·</span>
          </>
        )}
        <span className="text-white/55">{eyebrow}</span>
      </div>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h2
          className={`font-black tracking-tight leading-none ${headingColor}`}
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(2.25rem, 5.5vw, 3.75rem)',
          }}
        >
          {title}
        </h2>
        {action && <div className="pb-1">{action}</div>}
      </div>
      <div className={`mt-6 h-px bg-gradient-to-r ${rule}`} />
    </div>
  );
}
