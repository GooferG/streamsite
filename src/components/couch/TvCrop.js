import { useCallback } from 'react';
import useDoor from '../camera/useDoor';
import { FOCUS_INSET } from '../onAir/classes';
import CouchTv from './CouchTv';
import Dressing from './Dressing';
import useDoorHold, { withHold } from './useDoorHold';
import { roomToys, themeArt } from './themes';
import { LAYOUT, cropStyle, overlapShare, pctStyle, plateSrc, rectAspect, within } from './couchLayout';

// Phones: the TV and its stand, cropped from the same plate, with the live
// screen in it. The whole crop is the TV door, and it runs the full width from
// the top, so its focus ring sits inside it.
export default function TvCrop({ navH, door, tv, items, mode, flipTo, held = false, onDoor, onHold, onAutoplayBlocked, onSegment, onPlateError, theme = null }) {
  const crop = LAYOUT.phoneCrop;
  const art = themeArt(LAYOUT, theme);
  const go = useCallback((el) => onDoor(door, el), [door, onDoor]);
  const [, hold] = useDoorHold('tv', onHold);
  const props = withHold(useDoor(door.href, go), hold);
  return (
    <a
      {...props}
      aria-label={door.label}
      data-door="tv"
      className={`relative block overflow-hidden ${FOCUS_INSET}`}
      style={{ marginTop: navH, aspectRatio: rectAspect(crop) }}
    >
      <img src={plateSrc(LAYOUT.art.plate)} alt="" onError={onPlateError} style={cropStyle(crop)} />
      <Dressing
        layers={[
          ...((art && art.dressing) || []),
          ...roomToys(LAYOUT, theme)
            .filter((t) => t.art && t.art.idle)
            .map((t) => ({ id: `toy-${t.id}`, src: t.art.idle, rect: t.rect })),
        ].filter((l) => overlapShare(crop, l.rect) >= 0.5)}
        frame={crop}
      />
      <span className="pointer-events-none absolute" style={pctStyle(within(crop, LAYOUT.screens.tv))}>
        <CouchTv tv={tv} items={items} mode={mode} flipTo={flipTo} held={held} onAutoplayBlocked={onAutoplayBlocked} onSegment={onSegment} />
      </span>
    </a>
  );
}
