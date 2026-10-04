import { FOCUS, MONO } from '../onAir/classes';
import { padCount } from './videoStoreModel';

// Jump links to the store's aisles. Focus moves to the aisle's heading so the
// next Tab carries on from there; the scroll is smooth unless motion is reduced.
export default function AisleSigns({ aisles }) {
  const jump = (event, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    target.focus({ preventScroll: true });
  };
  return (
    <nav aria-label="Aisles" className="mt-8">
      <ul className="flex flex-wrap gap-2">
        {aisles.map((a) => (
          <li key={a.id}>
            <a
              href={`#${a.id}`}
              onClick={(e) => jump(e, a.id)}
              className={`inline-flex items-baseline gap-2 rounded-onair-control bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 px-4 py-2.5 shadow-onair-card transition-colors hover:from-onair-surface-raised ${FOCUS}`}
            >
              <span className="text-[0.9375rem] font-bold text-onair-ink-1">{a.label}</span>
              <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>{padCount(a.count)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
