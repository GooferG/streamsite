import { useNavigate, useLocation } from 'react-router-dom';
import { Target, Gamepad2, MessageSquarePlus, Layers } from 'lucide-react';
import BonusHuntsPage from './BonusHunts';
import HuntTracker from '../components/HuntTracker';
import SlotPicker from '../components/SlotPicker';
import SuggestAdminTab from '../components/SuggestAdminTab';

const TOOLS = [
  { id: 'hunt-tracker', label: 'Hunt Tracker', code: 'HT', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', code: 'BH', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', code: 'SP', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', code: 'SG', icon: MessageSquarePlus },
];

function ToolTab({ tool, active, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2.5 px-3 sm:px-4 py-3 transition-colors duration-150 ${
        active
          ? 'bg-zinc-card text-white-body'
          : 'text-white/75 hover:text-white-body hover:bg-zinc-card/40'
      }`}
    >
      <span
        className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums ${
          active ? 'text-emerald-signal' : 'text-white/60'
        } font-mono`}
      >
        {tool.code}
      </span>
      <Icon size={14} aria-hidden="true" className="opacity-80 flex-shrink-0" />
      <span className="text-sm font-bold tracking-tight truncate">
        {tool.label}
      </span>
      {active && (
        <span
          className="ml-auto text-[10px] font-bold tracking-eyebrow-lg text-emerald-signal font-mono"
      >
          ON
        </span>
      )}
    </button>
  );
}

export default function GambaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTool = location.pathname.split('/')[2] || 'wheel';
  const setActiveTool = (tool) => navigate(`/gamba/${tool}`);

  const activeMeta = TOOLS.find((t) => t.id === activeTool) || TOOLS[2];

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Toolbar header — control panel register, not slate */}
        <div className="relative overflow-hidden border border-white/8 bg-zinc-card/30">
          {/* Atmospheric backing — scoped to shell only */}
          <div
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-signal/10 blur-3xl motion-reduce:hidden"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
            aria-hidden="true"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
            }}
          />

          {/* Status bar */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono"
      >
            <span className="inline-flex items-center gap-2 text-emerald-signal">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              <span>CONTROL ROOM</span>
            </span>
            <span className="text-white/20">·</span>
            <span className="text-white/65">CHANNEL</span>
            <span className="text-white/85 tracking-eyebrow-lg">GG-02</span>
            <span className="text-white/20">·</span>
            <span className="text-white/65">MODULE</span>
            <span className="text-white/85 tracking-eyebrow-lg">
              {activeMeta.code}
            </span>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="hidden sm:inline text-white/60">
              On-stream gamba tools. Entertainment only.
            </span>
          </div>

          {/* Tool tabs — 2x2 on mobile, single row on sm+ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/8 divide-x divide-y sm:divide-y-0 divide-white/8">
            {TOOLS.map((tool) => (
              <ToolTab
                key={tool.id}
                tool={tool}
                active={activeTool === tool.id}
                onClick={() => setActiveTool(tool.id)}
              />
            ))}
          </div>

          {/* Active module slate */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-4">
            <div className="flex items-baseline gap-4">
              <span
                className="text-[10px] font-bold tracking-eyebrow-lg text-white/65 tabular-nums font-mono"
      >
                MODULE {activeMeta.code}
              </span>
              <h1
                className="text-xl sm:text-2xl font-bold tracking-tight text-white-body"
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
              >
                {activeMeta.label}
              </h1>
            </div>
            <span
              className="text-[10px] font-bold tracking-eyebrow-md text-white/60 font-mono"
      >
              READY
            </span>
          </div>
        </div>

        {/* Tool surface — untouched, hosted in a plain container */}
        <div className="mt-6">
          {activeTool === 'suggest' && <SuggestAdminTab />}
          {activeTool === 'bonus-hunts' && <BonusHuntsPage />}
          {activeTool === 'hunt-tracker' && <HuntTracker />}
          {activeTool === 'wheel' && <SlotPicker />}
        </div>
      </div>
    </div>
  );
}
