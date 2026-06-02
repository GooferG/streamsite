// Small label + value box used across the hunt tracker and live hunt views.
// variant 'box' (default) keeps the original bordered look; 'bare' drops the
// border/background for use inside a hairline-divided stats band. `hero`
// enlarges the value (Profit lead in the band).
export default function StatCell({ label, value, variant = 'box', hero = false }) {
  const wrap =
    variant === 'bare'
      ? 'px-3 py-2.5'
      : 'px-3 py-2.5 bg-zinc-broadcast/50 border border-white/8';
  const valueCls = hero ? 'text-2xl' : 'text-base';
  return (
    <div className={wrap}>
      <p className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 mb-1 font-mono">
        {label}
      </p>
      <p className={`font-bold text-white-body ${valueCls} tabular-nums`}>{value}</p>
    </div>
  );
}
