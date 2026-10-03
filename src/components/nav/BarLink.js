import { Link } from 'react-router-dom';
import { FOCUS, MONO } from '../onAir/classes';

// One link on the desktop bar: a mono chyron label with its channel code
// (code from xl). Active = teal text on a faint teal wash.
export default function BarLink({ item, current }) {
  const active = !!current;
  return (
    <Link
      to={item.path}
      aria-current={current}
      className={`${MONO} inline-flex items-center whitespace-nowrap rounded-onair-tile px-2 py-2 text-[0.6875rem] font-bold tracking-[0.15em] transition-colors duration-150 motion-reduce:transition-none ${FOCUS} ${
        active ? 'bg-onair-signal/[0.08] text-onair-signal-light' : 'text-onair-ink-4 hover:bg-white/5 hover:text-onair-ink-1'
      }`}
    >
      <span className={`mr-1.5 hidden font-normal xl:inline ${active ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
        {item.code}
      </span>
      {item.label}
    </Link>
  );
}
