import { useState } from 'react';
import Ticket from '../onAir/Ticket';
import OnAirButton from '../onAir/OnAirButton';
import HoldButton from '../onAir/HoldButton';
import RollingNumber from '../onAir/RollingNumber';
import { MONO } from '../onAir/classes';
import ProgressBar from './ProgressBar';
import { affordability, earnHint, formatTickets, walletState } from './storeModel';

const LABEL = `${MONO} text-[0.6875rem] tracking-[0.2em]`;
const NOTE = 'text-[0.9375rem] leading-relaxed text-onair-viewer-ink';

function Header({ viewer, balance }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={`${LABEL} text-onair-viewer-light`}>Your wallet</span>
        {viewer && (
          <span className={`${MONO} truncate text-[0.625rem] tracking-[0.15em] text-onair-viewer-muted`}>{viewer.displayName}</span>
        )}
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <RollingNumber value={balance} className="text-[3.75rem] font-extrabold tracking-[-0.03em]" />
        <span className={`${LABEL} text-onair-viewer-muted`}>tickets</span>
      </p>
    </>
  );
}

// The torn stub: a ghost of the slip's foot that drops away after an order.
function TearGhost({ amount }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="tear-ghost"
      onAnimationEnd={() => setDone(true)}
      className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 origin-top-left items-center justify-center rounded-b-onair-card bg-gradient-to-b from-onair-ticket-mid to-onair-ticket-bottom text-[1.375rem] font-extrabold tabular-nums motion-safe:animate-onair-tear motion-reduce:hidden"
    >
      −{formatTickets(amount)}
    </div>
  );
}

function Body({ state, item, balance, ordering, onSignIn, onOrder, onEarn, onHoldStart }) {
  if (state === 'signin') {
    return (
      <>
        <p className={NOTE}>Sign in with Twitch to get a wallet.</p>
        <OnAirButton className="mt-4" onClick={onSignIn}>
          Sign in with Twitch
        </OnAirButton>
      </>
    );
  }
  if (state === 'loading') return <p className={`${LABEL} text-onair-viewer-muted`}>Opening your wallet…</p>;
  if (state === 'missing') return <p className={NOTE}>Your wallet isn't set up yet. Sign out and back in.</p>;
  if (state === 'none') return <p className={NOTE}>Nothing to order right now.</p>;

  const heading = <p className={`${MONO} mb-3 text-[0.625rem] tracking-[0.18em] text-onair-viewer-muted`}>Ordering · {item.name}</p>;
  if (state === 'soldout') {
    return (
      <>
        {heading}
        <OnAirButton disabled>Sold out</OnAirButton>
      </>
    );
  }
  const { short, pct } = affordability(balance, item);
  if (state === 'short') {
    return (
      <>
        {heading}
        <p className="text-[1.0625rem] font-bold">{formatTickets(short)} short</p>
        <ProgressBar pct={pct} className="mt-3" />
        <p className="mt-2.5 text-[0.8125rem] leading-snug text-onair-viewer-ink">{earnHint(short)}</p>
        <OnAirButton variant="ghost" className="mt-4" onClick={onEarn}>
          Ways to earn
        </OnAirButton>
      </>
    );
  }
  return (
    <>
      {heading}
      <dl className="space-y-1 text-[0.8125rem] tabular-nums text-onair-viewer-ink">
        <div className="flex justify-between gap-3">
          <dt>Balance</dt>
          <dd>{formatTickets(balance)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="truncate">{item.name}</dt>
          <dd>−{formatTickets(item.cost)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-white/[0.08] pt-2 text-[0.9375rem] font-bold text-onair-ink-1">
          <dt>After</dt>
          <dd>{formatTickets(balance - item.cost)}</dd>
        </div>
      </dl>
      <HoldButton
        className="mt-4"
        disabled={ordering}
        onConfirm={() => onOrder(item)}
        onHoldStart={onHoldStart}
        idleLabel={ordering ? 'Calling it in…' : 'Hold to order'}
        armedLabel={`Press again to spend ${formatTickets(item.cost)}`}
        hint="Press and hold · let go to cancel"
      />
    </>
  );
}

// The wallet: balance up top, and below the perforation whatever the tuned
// item needs (sign-in, the receipt and hold button, the shortfall, sold out).
export default function WalletSlip(props) {
  const { viewer, user, userLoading, item, balance, tear } = props;
  const state = walletState({ viewer, user, userLoading, item });
  return (
    <Ticket
      label="Your wallet"
      header={<Header viewer={viewer} balance={balance} />}
      stubOverlay={tear ? <TearGhost key={tear.key} amount={tear.amount} /> : null}
    >
      <Body state={state} {...props} />
    </Ticket>
  );
}

// Below lg the slip becomes a dock pinned to the bottom, so "Hold to order"
// stays under the thumb while the lineup scrolls.
export function WalletDock({ viewer, user, userLoading, item, balance, ordering, onSignIn, onOrder, onEarn, onHoldStart }) {
  const state = walletState({ viewer, user, userLoading, item });
  let action = null;
  if (state === 'signin') {
    action = (
      <OnAirButton size="sm" onClick={onSignIn}>
        Sign in with Twitch
      </OnAirButton>
    );
  } else if (state === 'order') {
    action = (
      <HoldButton
        size="sm"
        disabled={ordering}
        onConfirm={() => onOrder(item)}
        onHoldStart={onHoldStart}
        idleLabel={ordering ? 'Calling…' : `Hold to order · ${formatTickets(item.cost)}`}
        armedLabel={`Press again · ${formatTickets(item.cost)}`}
        hint="Press and hold to order, let go to cancel"
        hintHidden
      />
    );
  } else if (state === 'short') {
    action = (
      <div className="flex items-center gap-2">
        <span className={`${MONO} whitespace-nowrap text-[0.625rem] tracking-[0.15em] text-onair-viewer-muted`}>
          {formatTickets(affordability(balance, item).short)} short
        </span>
        <OnAirButton variant="ghost" size="sm" onClick={onEarn}>
          Ways to earn
        </OnAirButton>
      </div>
    );
  } else if (state === 'soldout') {
    action = <span className={`${LABEL} text-onair-viewer-muted`}>Sold out</span>;
  }
  return (
    <div
      className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-onair-row bg-gradient-to-b from-onair-ticket-top to-onair-ticket-bottom px-4 py-3 shadow-onair-ticket lg:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="min-w-0 flex-1">
        <p className={`${MONO} text-[0.625rem] tracking-[0.2em] text-onair-viewer-light`}>Wallet</p>
        <RollingNumber value={balance} className="text-[1.375rem] font-extrabold" />
      </div>
      {action}
    </div>
  );
}
