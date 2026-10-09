import { useMemo, useState } from 'react';
import useSlotCatalog from '../../hooks/useSlotCatalog';
import { MONO } from '../onAir/classes';
import './ball.css';

const MAX_RESULTS = 8;

// "Call one in" (spec: Site page): find the exact catalogue name, see who
// holds it, copy the !slot line for Twitch chat. Bonus-buy slots only.
export default function SlotFinder({ taken }) {
  const { slots, loading, error } = useSlotCatalog();
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(null);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return slots
      .filter((s) => s.bonusBuy && s.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS);
  }, [q, slots]);

  const copy = async (slot) => {
    try {
      await navigator.clipboard.writeText(`!slot ${slot.name}`);
      setCopied(slot.id);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="rounded-[6px] bg-onair-paper p-3 text-onair-paper-ink shadow-onair-card">
      <h3 className="font-display text-[1.25rem] uppercase tracking-wide">Call one in</h3>
      <label className="mt-2 block">
        <span className="sr-only">Search slots</span>
        <input
          type="search"
          value={q}
          placeholder="Search slots…"
          onChange={(e) => {
            setQ(e.target.value);
            setCopied(null);
          }}
          className="w-full border-2 border-onair-paper-ink bg-white px-2.5 py-1.5 font-onair-mono text-[0.8125rem] text-onair-paper-ink placeholder:text-onair-paper-ink/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-onair-winner"
        />
      </label>
      {loading && <p className={`${MONO} mt-2 text-[0.625rem] tracking-[0.15em]`}>Loading the slot list…</p>}
      {error && <p className="mt-2 text-[0.8125rem]">The slot list is down. Type the name in chat and the bot will help.</p>}
      <ul className="mt-2 divide-y divide-dashed divide-onair-paper-ink/25">
        {results.map((s) => {
          const t = taken.get(s.id);
          return (
            <li key={s.id} className={`grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 py-1.5 ${t ? 'opacity-55' : ''}`}>
              {s.thumbnail ? <img src={s.thumbnail} alt="" className="h-5 w-7 rounded-[2px] object-cover" /> : <span className="gb-decal h-5 w-7 rounded-[2px]" />}
              <span className="min-w-0 truncate font-onair-mono text-[0.75rem] font-bold">
                {s.name}
                {t && <span className="block text-[0.625rem] font-normal">{t.scratched ? 'Scratched tonight' : `Taken by @${t.holder}`}</span>}
              </span>
              {t ? (
                <span className={`${MONO} text-[0.625rem] tracking-[0.15em]`}>Taken</span>
              ) : (
                <button
                  type="button"
                  onClick={() => copy(s)}
                  className={`${MONO} rounded-[3px] bg-onair-winner px-2 py-1 text-[0.625rem] font-bold tracking-[0.15em] text-onair-winner-ink`}
                >
                  {copied === s.id ? 'Copied' : 'Copy !slot'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className={`${MONO} mt-2 text-[0.625rem] tracking-[0.15em] text-onair-paper-ink/70`}>Only slots with a bonus buy · paste it in Twitch chat</p>
    </div>
  );
}
