import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Coins, Ticket, ShoppingBag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useUserDoc } from '../hooks/useUserDoc';
import { authedFetch } from '../utils/authedFetch';

const ERROR_LABELS = {
  INSUFFICIENT_TICKETS: 'Not enough tickets.',
  OUT_OF_STOCK: 'Out of stock.',
  ITEM_INACTIVE: 'No longer available.',
  ITEM_NOT_FOUND: 'Item missing.',
  USER_NOT_FOUND: 'Account not initialized — try logging out and back in.',
  NOT_AUTHENTICATED: 'You need to sign in.',
};

function StatusBar({ tickets }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
      <span className="inline-flex items-center gap-2 text-emerald-signal">
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
          <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
        </span>
        <span>Store open</span>
      </span>
      <span className="text-white/15">·</span>
      <span className="text-white/45">Balance</span>
      <span className="inline-flex items-center gap-1 text-emerald-signal tabular-nums tracking-eyebrow-lg">
        <Ticket size={11} aria-hidden="true" />
        {tickets ?? '—'}
      </span>
    </div>
  );
}

function ItemCard({ item, balance, onRedeem, redeeming, disabled }) {
  const canAfford = balance != null && balance >= item.cost;
  const outOfStock = item.stock !== null && item.stock !== undefined && item.stock <= 0;
  const buttonDisabled = disabled || !canAfford || outOfStock || redeeming;

  return (
    <div className="border border-white/8 bg-zinc-card/30 flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          <span>{item.kind === 'stream' ? 'On stream' : 'Auto-grant'}</span>
        </span>
        <span className="text-white/40">
          {item.stock === null || item.stock === undefined
            ? 'Unlimited'
            : `Stock ${String(item.stock).padStart(3, '0')}`}
        </span>
      </div>

      {item.imageUrl && (
        <div className="aspect-video bg-zinc-broadcast/40 overflow-hidden border-b border-white/8">
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="px-4 py-4 flex flex-col gap-2 flex-1">
        <h3 className="text-lg font-black text-white-body tracking-tight leading-tight">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-sm text-white/55 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-baseline gap-2 mt-auto pt-3">
          <Coins size={14} className="text-emerald-signal" aria-hidden="true" />
          <span className="text-2xl font-black text-white-body tabular-nums">
            {item.cost}
          </span>
          <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
            tickets
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRedeem(item)}
        disabled={buttonDisabled}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
      >
        <ShoppingBag size={13} aria-hidden="true" />
        <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
          {redeeming
            ? 'Redeeming…'
            : outOfStock
              ? 'Out of stock'
              : !canAfford
                ? `Need ${item.cost - (balance ?? 0)} more`
                : 'Redeem'}
        </span>
      </button>
    </div>
  );
}

export default function StorePage() {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const { user } = useUserDoc();
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [redeemingId, setRedeemingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { kind: 'success'|'error', message }

  useEffect(() => {
    const q = query(
      collection(db, 'store_items'),
      where('active', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingItems(false);
      },
      (err) => {
        console.error('store_items load error', err);
        setLoadingItems(false);
      }
    );
    return unsub;
  }, []);

  const handleRedeem = async (item) => {
    if (!twitchUser) {
      loginWithTwitch();
      return;
    }
    setRedeemingId(item.id);
    setFeedback(null);
    try {
      const res = await authedFetch('/api/store/redeem', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          kind: 'error',
          message: ERROR_LABELS[data.error] || data.error || 'Something went wrong.',
        });
      } else {
        setFeedback({
          kind: 'success',
          message:
            data.status === 'fulfilled'
              ? `Redeemed ${item.name} — granted.`
              : `Redeemed ${item.name} — pending on stream.`,
        });
      }
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: ERROR_LABELS[err.message] || 'Network error.',
      });
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="relative min-h-screen pt-20 pb-20 px-4 sm:px-6 bg-zinc-broadcast text-white-body">
      <div className="relative z-10 max-w-5xl mx-auto space-y-5">
        {/* Slate header */}
        <header className="mb-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
            <span className="inline-flex items-center gap-2 text-emerald-signal">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              <span>STREAM STORE</span>
            </span>
            <span className="text-white/20">·</span>
            <span>GOOFER.TV</span>
          </div>

          <h1
            className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.5rem, 9vw, 3.5rem)',
            }}
          >
            <span className="block">Spend your</span>
            <span className="block text-emerald-signal">tickets.</span>
          </h1>

          <p className="mt-4 text-sm text-white/60 leading-relaxed max-w-lg">
            Earn tickets by watching streams, claiming daily drops, and joining
            the Discord. Then spend them on cosmetics and on-stream perks below.
          </p>
        </header>

        {/* Auth state */}
        {!twitchUser ? (
          <div className="border border-white/8 bg-zinc-card/30">
            <StatusBar tickets={null} />
            <div className="px-5 py-6 space-y-4">
              <p className="text-sm text-white/70">
                Sign in with Twitch to view your balance and redeem items.
              </p>
              <button
                type="button"
                onClick={loginWithTwitch}
                className="inline-flex items-center justify-center gap-3 px-4 py-3 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                </svg>
                <span className="text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Sign in with Twitch
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-white/8 bg-zinc-card/30">
            <StatusBar tickets={user?.tickets} />
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 bg-zinc-broadcast/40">
              <div className="flex items-center gap-3 min-w-0">
                {twitchUser.profileImageUrl && (
                  <img
                    src={twitchUser.profileImageUrl}
                    alt=""
                    className="w-9 h-9 rounded-full border border-white/15 flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white-body truncate">
                    {twitchUser.displayName}
                  </p>
                  <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-emerald-signal/80 font-mono">
                    Twitch · Authenticated
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
                  Balance
                </p>
                <p className="text-2xl font-black text-emerald-signal tabular-nums leading-none">
                  {user?.tickets ?? '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Feedback toast */}
        {feedback && (
          <div
            className={`flex items-start gap-3 px-4 py-3 border ${
              feedback.kind === 'success'
                ? 'border-emerald-signal/40 bg-emerald-signal/5'
                : 'border-red-destructive/40 bg-red-destructive/5'
            }`}
            role="status"
          >
            {feedback.kind === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-signal mt-0.5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={16} className="text-red-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
            )}
            <p
              className={`text-sm font-bold leading-tight ${
                feedback.kind === 'success' ? 'text-emerald-signal' : 'text-red-destructive'
              }`}
            >
              {feedback.message}
            </p>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="ml-auto text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 hover:text-white-body font-mono"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Items grid */}
        {loadingItems ? (
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
            Loading store…
          </p>
        ) : items.length === 0 ? (
          <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono">
              Store empty
            </p>
            <p className="text-sm text-white/55">
              Nothing on the shelf yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                balance={user?.tickets}
                onRedeem={handleRedeem}
                redeeming={redeemingId === item.id}
                disabled={!twitchUser || (redeemingId && redeemingId !== item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
