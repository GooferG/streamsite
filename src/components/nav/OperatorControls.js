import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, MonitorPlay, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import ControlRoomButton from '../controlRoom/ControlRoomButton';
import { MENU_ROW, MENU_ROW_IDLE, PopoverPanel, usePopover } from '../onAir/Popover';
import { FOCUS, MONO } from '../onAir/classes';

export const GIVEAWAY_ADMIN_PATH = '/admin/giveaways';
const ROW = `${MENU_ROW} ${MENU_ROW_IDLE}`;

// The control room: the floating panel where it can show (not on /admin, and
// only with a provider), otherwise the giveaways admin page.
export function useControlRoomLauncher() {
  const cr = useControlRoom();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const panelHere = !!cr?.enabled && !pathname.startsWith('/admin');
  return {
    giveaway: cr?.enabled ? cr.giveaway : null,
    toggle: () => (panelHere ? cr.panelActions.toggle() : navigate(GIVEAWAY_ADMIN_PATH)),
    open: () => (panelHere ? cr.panelActions.open() : navigate(GIVEAWAY_ADMIN_PATH)),
  };
}

// The operator's badge. Neutral on purpose: inside On Air, orange is the winner.
export function OperatorBadge({ as: Tag = 'span', className = '', ...rest }) {
  return (
    <Tag
      className={`${MONO} inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-onair-surface-raised text-[0.6875rem] font-bold tracking-[0.15em] text-onair-ink-2 shadow-onair-raised ${className}`}
      {...rest}
    >
      OP
    </Tag>
  );
}

export default function OperatorControls({ isAdmin }) {
  const launcher = useControlRoomLauncher();
  const { logout } = useAuth();
  const popover = usePopover();
  return (
    <div className="flex items-center gap-2">
      <ControlRoomButton giveaway={launcher.giveaway} onClick={launcher.toggle} />
      {isAdmin && (
        <div {...popover.wrapProps} className="relative">
          <OperatorBadge
            as="button"
            type="button"
            {...popover.triggerProps}
            aria-label="OP: operator menu"
            className={`cursor-pointer ${FOCUS}`}
          />
          <PopoverPanel id={popover.panelId} open={popover.open} align="right" className="w-60">
            <p className={`${MONO} px-3 pb-1.5 pt-2 text-[0.625rem] tracking-[0.25em] text-onair-ink-5`}>Operator</p>
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    popover.close();
                    launcher.open();
                  }}
                  className={ROW}
                >
                  <MonitorPlay size={15} aria-hidden="true" />
                  Control room
                  <kbd className={`${MONO} ml-auto text-[0.625rem] text-onair-ink-5`} aria-hidden="true">`</kbd>
                </button>
              </li>
              <li>
                <Link to="/admin" onClick={popover.close} className={ROW}>
                  <Shield size={15} aria-hidden="true" />
                  Admin
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    popover.close();
                    logout();
                  }}
                  className={ROW}
                >
                  <LogOut size={15} aria-hidden="true" />
                  Sign out
                </button>
              </li>
            </ul>
          </PopoverPanel>
        </div>
      )}
    </div>
  );
}
