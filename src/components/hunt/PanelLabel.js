export default function PanelLabel({ code, icon: Icon, label, accent = 'emerald', quiet = false }) {
  const color =
    accent === 'orange'
      ? 'text-orange-admin'
      : accent === 'purple'
        ? 'text-purple-bright'
        : 'text-emerald-signal';
  return (
    <div
      className={`flex items-center gap-3 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono ${quiet ? 'text-white/50' : 'text-white/65'}`}
    >
      {code && <span className={`${color} tabular-nums`}>{code}</span>}
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon size={12} aria-hidden="true" className={color} />}
        <span>{label}</span>
      </span>
    </div>
  );
}
