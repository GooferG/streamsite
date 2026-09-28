export const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

export const labelCls =
  'block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono';

export function formatTs(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ToggleRow({ label, value, onChange, hint }) {
  const on = value > 0;
  return (
    <button
      type="button"
      onClick={() => onChange(on ? 0 : 1)}
      aria-pressed={on}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2 border transition-colors duration-150 ${
        on
          ? 'border-emerald-signal/40 bg-emerald-signal/5 text-white-body'
          : 'border-white/10 bg-zinc-broadcast/40 text-white/50 hover:text-white-body'
      }`}
    >
      <span className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">
        <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-signal' : 'bg-white/25'}`} />
        {label}
        {hint && <span className="text-white/30 normal-case font-normal text-[0.625rem]">{hint}</span>}
      </span>
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

export function Chips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2 border text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono transition-colors duration-150 ${
              active
                ? 'border-orange-admin/70 bg-orange-admin/10 text-orange-admin'
                : 'border-white/10 bg-zinc-broadcast/40 text-white/55 hover:text-white-body hover:border-white/25'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="ml-1.5 px-1 py-px border border-current text-[0.5625rem] font-mono opacity-50 normal-case tracking-normal">
      {children}
    </kbd>
  );
}

export function MoneyInput({ id, value, onChange, autoFocus, label }) {
  return (
    <div className="flex flex-1 min-w-0">
      <span className="px-3 py-2.5 border border-r-0 border-white/10 bg-zinc-broadcast/80 font-mono font-bold text-white/55">
        $
      </span>
      <input
        id={id}
        autoFocus={autoFocus}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        aria-label={label}
        className={`${inputCls} font-mono font-bold text-base`}
      />
    </div>
  );
}
