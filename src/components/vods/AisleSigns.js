import { FOCUS, MONO } from '../onAir/classes';
import { NAV_H } from '../nav/navMetrics';
import { padCount } from './videoStoreModel';

// The store directory: jump links to the aisles, stuck under the site nav as
// you browse. Focus moves to the aisle's heading so the next Tab carries on
// from there; the scroll is smooth unless motion is reduced.
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
    <nav aria-label="Aisles" className="sticky z-30 mt-8" style={{ top: NAV_H + 8 }}>
      {/* p-1.5 leaves room inside the scroller for each link's focus ring. */}
      <ul className="flex gap-1 overflow-x-auto rounded-onair-card bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 p-1.5 shadow-onair-card">
        {aisles.map((a) => (
          <li key={a.id} className="shrink-0">
            <a
              href={`#${a.id}`}
              onClick={(e) => jump(e, a.id)}
              className={`inline-flex items-baseline gap-2 whitespace-nowrap rounded-onair-control px-4 py-2 transition-colors hover:bg-white/[0.07] ${FOCUS}`}
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
