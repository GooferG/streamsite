import { useState } from 'react';
import CouchTv from './CouchTv';
import LaptopScreen from './LaptopScreen';
import DoorTiles from './DoorTiles';
import RoomDoors from './RoomDoors';
import TvCrop from './TvCrop';
import Dressing from './Dressing';
import RoomToys from './RoomToys';
import { WindowFront, WindowOutside, useWindowState } from './RoomWindow';
import { roomToys, themeArt } from './themes';
import { ART_ASPECT, LAYOUT, center, pctStyle, plateSrc, plateSrcSet } from './couchLayout';

// The couch (spec: The room). Presentational: the art, the live screens and
// the doors, positioned in percent of the art on one stage the camera moves.
export const ROOM_QUERY = '(min-width: 768px) and (min-aspect-ratio: 4/3)';

function Room({ couch, items, mode, flipTo, onDoor, onAutoplayBlocked, stage, onPlateError, now = Date.now() }) {
  const { containerRef, stageRef, box } = stage;
  const base = LAYOUT.art.empty || LAYOUT.art.plate;
  const [tx, ty] = center(LAYOUT.screens.tv);
  const live = couch.tv.state === 'live';
  const art = themeArt(LAYOUT, couch.theme);
  const win = useWindowState();
  return (
    <section aria-label="Goofer's couch" className="mt-[57px]">
      <div ref={containerRef} className="relative h-[calc(100svh-57px)] overflow-hidden bg-onair-surface-4">
        <div
          ref={stageRef}
          data-testid="couch-stage"
          className="absolute origin-top-left"
          style={box ? { left: box.left, top: box.top, width: box.width, height: box.height } : { inset: 0 }}
        >
          <WindowOutside win={LAYOUT.window} state={win} now={now} theme={couch.theme} witch={art && art.witch} />
          <img
            src={plateSrc(base)}
            srcSet={plateSrcSet(base)}
            sizes="100vw"
            fetchPriority="high"
            alt=""
            draggable={false}
            onError={onPlateError}
            className="absolute inset-0 h-full w-full select-none"
          />
          <Dressing layers={art && art.dressing} />
          <RoomToys toys={roomToys(LAYOUT, couch.theme)} />
          <WindowFront win={LAYOUT.window} state={win} theme={couch.theme} aspect={ART_ASPECT} />
          <RoomDoors doors={couch.doors} covers={couch.covers} giveaway={couch.giveaway} onDoor={onDoor} />
          <span
            className={`couch-dim pointer-events-none absolute inset-0 ${live ? 'couch-dim--live' : ''}`}
            style={{ '--tv-x': `${tx}%`, '--tv-y': `${ty}%` }}
            data-testid={live ? 'couch-glow' : undefined}
          />
          <span className="pointer-events-none absolute z-[2]" style={pctStyle(LAYOUT.screens.tv)}>
            <CouchTv tv={couch.tv} items={items} mode={mode} flipTo={flipTo} onAutoplayBlocked={onAutoplayBlocked} />
          </span>
          <span className="pointer-events-none absolute z-[2]" style={pctStyle(LAYOUT.screens.laptop)}>
            <LaptopScreen laptop={couch.laptop} bug={art && art.laptopBug} />
          </span>
        </div>
      </div>
    </section>
  );
}

export default function CouchFront(props) {
  const { couch, items, mode, flipTo, onDoor, onAutoplayBlocked, roomLayout, noArt = false } = props;
  const [plateFailed, setPlateFailed] = useState(false);
  const failPlate = () => setPlateFailed(true);
  if (roomLayout && !noArt && !plateFailed) return <Room {...props} onPlateError={failPlate} />;
  const art = !noArt && !plateFailed;
  const tv = couch.doors.find((d) => d.id === 'tv');
  return (
    <div className={art ? '' : 'mt-[57px]'}>
      {art && <TvCrop door={tv} tv={couch.tv} items={items} mode={mode} flipTo={flipTo} onDoor={onDoor} onAutoplayBlocked={onAutoplayBlocked} onPlateError={failPlate} theme={couch.theme} />}
      <DoorTiles doors={couch.doors} onDoor={onDoor} noArt={!art} skip={art ? ['tv'] : []} onPlateError={failPlate} />
    </div>
  );
}
