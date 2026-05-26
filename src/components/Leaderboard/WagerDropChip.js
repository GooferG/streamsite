import { useEffect, useState } from 'react';
import { formatUSD } from './format';

// Renders the +$X chip for ~1.9s when `delta` changes to a non-zero value.
// Always mounted so it can capture deltas as they arrive — toggles its own
// visibility internally.
export default function WagerDropChip({ delta }) {
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!delta) return undefined;
    setShown(delta);
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 1900);
    return () => clearTimeout(id);
  }, [delta]);

  if (!shown) return null;

  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold font-mono tabular-nums tracking-eyebrow-sm
        bg-emerald-signal/15 text-emerald-signal border border-emerald-signal/30
        transition-all duration-300 motion-reduce:transition-none
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
      aria-hidden="true"
    >
      <span>+</span>
      <span>{formatUSD(shown).replace('$', '$')}</span>
    </span>
  );
}
