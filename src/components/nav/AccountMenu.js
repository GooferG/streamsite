import { Link } from 'react-router-dom';
import { LogOut, Store as StoreIcon, User as UserIcon } from 'lucide-react';
import { useTwitchAuth } from '../../contexts/TwitchAuthContext';
import OnAirButton from '../onAir/OnAirButton';
import { MENU_ROW, MENU_ROW_IDLE, PopoverPanel, usePopover } from '../onAir/Popover';
import { FOCUS, MONO } from '../onAir/classes';
import TwitchGlyph from './TwitchGlyph';

const ROW = `${MENU_ROW} ${MENU_ROW_IDLE}`;

// The viewer's Twitch avatar, or their initial on a viewer-purple disc.
export function Avatar({ user, size = 'h-[34px] w-[34px]' }) {
  if (user.profileImageUrl) {
    return <img src={user.profileImageUrl} alt="" className={`${size} flex-none rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${size} inline-flex flex-none items-center justify-center rounded-full bg-gradient-to-b from-onair-viewer to-onair-viewer-deep text-sm font-extrabold text-white-body`}
    >
      {(user.displayName || '?').charAt(0).toUpperCase()}
    </span>
  );
}

export function SignInButton({ onClick, size = 'sm', className = '' }) {
  return (
    <OnAirButton variant="viewer" size={size} onClick={onClick} className={className}>
      <TwitchGlyph />
      Sign in
    </OnAirButton>
  );
}

// Signed out: Sign in. Signed in: the avatar discloses account links.
export default function AccountMenu() {
  const { twitchUser, loading, loginWithTwitch, logout } = useTwitchAuth();
  const popover = usePopover();
  if (loading) return null;
  if (!twitchUser) return <SignInButton onClick={loginWithTwitch} />;
  return (
    <div {...popover.wrapProps} className="relative">
      <button
        type="button"
        {...popover.triggerProps}
        aria-label={`Account: ${twitchUser.displayName}`}
        className={`flex rounded-full ${FOCUS}`}
      >
        <Avatar user={twitchUser} />
      </button>
      <PopoverPanel id={popover.panelId} open={popover.open} align="right" className="w-56">
        <p className={`${MONO} truncate px-3 pb-1.5 pt-2 text-[0.625rem] tracking-[0.25em] text-onair-ink-5`}>
          {twitchUser.displayName}
        </p>
        <ul>
          <li>
            <Link to="/me" onClick={popover.close} className={ROW}>
              <UserIcon size={15} aria-hidden="true" />
              My account
            </Link>
          </li>
          <li>
            <Link to="/store" onClick={popover.close} className={ROW}>
              <StoreIcon size={15} aria-hidden="true" />
              Store
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
  );
}
