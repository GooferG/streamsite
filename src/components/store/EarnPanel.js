import Panel from '../onAir/Panel';
import Chip from '../onAir/Chip';
import OnAirButton from '../onAir/OnAirButton';
import { FOCUS, MONO } from '../onAir/classes';
import { shortLabel } from '../../utils/countdown';
import {
  CHAT_BONUS_PER_WINDOW,
  DAILY_DROP,
  DISCORD_LINK_BONUS,
  WATCH_TICKETS_PER_WINDOW,
  WATCH_WINDOW_MINUTES,
} from '../../utils/earnRates';
import { formatMinutes } from '../../utils/formatMinutes';

function Row({ lit = false, title, sub, children }) {
  return (
    <Panel as="li" radius="row" lit={lit ? 'signal' : null} className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-bold">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-onair-ink-4">{sub}</p>
      </div>
      {children}
    </Panel>
  );
}

// Where tickets come from, with the daily drop claimable in place.
export default function EarnPanel({ viewer, user, daily, onClaim, onSignIn, discordUrl }) {
  const signedIn = !!viewer;
  const ready = signedIn && !!daily && daily.ready;
  let dailySub = `+${DAILY_DROP} once a day`;
  if (signedIn && daily) {
    if (daily.error) dailySub = <span className="text-onair-loss">{daily.error}</span>;
    else if (daily.nextAt) dailySub = `Next drop in ${shortLabel(daily.remainingMs)}`;
    else if (daily.ready) dailySub = 'Ready to claim';
  }
  const linked = !!(user && user.discordId);
  return (
    <Panel as="section" id="store-earn" aria-labelledby="store-earn-title" className="scroll-mt-24 p-5 sm:p-6">
      <p className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Ways to earn</p>
      <h2 id="store-earn-title" className="mt-1 text-[1.25rem] font-extrabold tracking-[-0.02em]">
        Short on tickets?
      </h2>
      <ul className="mt-4 flex flex-col gap-2">
        <Row lit={ready} title="Daily drop" sub={dailySub}>
          {ready && (
            <OnAirButton size="sm" onClick={onClaim} disabled={daily.claiming}>
              {daily.claiming ? 'Claiming…' : `Claim +${DAILY_DROP}`}
            </OnAirButton>
          )}
        </Row>
        <Row
          title="Hang out in chat"
          sub={`+${WATCH_TICKETS_PER_WINDOW} every ${WATCH_WINDOW_MINUTES} min while live, +${CHAT_BONUS_PER_WINDOW} more if you talk`}
        >
          {signedIn && user && (
            <span className={`${MONO} whitespace-nowrap text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>
              {formatMinutes(user.watchMinutes)} watched
            </span>
          )}
        </Row>
        <Row title="Link Discord" sub={`One-time +${DISCORD_LINK_BONUS}, you need to be in the server`}>
          {linked ? (
            <Chip size="sm" tone="signal">
              Linked
            </Chip>
          ) : signedIn && discordUrl ? (
            <a
              href={discordUrl}
              className={`inline-flex items-center rounded-onair-control bg-white/[0.07] px-3.5 py-2 text-sm font-bold text-onair-ink-2 transition-colors duration-150 hover:bg-white/[0.12] ${FOCUS}`}
            >
              Link Discord
            </a>
          ) : null}
        </Row>
      </ul>
      {!signedIn && (
        <OnAirButton className="mt-4" onClick={onSignIn}>
          Sign in with Twitch
        </OnAirButton>
      )}
    </Panel>
  );
}
