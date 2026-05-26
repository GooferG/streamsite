import { useNavigate, useLocation } from 'react-router-dom';
import { Target, Gamepad2, MessageSquarePlus, Layers, Radio } from 'lucide-react';
import BonusHuntsPage from './BonusHunts';
import HuntTracker from '../components/HuntTracker';
import SlotPicker from '../components/SlotPicker';
import SuggestAdminTab from '../components/SuggestAdminTab';
import Leaderboard from '../components/Leaderboard';

const TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', icon: MessageSquarePlus },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ChannelTab({ tool, channelNumber, active, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-3 sm:px-4 py-2 transition-colors duration-150 border-r border-white/8 last:border-r-0 ${
        active
          ? 'bg-zinc-card text-white-body'
          : 'text-white/70 hover:text-white-body hover:bg-zinc-card/40'
      }`}
    >
      <span
        className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums font-mono ${
          active ? 'text-emerald-signal' : 'text-white/55'
        }`}
      >
        CH {pad2(channelNumber)}
      </span>
      <Icon size={13} aria-hidden="true" className="opacity-80 flex-shrink-0 hidden sm:inline" />
      <span className="text-xs font-bold tracking-eyebrow-sm uppercase font-mono truncate">
        {tool.label}
      </span>
      {active && (
        <span
          className="absolute inset-x-0 -bottom-px h-px bg-emerald-signal"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default function GambaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTool = location.pathname.split('/')[2] || 'leaderboard';
  const setActiveTool = (tool) => navigate(`/gamba/${tool}`);

  return (
    <div className="pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Channel strip — slim broadcast tab nav */}
        <div className="grid grid-cols-5 border border-white/8 bg-zinc-card/30">
          {TOOLS.map((tool, i) => (
            <ChannelTab
              key={tool.id}
              tool={tool}
              channelNumber={i + 1}
              active={activeTool === tool.id}
              onClick={() => setActiveTool(tool.id)}
            />
          ))}
        </div>

        {/* Tool surface */}
        <div className="mt-4">
          {activeTool === 'leaderboard' && <Leaderboard />}
          {activeTool === 'suggest' && <SuggestAdminTab />}
          {activeTool === 'bonus-hunts' && <BonusHuntsPage />}
          {activeTool === 'hunt-tracker' && <HuntTracker />}
          {activeTool === 'wheel' && <SlotPicker />}
        </div>
      </div>
    </div>
  );
}
