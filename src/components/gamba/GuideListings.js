import { Link } from 'react-router-dom';
import Panel from '../onAir/Panel';
import StatusLight from '../onAir/StatusLight';
import { FOCUS, MONO } from '../onAir/classes';

const TONE = { signal: 'text-onair-signal-light', loss: 'text-onair-loss' };

// "What's on": one listing row per tool, the whole row a link. The lit row is
// the channel on the featured monitor (Panel's signal wash); only the LIVE
// light glows.
export default function GuideListings({ rows }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Panel
            as={Link}
            to={row.path}
            radius="row"
            lit={row.lit ? 'signal' : null}
            className={`grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 px-4 py-4 transition-[filter] duration-150 hover:brightness-110 motion-reduce:transition-none lg:grid-cols-[5.5rem_minmax(0,12rem)_minmax(0,1fr)_minmax(0,15rem)_1.5rem] lg:px-[18px] ${FOCUS}`}
          >
            <span className={`${MONO} text-[0.8125rem] font-bold tracking-[0.15em] ${row.lit ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
              {row.channel}
            </span>
            <span className="text-xl font-extrabold text-onair-ink-1">{row.label}</span>
            <span className="col-span-full flex flex-wrap items-center gap-2.5 text-[0.9375rem] text-onair-ink-3 lg:col-span-1">
              {row.live && <StatusLight status="live" />}
              <span className={TONE[row.tone] || ''}>{row.now}</span>
            </span>
            <span className="col-span-full text-sm text-onair-ink-4 lg:col-span-1">{row.next}</span>
            <span aria-hidden="true" className="hidden text-[1.0625rem] text-onair-ink-5 lg:block">
              →
            </span>
          </Panel>
        </li>
      ))}
    </ul>
  );
}
