import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import useDoor from '../camera/useDoor';
import { FOCUS, MONO } from '../onAir/classes';
import { LAYOUT, pctStyle } from './couchLayout';
import GameCases from './GameCases';
import { resolveLabels } from './labelLayout';
import useDoorHold, { withHold } from './useDoorHold';

const LABEL_GAP = 4;

// The doors laid over the art (spec: Doors). One ordered list of real links:
// its order is the tab order and the screen-reader structure of the room.
// Cutouts lift on hover; the laptop doesn't, because its screen sits on top.
const LIFT = ['tapes', 'guide', 'games', 'remote', 'photo'];

// The label is part of its door: a click on it opens the door, and the pointer
// can rest on its open sentence. `folded` keeps the sentence shut (Escape).
function Label({ door, style, nudge, folded }) {
  const [dx, dy] = nudge || [0, 0];
  return (
    <span data-label={door.id} className="absolute z-10 group-hover:z-20 group-focus-visible:z-20 -translate-x-1/2 -translate-y-full pb-1.5" style={{ ...style, marginLeft: dx, marginTop: dy }} aria-hidden="true">
      <span className="flex flex-col rounded-onair-tile bg-onair-surface-2/90 px-2.5 py-1.5 shadow-onair-row">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className={`h-[7px] w-[7px] rounded-full ${door.lit ? 'bg-onair-signal' : 'bg-onair-ink-5'}`} />
          <span className={`${MONO} text-[0.625rem] tracking-[0.18em] text-onair-ink-4`}>{door.kicker}</span>
          <span className="font-onair text-[0.8125rem] font-bold text-onair-ink-1">{door.teaser}</span>
        </span>
        <span
          data-label-sentence
          className={`hidden w-[18rem] pt-1 font-onair text-[0.8125rem] font-medium leading-snug text-onair-ink-2 ${folded ? '' : 'group-hover:block group-focus-visible:block'}`}
        >
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

// Escape folds the open sentence away until the pointer leaves and focus goes.
function useFold(active) {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!active) {
      setFolded(false);
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setFolded(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
  return folded;
}

function RoomDoor({ door, covers, giveaway, onDoor, onHold, nudge }) {
  const box = LAYOUT.doors[door.id];
  const go = useCallback((el) => onDoor(door, el), [door, onDoor]);
  const [active, hold] = useDoorHold(door.id, onHold);
  const props = withHold(useDoor(door.href, go), hold);
  const folded = useFold(active);
  const [ax, ay] = box.anchor;
  const [x, y, w, h] = box.rect;
  const anchor = { left: `${((ax - x) / w) * 100}%`, top: `${((ay - y) / h) * 100}%` };
  const lift = LIFT.includes(door.id)
    ? 'transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-[2%] motion-safe:group-focus-visible:-translate-y-[2%] group-hover:drop-shadow-lg'
    : '';
  return (
    <li className="pointer-events-auto absolute" style={pctStyle(box.rect)}>
      <a {...props} aria-label={door.label} data-door={door.id} className={`group relative block h-full w-full rounded-onair-tile ${FOCUS}`}>
        {box.cutout && (
          <img src={box.cutout} alt="" data-door-art draggable={false} className={`absolute inset-0 h-full w-full ${lift}`} />
        )}
        {door.id === 'games' && <GameCases covers={covers} className={lift} />}
        {door.id === 'note' && giveaway && <StickyNote keyword={giveaway.keyword} />}
        {door.sticker === 'new' && <NewSticker />}
        <Label door={door} style={anchor} nudge={nudge} folded={folded} />
      </a>
    </li>
  );
}

// Resting labels are measured with whatever nudge they carry and that nudge is
// taken back out, so every pass solves from zero and the result never drifts.
// An open sentence (a hovered or focused door) is shut for the measure, so it
// is the resting chip that gets placed.
function measureLabels(list, applied) {
  const sentences = Array.from(list.querySelectorAll('[data-label-sentence]'));
  sentences.forEach((el) => {
    el.style.display = 'none';
  });
  try {
    return measureResting(list, applied);
  } finally {
    sentences.forEach((el) => {
      el.style.display = '';
    });
  }
}

function measureResting(list, applied) {
  const stage = list.getBoundingClientRect();
  const scale = list.offsetWidth ? stage.width / list.offsetWidth : 1;
  const boxes = [];
  list.querySelectorAll('[data-label]').forEach((el) => {
    const id = el.getAttribute('data-label');
    const r = el.getBoundingClientRect();
    const [ax, ay] = applied[id] || [0, 0];
    const door = el.closest('a');
    boxes.push({
      id,
      x: (r.left - stage.left) / scale - ax,
      y: (r.top - stage.top) / scale - ay,
      w: r.width / scale,
      h: r.height / scale,
      objectW: door ? door.getBoundingClientRect().width / scale : 0,
    });
  });
  return { boxes, bounds: { x: 0, y: 0, w: stage.width / scale, h: stage.height / scale } };
}

// Labels never stack: after layout, on a stage resize, new copy or loaded
// fonts, nudge any resting labels that overlap (hover still raises its own).
// Whatever asks, the measure runs at most once a frame, in that frame's
// animation callback, and its nudges commit before the frame paints.
function useLabelNudges(listRef, box, copy) {
  const [nudges, setNudges] = useState({});
  const appliedRef = useRef(nudges);
  appliedRef.current = nudges;
  const frame = useRef(0);
  const width = box && box.width;
  const height = box && box.height;

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      const list = listRef.current;
      if (!list) return;
      const { boxes, bounds } = measureLabels(list, appliedRef.current);
      const next = {};
      resolveLabels(boxes, { bounds, gap: LABEL_GAP }).forEach((o) => {
        if (o.dx || o.dy) next[o.id] = [o.dx, o.dy];
      });
      flushSync(() => setNudges((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next)));
    });
  }, [listRef]);

  // A stage resize or new copy.
  useLayoutEffect(() => {
    schedule();
  }, [schedule, width, height, copy]);

  // Loaded fonts; and no measure left waiting once the doors are gone.
  useEffect(() => {
    let live = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (live) schedule();
      });
    }
    return () => {
      live = false;
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule]);

  return nudges;
}

export default function RoomDoors({ doors, covers, giveaway, onDoor, onHold, box }) {
  const listRef = useRef(null);
  const copy = doors.map((d) => `${d.id}|${d.kicker}|${d.teaser}`).join('/');
  const nudges = useLabelNudges(listRef, box, copy);
  return (
    // Safari drops list semantics under list-style none, so the role stays.
    // eslint-disable-next-line jsx-a11y/no-redundant-roles
    <ol ref={listRef} role="list" aria-label="Things in the room" className="pointer-events-none absolute inset-0">
      {doors.map((door) => (
        <RoomDoor key={door.id} door={door} covers={covers} giveaway={giveaway} onDoor={onDoor} onHold={onHold} nudge={nudges[door.id]} />
      ))}
    </ol>
  );
}
