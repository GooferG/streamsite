import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MessageSquarePlus,
  Store,
  Inbox,
  Ticket,
  ChevronRight,
} from 'lucide-react';

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
    title: 'Tickets',
    description:
      'Search viewers by Twitch login. Grant or deduct tickets manually and audit the ledger.',
  },
];

function HubCard({ to, icon: Icon, code, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left border border-white/8 bg-zinc-card/30 hover:border-orange-admin/40 hover:bg-zinc-card/50 transition-colors duration-150"
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono"
      >
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

export default function AdminHubPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      {/* Slate header */}
      <header className="mb-10">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono"
      >
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>OPERATOR HUB</span>
          </span>
          <span className="text-white/20">·</span>
          <span>CHANNEL</span>
          <span className="text-white/70 tracking-eyebrow-lg">GG-ADMIN</span>
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
        {HUB_CARDS.map((card) => (
          <HubCard key={card.to} {...card} onClick={() => navigate(card.to)} />
        ))}
      </div>
    </div>
  );
}
