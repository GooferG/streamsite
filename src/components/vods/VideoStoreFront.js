import { useCallback, useEffect, useMemo, useState } from 'react';
import { MONO } from '../onAir/classes';
import useNow from '../hunts/useNow';
import { buildStore, padCount } from './videoStoreModel';
import StoreSign from './StoreSign';
import AisleSigns from './AisleSigns';
import { Aisle, Shelf } from './Shelf';
import VhsBox from './VhsBox';
import ClipCassette from './ClipCassette';
import RentalCounter from './RentalCounter';
import Clerk from './Clerk';

const NONE = [];
const BLANKS = [0, 1, 2, 3];
const noop = () => {};

function LoadingFloor() {
  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
      <div>
        <p role="status" className={`${MONO} text-[0.75rem] font-bold tracking-[0.2em] text-onair-ink-3`}>
          Restocking the shelves…
        </p>
        <ul aria-hidden="true" className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BLANKS.map((i) => (
            <li key={i} className="aspect-[2/3] rounded-onair-case bg-gradient-to-b from-onair-surface-1 to-onair-surface-4 shadow-onair-card" />
          ))}
        </ul>
      </div>
      <Clerk pose="restock" className="hidden w-60 lg:block" />
    </div>
  );
}

function EmptyFloor() {
  return (
    <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
      <Clerk pose="asleep" className="w-48" />
      <div>
        <h2 className="text-[1.5rem] font-extrabold tracking-[-0.02em] text-onair-ink-1">Shelves are empty.</h2>
        <p className="mt-1 text-[0.9375rem] text-onair-ink-4">Check back after the next stream.</p>
      </div>
    </div>
  );
}

// Goofer Video: the /vods floor, composed from raw Helix data (VodsPage wires
// App's poll and useRecentClips; fixtures feed it in dev and tests). Owns which
// tape is on the rental counter. `now` and `timeZone` are for fixtures and
// tests; live, the clock ticks each minute and the zone is the viewer's.
export default function VideoStoreFront({
  videos = NONE,
  topClips = NONE,
  recentClips = NONE,
  loading = false,
  isLive = false,
  statusReady = false,
  viewerName = null,
  now: frozenNow = null,
  timeZone,
  initialTapeId = null,
  onTapeChange = noop,
}) {
  const ticking = useNow(60 * 1000, frozenNow == null);
  const now = frozenNow ?? ticking;
  const store = useMemo(
    () => buildStore({ videos, topClips, recentClips, now, timeZone }),
    [videos, topClips, recentClips, now, timeZone]
  );

  // A ?tape= link waits until its tape is in the data (recent clips land a few
  // seconds after App's poll); any tape the viewer opens cancels it.
  const [pending, setPending] = useState(initialTapeId);
  const [rental, setRental] = useState(null);

  useEffect(() => {
    if (pending && store.byId[pending]) {
      setRental({ id: pending, at: null });
      setPending(null);
    }
  }, [pending, store]);

  // The tape on the counter left the data (it expired between polls): close.
  useEffect(() => {
    if (rental && !store.byId[rental.id]) {
      setRental(null);
      onTapeChange(null);
    }
  }, [rental, store, onTapeChange]);

  const open = (id) => {
    setPending(null);
    setRental({ id, at: null });
    onTapeChange(id);
  };
  const seek = (at) => setRental((r) => (r ? { ...r, at } : r));
  const switchTo = (id, at) => {
    setRental({ id, at });
    onTapeChange(id);
  };
  const close = useCallback(() => {
    setRental(null);
    onTapeChange(null);
  }, [onTapeChange]);

  const { shelves, fresh, aisles, counts } = store;
  const item = rental ? store.byId[rental.id] : null;
  const empty = !loading && counts.tapes === 0 && counts.clips === 0;
  const signs = [
    counts.tapes > 0 && { id: 'new-releases', label: 'New releases', count: counts.tapes },
    counts.fresh > 0 && { id: 'fresh-picks', label: 'Fresh picks', count: counts.fresh },
    counts.classics > 0 && { id: 'cult-classics', label: 'Cult classics', count: counts.classics },
  ].filter(Boolean);

  return (
    <div className="font-onair text-onair-ink-1">
      <StoreSign isLive={isLive} statusReady={statusReady} />

      {loading && <LoadingFloor />}
      {empty && <EmptyFloor />}

      {!loading && !empty && (
        <>
          <AisleSigns aisles={signs} />
          {counts.tapes > 0 && (
            <Aisle id="new-releases" title="New releases" count={counts.tapes}>
              {shelves.map((shelf) => (
                <Shelf key={shelf.key} label={shelf.label}>
                  {shelf.tapes.map((tape) => (
                    <VhsBox key={tape.id} tape={tape} onOpen={open} />
                  ))}
                </Shelf>
              ))}
            </Aisle>
          )}
          {counts.fresh > 0 && (
            <Aisle id="fresh-picks" title="Fresh picks" count={counts.fresh}>
              <Shelf label="Last 60 days" size="clip">
                {fresh.map((clip) => (
                  <ClipCassette key={clip.id} clip={clip} viewerName={viewerName} onOpen={open} />
                ))}
              </Shelf>
            </Aisle>
          )}
          {counts.classics > 0 && (
            <Aisle id="cult-classics" title="Cult classics" count={counts.classics}>
              {aisles.map((a) => (
                <Shelf key={a.key} label={a.game} divider size="clip">
                  {a.clips.map((clip) => (
                    <ClipCassette key={clip.id} clip={clip} viewerName={viewerName} showYear onOpen={open} />
                  ))}
                </Shelf>
              ))}
            </Aisle>
          )}
        </>
      )}

      <footer className="mt-16">
        <p className="font-onair-marker text-[1.25rem] text-onair-ink-2">Be kind, rewind.</p>
        {!loading && !empty && (
          <p className={`${MONO} mt-2 text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>
            {padCount(counts.tapes)} tapes · {padCount(counts.clips)} clips on the floor
          </p>
        )}
      </footer>

      {item && (
        <RentalCounter item={item} at={rental.at} viewerName={viewerName} onSeek={seek} onSwitch={switchTo} onClose={close} />
      )}
    </div>
  );
}
