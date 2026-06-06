import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MessageSquarePlus,
  Store,
  Inbox,
  Ticket,
  Gift,
  TrendingUp,
  Megaphone,
  ChevronRight,
  AlertTriangle,
  X,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { authedFetch } from '../utils/authedFetch';
import { useAuth } from '../contexts/AuthContext';

const HUB_CARDS = [
  {
    to: '/admin/schedule',
    icon: Calendar,
    code: 'SCH',
    title: 'Schedule',
    description:
      'Edit the weekly stream schedule. Changes reflect on the public page immediately.',
  },
  {
    to: '/admin/suggestions',
    icon: MessageSquarePlus,
    code: 'SUG',
    title: 'Suggestions',
    description:
      'Manage viewer game suggestions. Highlight picks, edit entries, or clear the list.',
  },
  {
    to: '/admin/store',
    icon: Store,
    code: 'STR',
    title: 'Store catalog',
    ownerOnly: true,
    description:
      'Create and edit ticket-store items. Virtual items auto-grant; stream items go to the redemption queue.',
  },
  {
    to: '/admin/redemptions',
    icon: Inbox,
    code: 'RED',
    title: 'Redemption queue',
    description:
      'Fulfill pending stream-affecting redemptions, or cancel and refund tickets back to viewers.',
  },
  {
    to: '/admin/tickets',
    icon: Ticket,
    code: 'TKT',
    title: 'Users tickets',
    description:
      'Search viewers by Twitch login. Grant or deduct tickets manually and audit the ledger.',
  },
  {
    to: '/admin/giveaways',
    icon: Gift,
    code: 'GVW',
    title: 'Giveaways',
    description:
      'Run keyword-based giveaways. Pick weighted winners on stream with a live-chat modal.',
  },
  {
    to: '/admin/hunts',
    icon: TrendingUp,
    code: 'PRD',
    title: 'Predictions',
    description:
      'Run prediction rounds with viewer guesses and/or slot suggestions. Snapshot from bonushunt.gg, settle winners, manage the suggestion queue.',
  },
  {
    to: '/admin/community-hunts',
    icon: Megaphone,
    code: 'CHT',
    title: 'Community Hunts',
    description:
      "Dashboard of viewers' bonus-hunt tracker sessions. See live hunts in progress and completed history with stats, biggest wins, and slot-caller leaderboards.",
  },
  {
    to: '/admin/users',
    icon: Users,
    code: 'USR',
    title: 'Users',
    description:
      'Dashboard of every signed-in viewer. See tickets, Discord linkage, giveaway entries, hunt predictions, slot suggestions, and recent ledger activity.',
  },
  {
    to: '/admin/moderators',
    icon: ShieldCheck,
    code: 'MOD',
    title: 'Moderators',
    ownerOnly: true,
    description:
      'Add or remove trusted Twitch accounts who can help run giveaways, fulfill redemptions, and manage hunts.',
  },
];

const RESET_SCOPES = [
  {
    key: 'giveaways',
    label: 'Giveaways',
    detail: 'All giveaway docs, entries, winner messages, history.',
  },
  {
    key: 'redemptions',
    label: 'Redemptions',
    detail: 'Every redemption (store purchases + giveaway prizes).',
  },
  {
    key: 'tickets',
    label: 'Tickets (balances + ledger)',
    detail:
      'Resets every user’s tickets, totalEarned, totalSpent, lastDailyClaimAt. Wipes the full ticket_ledger. User identity (Twitch/Discord links) is preserved.',
  },
  {
    key: 'hunts',
    label: 'Hunts',
    detail: 'All bonus-hunt rounds, entries, suggestions. Future hunts work normally.',
  },
  {
    key: 'eventsubCache',
    label: 'EventSub dedupe cache',
    detail: 'Housekeeping. Wipes eventsub_seen/* (message-id dedupe rows).',
  },
];

function HubCard({ to, icon: Icon, code, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left border border-white/8 bg-zinc-card/30 hover:border-orange-admin/40 hover:bg-zinc-card/50 transition-colors duration-150"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono">
        <span className="inline-flex items-center gap-2 text-orange-admin">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
          <span>Module</span>
          <span className="text-white/70 tracking-eyebrow-lg">{code}</span>
        </span>
        <ChevronRight
          size={14}
          className="text-white/30 group-hover:text-orange-admin group-hover:translate-x-0.5 transition-all duration-150"
          aria-hidden="true"
        />
      </div>

      <div className="px-5 py-6 space-y-4">
        <div className="inline-flex items-center justify-center w-10 h-10 border border-white/10 text-white/65 group-hover:text-orange-admin group-hover:border-orange-admin/40 transition-colors duration-150">
          <Icon size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white-body tracking-tight">
            {title}
          </h2>
          <p className="mt-1.5 text-sm text-white/55 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

function ResetModal({ onClose }) {
  const [selected, setSelected] = useState({
    giveaways: false,
    redemptions: false,
    tickets: false,
    hunts: false,
    eventsubCache: false,
  });
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const anySelected = Object.values(selected).some(Boolean);
  const canRun = anySelected && confirmText === 'WIPE' && !running;

  const toggle = (key) =>
    setSelected((s) => ({ ...s, [key]: !s[key] }));

  const run = async () => {
    setError(null);
    setRunning(true);
    try {
      const res = await authedFetch('/api/admin/reset', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'WIPE', scopes: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed.');
      } else {
        setResult(data.deleted);
      }
    } catch (err) {
      setError(err.message || 'Failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-red-destructive/40 bg-zinc-broadcast"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-red-destructive">
            <AlertTriangle size={14} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              Danger zone · wipe test data
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white-body transition-colors"
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-emerald-signal font-mono">
              Done. Wiped:
            </p>
            <ul className="text-sm text-white/75 space-y-1 font-mono">
              {Object.entries(result).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-3">
                  <span className="text-white/55">{k}</span>
                  <span className="tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 px-3 py-2.5 border border-white/15 text-white/70 hover:text-white-body text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-sm text-white/65 leading-relaxed">
              Select what to wipe. <span className="text-red-destructive font-bold">This is permanent.</span>{' '}
              Type <span className="font-mono text-orange-admin font-bold">WIPE</span> to enable the button.
            </p>

            <div className="space-y-2">
              {RESET_SCOPES.map((scope) => (
                <label
                  key={scope.key}
                  className="flex items-start gap-3 p-3 border border-white/10 bg-zinc-card/40 cursor-pointer hover:border-white/20 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected[scope.key]}
                    onChange={() => toggle(scope.key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white-body font-mono">
                      {scope.label}
                    </p>
                    <p className="mt-1 text-[0.6875rem] text-white/50 leading-snug">
                      {scope.detail}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                Type WIPE to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="WIPE"
                className="w-full px-3 py-2 bg-zinc-card border border-white/10 text-white-body font-mono text-sm focus:outline-none focus:border-red-destructive/60"
                autoComplete="off"
              />
            </div>

            {error && (
              <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={running}
                className="flex-1 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={!canRun}
                className="flex-1 px-3 py-2.5 bg-red-destructive text-white-body hover:opacity-90 transition-opacity text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {running ? 'Wiping…' : 'Wipe selected'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminHubPage() {
  const navigate = useNavigate();
  const { isOwner, role } = useAuth();
  const [resetOpen, setResetOpen] = useState(false);

  const visibleCards = HUB_CARDS.filter((c) => !c.ownerOnly || isOwner);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      {/* Slate header */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>OPERATOR HUB</span>
          </span>
          <span className="text-white/20">·</span>
          <span>ROLE</span>
          <span className="text-white/70 tracking-eyebrow-lg">
            {role === 'owner' ? 'OWNER' : 'MODERATOR'}
          </span>
        </div>

        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
          }}
        >
          <span className="block">What are we</span>
          <span className="block text-orange-admin">managing?</span>
        </h1>

        <p className="mt-4 text-sm text-white/55 max-w-md leading-relaxed">
          Pick a module to get started.
        </p>
      </header>

      {/* Module grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {visibleCards.map((card) => (
          <HubCard key={card.to} {...card} onClick={() => navigate(card.to)} />
        ))}
      </div>

      {/* Danger zone — owner only */}
      {isOwner && (
        <section className="mt-12 border border-red-destructive/30 bg-red-destructive/5">
          <div className="px-5 py-3 border-b border-red-destructive/20 flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-destructive" aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-red-destructive font-mono">
              Danger zone · database
            </span>
          </div>
          <div className="px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <div className="max-w-md">
              <p className="text-sm text-white-body font-bold">Wipe test data</p>
              <p className="mt-1 text-sm text-white/55 leading-relaxed">
                Clear giveaways, redemptions, tickets, hunts, or EventSub cache. User accounts and the store catalog are preserved. Choose scope in the next step.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/10 transition-colors duration-150 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
            >
              <AlertTriangle size={12} aria-hidden="true" />
              Open wipe panel
            </button>
          </div>
        </section>
      )}

      {resetOpen && <ResetModal onClose={() => setResetOpen(false)} />}
    </div>
  );
}
