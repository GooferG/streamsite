import { useNavigate } from 'react-router-dom';
import { Calendar, MessageSquarePlus, LayoutDashboard } from 'lucide-react';

const HUB_CARDS = [
  {
    to: '/admin/schedule',
    icon: Calendar,
    title: 'Schedule',
    description: 'Edit your stream schedule. Changes reflect on the public schedule page immediately.',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    to: '/admin/suggestions',
    icon: MessageSquarePlus,
    title: 'Suggestions',
    description: 'Manage viewer game suggestions. Highlight picks, edit entries, reorder, or clear the list.',
    color: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/30',
    iconColor: 'text-purple-400',
  },
];

export default function AdminHubPage() {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-2 text-white/40 font-bold text-sm mb-3">
          <LayoutDashboard size={16} />
          ADMIN HUB
        </div>
        <h1 className="text-5xl font-black tracking-tighter">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            What are we managing?
          </span>
        </h1>
        <p className="text-white/50 mt-3 text-lg">Pick a section to get started.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {HUB_CARDS.map(({ to, icon: Icon, title, description, color, border, iconColor }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`text-left p-8 rounded-2xl bg-gradient-to-br ${color} border ${border} hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 space-y-4`}
          >
            <div className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${iconColor}`}>
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
              <p className="text-white/60 mt-1 text-sm leading-relaxed">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
