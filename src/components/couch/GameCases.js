import { LAYOUT, pctStyle, within } from './couchLayout';

// One accent per spine, like a shelf of mixed platforms.
const STRIPE = ['bg-onair-signal', 'bg-onair-viewer', 'bg-onair-winner'];

// Goofer's recent games as the spines of the cases on the TV stand's shelf:
// each spine sits exactly on one of the art's three case boxes (the layout's
// `cases`), so the shelf keeps its shape. A dark plastic spine with a coloured
// band, a strip of the cover behind a shade and the game's name running up it
// (colours in index.css, .couch-spine*).
export default function GameCases({ covers, className = '' }) {
  const box = LAYOUT.doors.games;
  const slots = box.cases || [];
  const shown = (covers || []).filter((c) => c && c.cover).slice(0, slots.length);
  if (!shown.length) return null;
  return (
    <span aria-hidden="true" data-testid="game-cases" className={`pointer-events-none absolute inset-0 block ${className}`}>
      {shown.map((c, i) => (
        <span
          key={c.appid}
          data-case={i}
          className="couch-spine absolute block overflow-hidden [container-type:inline-size]"
          style={pctStyle(within(box.rect, slots[i]))}
        >
          <img src={c.cover} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
          <span className="couch-spine-shade absolute inset-0 block" />
          <span className="couch-spine-band absolute inset-x-0 top-0 block h-[12%]">
            <span className={`absolute inset-x-0 bottom-0 block h-[22%] ${STRIPE[i % STRIPE.length]}`} />
          </span>
          <span className="absolute inset-x-0 bottom-[6%] top-[16%] flex items-center justify-center">
            <span className="max-h-full rotate-180 overflow-hidden text-ellipsis whitespace-nowrap font-onair text-[max(10px,44cqw)] font-extrabold leading-none tracking-[-0.02em] text-onair-ink-1 [writing-mode:vertical-rl]">
              {c.name || ''}
            </span>
          </span>
          <span className="couch-spine-band absolute inset-x-0 bottom-0 block h-[6%]" />
        </span>
      ))}
    </span>
  );
}
