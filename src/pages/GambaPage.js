import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BonusHuntsPage from './BonusHunts';
import HuntTracker from '../components/HuntTracker';
import {
  Wallet,
  Target,
  Flame,
  ShieldCheck,
  RefreshCcw,
  ExternalLink,
  Plus,
  X,
  Gamepad2,
  Users,
  Pencil,
  Check,
  MessageSquarePlus,
} from 'lucide-react';
import SlotPicker from '../components/SlotPicker';
import SuggestAdminTab from '../components/SuggestAdminTab';

export default function GambaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTool = location.pathname.split('/')[2] || 'wheel';
  const setActiveTool = (tool) => navigate(`/gamba/${tool}`);
  const riskProfiles = {
    chill: {
      label: 'Chill',
      divisor: 5000,
      note: 'Low variance, longer sessions',
    },
    steady: { label: 'Steady', divisor: 3000, note: 'Default stream pace' },
    spicy: {
      label: 'Spicy',
      divisor: 1000,
      note: 'High volatility — set strict stops',
    },
  };

  // Initialize state from localStorage or use defaults
  const [bankroll, setBankroll] = useState(() => {
    const saved = localStorage.getItem('gamba_bankroll');
    return saved ? Number(saved) : 750;
  });

  const [risk, setRisk] = useState(() => {
    const saved = localStorage.getItem('gamba_risk');
    return saved || 'steady';
  });

  const [stopLoss] = useState(() => {
    const saved = localStorage.getItem('gamba_stopLoss');
    return saved ? Number(saved) : 200;
  });


  // Equity Tracker state
  const [equityPlayers, setEquityPlayers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('equity_players')) || []; } catch { return []; }
  });
  const [equityHuntEnd, setEquityHuntEnd] = useState(() => {
    const saved = localStorage.getItem('equity_hunt_end');
    return saved ? Number(saved) : 0;
  });
  const [equityNameInput, setEquityNameInput] = useState('');
  const [equityRainbetInput, setEquityRainbetInput] = useState('');
  const [equityAmountInput, setEquityAmountInput] = useState('');
  const [equityPicksInput, setEquityPicksInput] = useState(['', '', '', '']);

  // Bonus Hunt state
  const [huntName, setHuntName] = useState('');
  const [startingBalance, setStartingBalance] = useState(0);
  const [bonuses, setBonuses] = useState([]);
  const [bonusGameInput, setBonusGameInput] = useState('');
  const [bonusCostInput, setBonusCostInput] = useState('');

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('gamba_bankroll', bankroll.toString());
  }, [bankroll]);

  useEffect(() => {
    localStorage.setItem('gamba_risk', risk);
  }, [risk]);

  const recommendedBet = useMemo(() => {
    const divisor = riskProfiles[risk].divisor;
    const raw = bankroll / divisor;
    return Math.max(0.01, Math.round(raw * 100) / 100);
  }, [bankroll, risk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bonus Hunt calculations
  const totalBonusCost = useMemo(
    () => bonuses.reduce((sum, bonus) => sum + bonus.cost, 0),
    [bonuses]
  );

  const breakEvenPercentage = useMemo(() => {
    if (totalBonusCost === 0) return 0;
    return ((totalBonusCost / totalBonusCost) * 100).toFixed(1);
  }, [totalBonusCost]);

  const profitPercentage = useMemo(() => {
    if (totalBonusCost === 0) return 0;
    const profitTarget = totalBonusCost * 1.2; // 20% profit
    return ((profitTarget / totalBonusCost) * 100).toFixed(1);
  }, [totalBonusCost]);

  // Bonus Hunt functions
  const addBonus = () => {
    if (
      !bonusGameInput.trim() ||
      !bonusCostInput ||
      Number(bonusCostInput) <= 0
    )
      return;

    const makeId = () =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setBonuses((prev) => [
      ...prev,
      {
        id: makeId(),
        game: bonusGameInput,
        cost: Number(bonusCostInput),
        result: 0,
        opened: false,
      },
    ]);
    setBonusGameInput('');
    setBonusCostInput('');
  };

  const removeBonus = (id) => {
    setBonuses((prev) => prev.filter((bonus) => bonus.id !== id));
  };

  const updateBonusResult = (id, result) => {
    setBonuses((prev) =>
      prev.map((bonus) =>
        bonus.id === id
          ? { ...bonus, result: Number(result), opened: true }
          : bonus
      )
    );
  };

  const resetHunt = () => {
    setHuntName('');
    setStartingBalance(0);
    setBonuses([]);
    setBonusGameInput('');
    setBonusCostInput('');
  };

  // Equity Tracker persistence
  useEffect(() => {
    localStorage.setItem('equity_players', JSON.stringify(equityPlayers));
  }, [equityPlayers]);

  useEffect(() => {
    localStorage.setItem('equity_hunt_end', equityHuntEnd.toString());
  }, [equityHuntEnd]);

  const equityTotalIn = useMemo(
    () => equityPlayers.reduce((sum, p) => sum + p.amount, 0),
    [equityPlayers]
  );

  const addEquityPlayer = () => {
    if (!equityNameInput.trim() || !equityAmountInput || Number(equityAmountInput) <= 0) return;
    setEquityPlayers(prev => [...prev, {
      id: Date.now(),
      name: equityNameInput.trim(),
      rainbet: equityRainbetInput.trim(),
      amount: Number(equityAmountInput),
      picks: equityPicksInput.filter(p => p.trim()),
    }]);
    setEquityNameInput('');
    setEquityRainbetInput('');
    setEquityAmountInput('');
    setEquityPicksInput(['', '', '', '']);
  };

  const removeEquityPlayer = (id) => setEquityPlayers(prev => prev.filter(p => p.id !== id));

  const [editingEquityId, setEditingEquityId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const startEdit = (player) => {
    setEditingEquityId(player.id);
    setEditFields({
      name: player.name,
      rainbet: player.rainbet,
      amount: player.amount,
      picks: [...player.picks, '', '', '', ''].slice(0, 4),
    });
  };

  const saveEdit = (id) => {
    if (!editFields.name?.trim() || !editFields.amount || Number(editFields.amount) <= 0) return;
    setEquityPlayers(prev => prev.map(p => p.id === id ? {
      ...p,
      name: editFields.name.trim(),
      rainbet: editFields.rainbet.trim(),
      amount: Number(editFields.amount),
      picks: editFields.picks.filter(pk => pk.trim()),
    } : p));
    setEditingEquityId(null);
  };

  const resetEquity = () => {
    setEquityPlayers([]);
    setEquityHuntEnd(0);
  };

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        <header className="text-center space-y-4">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              GAMBA CONTROL ROOM
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            On-stream gamba tools to keep the vibes high and the bankroll
            honest. Plan bets, track the session, and keep safety front and
            center.
          </p>

          {/* Tool Selection Buttons */}
          <div className="flex justify-center gap-4 pt-4 flex-wrap">
            <button
              onClick={() => setActiveTool('hunt-tracker')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'hunt-tracker'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <Target size={18} />
              Hunt Tracker
            </button>
            <button
              onClick={() => setActiveTool('bonus-hunts')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'bonus-hunts'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <Target size={18} />
              Bonus Hunts
            </button>
            <button
              onClick={() => setActiveTool('wheel')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'wheel'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <Gamepad2 size={18} />
              Slot Picker
            </button>
            <button
              onClick={() => setActiveTool('suggest')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'suggest'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <MessageSquarePlus size={18} />
              Suggestions
            </button>
          </div>
        </header>

        <div className="space-y-6">
          <div className="space-y-6">
            {/* Suggestions Admin Tab — admin only */}
            {activeTool === 'suggest' && <SuggestAdminTab />}

            {/* Bonus Hunts */}
            {activeTool === 'bonus-hunts' && <BonusHuntsPage />}

            {/* Hunt Tracker */}
            {activeTool === 'hunt-tracker' && <HuntTracker />}

            {/* Slot Picker Tool */}
            {activeTool === 'wheel' && (
              <div className="space-y-6">
                <div className="p-8 bg-gradient-to-br from-orange-900/20 to-pink-900/20 border border-orange-500/20 rounded-xl backdrop-blur-sm">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-orange-300 font-bold mb-2">
                      <Gamepad2 size={18} />
                      Advanced Slot Picker
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter">
                      Find Your Next Slot
                    </h2>
                    <p className="text-white/60">
                      Browse 30+ slots with advanced filters. Search by
                      provider, volatility, RTP, and more.
                    </p>
                  </div>

                  <SlotPicker />
                </div>
              </div>
            )}
          </div>

          {/* Bottom info strip */}
          <div className="grid md:grid-cols-3 gap-6 pt-4 border-t border-white/10">
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <ShieldCheck size={16} />
                Responsible Play
              </div>
              <p className="text-white/70 text-sm">
                Gamba is entertainment and entertainment ONLY. Set limits, take breaks, and mute if you feel tilted. Chat should hear your plan before each session.
              </p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>ƒ?› Cash-out when goal is hit twice in a row.</li>
                <li>ƒ?› If down {stopLoss > 0 ? `$${stopLoss}` : 'your stop-loss'}, call it.</li>
                <li>ƒ?› Hydrate + 5 minute walk every 40 minutes.</li>
                <li>ƒ?› No late-night redeposits.</li>
              </ul>
            </div>

            <div className="p-6 bg-gradient-to-br from-emerald-900/30 to-purple-900/30 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
              <div className="flex items-center gap-2 text-purple-200 font-bold mb-3">
                <Flame size={16} />
                Stream Segment Prompts
              </div>
              <div className="space-y-2 text-sm text-white/70">
                <PromptItem title="Warmup" detail="Low-volatility slots, show bet sizing overlay." />
                <PromptItem title="Heat Check" detail="1-2 higher stakes buys, stop if net goes red twice." />
                <PromptItem title="Cooldown" detail="Switch to high RTP game / react content for 15m." />
                <PromptItem title="Viewer Picks" detail="Run a poll with 3 games you pre-approved." />
              </div>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2 text-purple-200 font-bold">
                <ExternalLink size={16} />
                Resources & Links
              </div>
              <ResourceLink
                title="Broadcast-friendly RTP checker"
                description="Verify picks before stream so chat knows the plan."
                href="https://www.askgamblers.com/online-casinos/slots-rtp"
              />
              <ResourceLink
                title="Responsible gambling (GamCare)"
                description="Helpline + tips for staying within limits."
                href="https://www.gamcare.org.uk/"
              />
              <ResourceLink
                title="Stream checklist template"
                description="Pre/post stream gamba checklist to print or pin."
                href="https://docs.google.com/document/u/0/"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptItem({ title, detail }) {
  return (
    <div className="p-3 rounded-lg bg-black/30 border border-white/5">
      <p className="font-bold text-white">{title}</p>
      <p className="text-white/60 text-sm">{detail}</p>
    </div>
  );
}

function ResourceLink({ title, description, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg bg-black/30 border border-white/5 hover:border-emerald-400/60 transition-all"
    >
      <p className="font-bold text-white">{title}</p>
      <p className="text-white/60 text-sm">{description}</p>
    </a>
  );
}
