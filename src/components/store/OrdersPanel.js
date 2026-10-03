import { Link } from 'react-router-dom';
import Panel from '../onAir/Panel';
import Chip from '../onAir/Chip';
import { FOCUS, MONO } from '../onAir/classes';
import { timeAgo } from '../hunts/huntTime';
import { orderStatus } from './storeModel';

// The viewer's last few orders, with where each one stands.
export default function OrdersPanel({ orders, now }) {
  return (
    <Panel as="section" aria-labelledby="store-orders-title" className="p-5 sm:p-6">
      <p className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Your orders</p>
      <h2 id="store-orders-title" className="mt-1 text-[1.25rem] font-extrabold tracking-[-0.02em]">
        On the list
      </h2>
      {orders.length === 0 ? (
        <p className="mt-4 text-[0.9375rem] text-onair-ink-4">Nothing called in yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {orders.map((o) => {
            const s = orderStatus(o);
            return (
              <Panel as="li" key={o.id} radius="row" className="flex items-center gap-3 px-4 py-3">
                <Chip size="sm" tone={s.tone}>
                  {s.label}
                </Chip>
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">{o.itemName}</span>
                <span className={`${MONO} whitespace-nowrap text-[0.625rem] tracking-[0.15em] text-onair-ink-5`}>
                  {timeAgo(o.createdAt, now)}
                </span>
              </Panel>
            );
          })}
        </ul>
      )}
      <Link to="/account" className={`mt-4 inline-block text-sm font-bold text-onair-signal-light hover:text-onair-signal ${FOCUS}`}>
        See everything on your account
      </Link>
    </Panel>
  );
}
