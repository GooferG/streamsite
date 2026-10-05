import { LAYOUT, rectAspect } from './couchLayout';

// A game case's front is 135 × 190 mm.
const CASE_ASPECT = 135 / 190;
// The cases behind lean against the one in front.
const LEAN = [0, 3, 6];

// Goofer's recent games as real cases on the TV stand's shelf: up to three,
// standing front-on and fanned so the newest stands in front and the others
// peek out behind it. Each case has a dark header band, a hinge down its left
// edge and a plastic gloss over the cover (colours in index.css, .couch-case*).
export default function GameCases({ covers, className = '' }) {
  const shown = (covers || []).filter((c) => c && c.cover).slice(0, 3);
  if (!shown.length) return null;
  // A case at the games box's full height, in percent of the box's width.
  const width = Math.min(100, (100 * CASE_ASPECT) / rectAspect(LAYOUT.doors.games.rect));
  const step = shown.length > 1 ? (100 - width) / (shown.length - 1) : 0;
  return (
    <span aria-hidden="true" data-testid="game-cases" className={`pointer-events-none absolute inset-0 block ${className}`}>
      {shown.map((c, i) => (
        <span
          key={c.appid}
          data-case={i}
          className="couch-case absolute bottom-0 block h-full overflow-hidden"
          style={{ left: `${i * step}%`, width: `${width}%`, zIndex: shown.length - i, transform: `rotate(${LEAN[i]}deg)`, transformOrigin: 'bottom left' }}
        >
          <img src={c.cover} alt="" draggable={false} className="absolute inset-x-0 bottom-0 h-[87%] w-full select-none object-cover" />
          <span className="couch-case-band absolute inset-x-0 top-0 block h-[13%]" />
          <span className="couch-case-hinge absolute inset-y-0 left-0 block w-[9%]" />
          <span className="couch-case-gloss absolute inset-0 block" />
          {i > 0 && <span className="couch-case-shade absolute inset-0 block" />}
        </span>
      ))}
    </span>
  );
}
