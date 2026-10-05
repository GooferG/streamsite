import { useState } from 'react';
import CouchTv from './CouchTv';
import LaptopScreen from './LaptopScreen';
import DoorTiles from './DoorTiles';
import RoomDoors from './RoomDoors';
import TvCrop from './TvCrop';
import Dressing from './Dressing';
import RoomToys from './RoomToys';
import { WindowFront, WindowOutside, useWindowState } from './RoomWindow';
import { roomToys, themeArt, themeLinks } from './themes';
import { ART_ASPECT, LAYOUT, center, pctStyle, plateSrc, plateSrcSet } from './couchLayout';

// The couch (spec: The room). Presentational: the art, the live screens and
// the doors, positioned in percent of the art on one stage the camera moves.
export const ROOM_QUERY = '(min-width: 768px) and (min-aspect-ratio: 4/3)';

function Room({ couch, items, mode, flipTo, onDoor, onAutoplayBlocked, onSegment, onWindow, held = {}, onHold, stage, onPlateError, now = Date.now() }) {
  const { containerRef, stageRef, box } = stage;
  const navH = stage.navH;
  const base = LAYOUT.art.empty || LAYOUT.art.plate;
  const [tx, ty] = center(LAYOUT.screens.tv);
  const live = couch.tv.state === 'live';
  const art = themeArt(LAYOUT, couch.theme);
  const links = themeLinks(couch.theme);
  const dressing = (art && art.dressing) || [];
  const unlinked = dressing.filter((l) => !Object.prototype.hasOwnProperty.call(links, l.id));
  const linked = dressing.filter((l) => Object.prototype.hasOwnProperty.call(links, l.id));
  const win = useWindowState();
  return (
    <section aria-label="Goofer's couch" style={{ marginTop: navH }}>
      <h1 className="sr-only">Goofer's couch</h1>
      <div ref={containerRef} className="relative overflow-hidden bg-onair-surface-4" style={{ height: `calc(100svh - ${navH}px)` }}>
        <div
          ref={stageRef}
          data-testid="couch-stage"
          className="absolute origin-top-left"
          style={box ? { left: box.left, top: box.top, width: box.width, height: box.height } : { inset: 0 }}
        >
          <WindowOutside win={LAYOUT.window} state={win} now={now} theme={couch.theme} witch={art && art.witch} aspect={ART_ASPECT} />
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
          <RoomToys toys={roomToys(LAYOUT, couch.theme)} />
          <WindowFront win={LAYOUT.window} state={win} theme={couch.theme} aspect={ART_ASPECT} />
          <Dressing layers={unlinked} />
          <RoomDoors doors={couch.doors} covers={couch.covers} giveaway={couch.giveaway} onDoor={onDoor} onHold={onHold} box={box} />
          <Dressing layers={linked} links={links} />
          <span
            className={`couch-dim pointer-events-none absolute inset-0 ${live ? 'couch-dim--live' : ''}`}
            style={{ '--tv-x': `${tx}%`, '--tv-y': `${ty}%` }}
            data-testid={live ? 'couch-glow' : undefined}
          />
          <span className="pointer-events-none absolute z-[2]" style={pctStyle(LAYOUT.screens.tv)}>
            <CouchTv tv={couch.tv} items={items} mode={mode} flipTo={flipTo} held={!!held.tv} onAutoplayBlocked={onAutoplayBlocked} onSegment={onSegment} />
          </span>
          <span className="pointer-events-none absolute z-[2]" style={pctStyle(LAYOUT.screens.laptop)}>
            <LaptopScreen laptop={couch.laptop} bug={art && art.laptopBug} held={!!held.laptop} onWindow={onWindow} />
          </span>
        </div>
      </div>
    </section>
  );
}

export default function CouchFront(props) {
  const { couch, items, mode, flipTo, onDoor, onAutoplayBlocked, onSegment, held = {}, onHold, roomLayout, noArt = false } = props;
  const [plateFailed, setPlateFailed] = useState(false);
  const failPlate = () => setPlateFailed(true);
  if (roomLayout && !noArt && !plateFailed) return <Room {...props} onPlateError={failPlate} />;
  const art = !noArt && !plateFailed;
  const tv = couch.doors.find((d) => d.id === 'tv');
  const navH = props.stage.navH;
  return (
    <div style={art ? undefined : { marginTop: navH }}>
      <h1 className="sr-only">Goofer's couch</h1>
      {art && (
        <TvCrop
          navH={navH}
          door={tv}
          tv={couch.tv}
          items={items}
          mode={mode}
          flipTo={flipTo}
          held={!!held.tv}
          onDoor={onDoor}
          onHold={onHold}
          onAutoplayBlocked={onAutoplayBlocked}
          onSegment={onSegment}
          onPlateError={failPlate}
          theme={couch.theme}
        />
      )}
      <DoorTiles doors={couch.doors} onDoor={onDoor} noArt={!art} skip={art ? ['tv'] : []} onPlateError={failPlate} />
    </div>
  );
}
