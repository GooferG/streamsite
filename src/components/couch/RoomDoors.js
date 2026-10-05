import { useCallback } from 'react';
import useDoor from '../camera/useDoor';
import { FOCUS, MONO } from '../onAir/classes';
import { LAYOUT, pctStyle, within } from './couchLayout';

// The doors laid over the art (spec: Doors). One ordered list of real links:
// its order is the tab order and the screen-reader structure of the room.
// Cutouts lift on hover; the laptop doesn't, because its screen sits on top.
const LIFT = ['tapes', 'guide', 'games', 'remote', 'photo'];

function Label({ door, style }) {
  return (
    <span className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full pb-1.5" style={style} aria-hidden="true">
      <span className="flex flex-col rounded-onair-tile bg-onair-surface-2/90 px-2.5 py-1.5 shadow-onair-row">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className={`h-[7px] w-[7px] rounded-full ${door.lit ? 'bg-onair-signal' : 'bg-onair-ink-5'}`} />
          <span className={`${MONO} text-[0.625rem] tracking-[0.18em] text-onair-ink-4`}>{door.kicker}</span>
          <span className="font-onair text-[0.8125rem] font-bold text-onair-ink-1">{door.teaser}</span>
        </span>
        <span className="hidden w-[18rem] pt-1 font-onair text-[0.8125rem] font-medium leading-snug text-onair-ink-2 group-hover:block group-focus-visible:block">
          {door.sentence} <span className="text-onair-signal">Opens {door.destination}</span>
        </span>
      </span>
    </span>
  );
}

function StickyNote({ keyword }) {
  return (
    <span className="absolute inset-0 grid -rotate-6 place-items-center rounded-onair-label bg-onair-paper p-[6%] text-center shadow-onair-row">
      <span className="font-onair-marker text-[1.0625rem] leading-tight text-onair-paper-ink">
        type
        <br />
        {keyword}
      </span>
    </span>
  );
}

function NewSticker() {
  return (
    <span className="absolute -top-[10%] right-[4%] rotate-6 rounded-onair-label bg-onair-signal px-2 py-0.5 font-onair-marker text-[0.9375rem] text-onair-paper-ink shadow-onair-row">
      New
    </span>
  );
}

function RoomDoor({ door, covers, giveaway, onDoor }) {
  const box = LAYOUT.doors[door.id];
  const go = useCallback((el) => onDoor(door, el), [door, onDoor]);
  const props = useDoor(door.href, go);
  const [ax, ay] = box.anchor;
  const [x, y, w, h] = box.rect;
  const anchor = { left: `${((ax - x) / w) * 100}%`, top: `${((ay - y) / h) * 100}%` };
  const lift = LIFT.includes(door.id)
    ? 'transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-[2%] motion-safe:group-focus-visible:-translate-y-[2%] group-hover:drop-shadow-lg'
    : '';
  return (
    <li className="absolute" style={pctStyle(box.rect)}>
      <a {...props} aria-label={door.label} data-door={door.id} className={`group relative block h-full w-full rounded-onair-tile ${FOCUS}`}>
        {box.cutout && (
          <img src={box.cutout} alt="" data-door-art draggable={false} className={`absolute inset-0 h-full w-full ${lift}`} />
        )}
        {door.id === 'games' &&
          (box.cases || []).map((rect, i) =>
            covers[i] ? (
              <img key={covers[i].appid} src={covers[i].cover} alt="" className="absolute object-cover" style={pctStyle(within(box.rect, rect))} />
            ) : null
          )}
        {door.id === 'note' && giveaway && <StickyNote keyword={giveaway.keyword} />}
        {door.sticker === 'new' && <NewSticker />}
        <Label door={door} style={anchor} />
      </a>
    </li>
  );
}

export default function RoomDoors({ doors, covers, giveaway, onDoor }) {
  return (
    <ol aria-label="Things in the room" className="absolute inset-0">
      {doors.map((door) => (
        <RoomDoor key={door.id} door={door} covers={covers} giveaway={giveaway} onDoor={onDoor} />
      ))}
    </ol>
  );
}
