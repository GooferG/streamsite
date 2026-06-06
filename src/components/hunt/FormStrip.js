// src/components/hunt/FormStrip.js
// Recent-calls pip strip (newest right). f ∈ 'win' | 'ok' | 'brick'.
export default function FormStrip({ form }) {
  if (!form || form.length === 0) {
    return <span className="text-[0.625rem] font-mono text-white/30">no plays</span>;
  }
  const cls = { win: 'bg-emerald-signal', ok: 'bg-white/35', brick: 'bg-red-destructive' };
  return (
    <span className="inline-flex items-center gap-0.5" title="Recent calls (newest right)">
      {form.map((f, i) => (
        <span key={i} className={`inline-block w-1.5 h-3 ${cls[f] || 'bg-white/20'}`} />
      ))}
    </span>
  );
}
