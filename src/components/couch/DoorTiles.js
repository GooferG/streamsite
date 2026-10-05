import { useCallback } from 'react';
import useDoor from '../camera/useDoor';
import { FOCUS, MONO } from '../onAir/classes';
import { LAYOUT, cropStyle, plateSrc, rectAspect } from './couchLayout';

// The doors as tiles (spec: Phone layout, The skeleton): phones, and any time
// the art is missing. Same links, same order, each with its sentence.
function TileArt({ id, onPlateError }) {
  const box = LAYOUT.doors[id];
  if (!box || id === 'note') return null;
  if (box.cutout) {
    return <img src={box.cutout} alt="" data-door-art className="mx-auto block h-[4.5rem] w-auto max-w-full object-contain" />;
  }
  const aspect = rectAspect(box.rect);
  return (
    <span
      className="relative mx-auto block w-[min(100%,var(--art-w))] overflow-hidden rounded-onair-tile"
      style={{ aspectRatio: aspect, '--art-w': `${4.5 * aspect}rem` }}
    >
      <img src={plateSrc(LAYOUT.art.plate)} alt="" data-door-art onError={onPlateError} style={cropStyle(box.rect)} />
    </span>
  );
}

function Tile({ door, onDoor, noArt, onPlateError }) {
  const go = useCallback((el) => onDoor(door, el), [door, onDoor]);
  const props = useDoor(door.href, go);
  return (
    <li className={door.id === 'note' ? 'col-span-2' : ''}>
      <a
        {...props}
        aria-label={door.label}
        data-door={door.id}
        className={`flex h-full flex-col gap-2 rounded-onair-card bg-onair-surface-1 p-3 shadow-onair-card ${FOCUS}`}
      >
        {!noArt && <TileArt id={door.id} onPlateError={onPlateError} />}
        <span className={`${MONO} text-[0.625rem] tracking-[0.18em] text-onair-ink-4`}>{door.kicker}</span>
        <span className="font-onair text-[0.9375rem] font-bold leading-snug text-onair-ink-1">{door.sentence}</span>
      </a>
    </li>
  );
}

export default function DoorTiles({ doors, onDoor, noArt = false, skip = [], onPlateError }) {
  return (
    <section className="px-3 pb-6 pt-4">
      <h2 className={`${MONO} px-1.5 pb-3 text-[0.625rem] tracking-[0.2em] text-onair-ink-4`}>On the coffee table</h2>
      <ol role="list" aria-label="On the coffee table" className="grid grid-cols-2 gap-2.5">
        {doors
          .filter((d) => !skip.includes(d.id))
          .map((door) => (
            <Tile key={door.id} door={door} onDoor={onDoor} noArt={noArt} onPlateError={onPlateError} />
          ))}
      </ol>
    </section>
  );
}
