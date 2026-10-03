import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { MENU_ROW, MENU_ROW_IDLE, MENU_ROW_NOW, PopoverPanel, usePopover } from '../onAir/Popover';
import { FOCUS, MONO } from '../onAir/classes';
import { GAMBA_CHANNELS, channelForPath, subchannelLabel } from '../../data/gambaTools';
import { GAMBA_ITEM } from './navItems';
import BarLink from './BarLink';

const CLOSE_DELAY_MS = 120;

// "04 Gamba" goes straight to the hub; the caret (or hover) discloses the
// subchannels 4-0 … 4-4. Subchannels keep "02 Schedule" and "02 Hunts" apart.
export default function GambaMenu({ current }) {
  const { pathname } = useLocation();
  const popover = usePopover();
  const { setOpen } = popover;
  const timer = useRef(null);
  const tuned = channelForPath(pathname);

  useEffect(() => () => clearTimeout(timer.current), []);
  // Any navigation (a row, Back, a link elsewhere) closes the menu.
  useEffect(() => setOpen(false), [pathname, setOpen]);

  const openNow = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  // A short grace period so diagonal mouse travel into the panel doesn't close it.
  const closeSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      {...popover.wrapProps}
      className="relative inline-flex items-center"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <BarLink item={GAMBA_ITEM} current={current} />
      <button
        type="button"
        {...popover.triggerProps}
        aria-label="Gamba channels"
        className={`rounded-onair-tile p-1 text-onair-ink-5 transition-colors duration-150 hover:text-onair-ink-1 motion-reduce:transition-none ${FOCUS}`}
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform duration-150 motion-reduce:transition-none ${popover.open ? 'rotate-180' : ''}`}
        />
      </button>
      <PopoverPanel id={popover.panelId} open={popover.open} className="w-64">
        <p className={`${MONO} px-3 pb-1.5 pt-2 text-[0.625rem] tracking-[0.25em] text-onair-ink-5`}>
          {GAMBA_ITEM.code} · Gamba
        </p>
        <ul>
          {GAMBA_CHANNELS.map((ch) => {
            const now = tuned?.id === ch.id;
            return (
              <li key={ch.id}>
                <Link
                  to={ch.path}
                  aria-current={now ? 'page' : undefined}
                  className={`${MENU_ROW} ${now ? MENU_ROW_NOW : MENU_ROW_IDLE}`}
                >
                  <span className={`${MONO} w-8 flex-none text-xs font-bold ${now ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
                    {subchannelLabel(ch, GAMBA_ITEM.code)}
                  </span>
                  {ch.label}
                  {now && (
                    <span className={`${MONO} ml-auto text-[0.625rem] tracking-[0.2em] text-onair-signal`}>Now</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverPanel>
    </div>
  );
}
