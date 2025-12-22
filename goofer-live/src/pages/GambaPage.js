import { useMemo, useState, useEffect } from 'react';
import {
  Wallet,
  Target,
  Flame,
  ShieldCheck,
  RefreshCcw,
  ExternalLink,
  BarChart3,
  Plus,
  X,
  Gamepad2,
} from 'lucide-react';
import SlotPicker from '../components/SlotPicker';

export default function GambaPage() {
  const riskProfiles = {
    chill: { label: 'Chill', pct: 0.5, note: 'Max 0.5% per spin/hand' },
    steady: { label: 'Steady', pct: 1, note: 'Default stream pace' },
    spicy: {
      label: 'Spicy',
      pct: 2,
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

  const [activeTool, setActiveTool] = useState('hunt'); // 'hunt', 'poll', or 'wheel'

  // Bonus Hunt state
  const [huntName, setHuntName] = useState('');
  const [startingBalance, setStartingBalance] = useState(0);
  const [bonuses, setBonuses] = useState([]);
  const [bonusGameInput, setBonusGameInput] = useState('');
  const [bonusCostInput, setBonusCostInput] = useState('');

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '']);
  const [activePoll, setActivePoll] = useState(null);
  const [pollHistory, setPollHistory] = useState([]);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('gamba_bankroll', bankroll.toString());
  }, [bankroll]);

  useEffect(() => {
    localStorage.setItem('gamba_risk', risk);
  }, [risk]);

  const recommendedBet = useMemo(() => {
    const pct = riskProfiles[risk].pct / 100;
    const raw = bankroll * pct;
    return Math.max(1, Math.round(raw * 100) / 100);
  }, [bankroll, risk, riskProfiles]);

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

  // Poll functions
  const createPoll = () => {
    if (!pollQuestion.trim()) return;
    const validOptions = pollOptions.filter((opt) => opt.trim() !== '');
    if (validOptions.length < 2) return;

    const newPoll = {
      id: Date.now(),
      question: pollQuestion,
      options: validOptions.map((opt, idx) => ({
        id: idx,
        text: opt,
        votes: 0,
      })),
      createdAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setActivePoll(newPoll);
    setPollQuestion('');
    setPollOptions(['', '', '']);
  };

  const vote = (optionId) => {
    if (!activePoll) return;
    setActivePoll({
      ...activePoll,
      options: activePoll.options.map((opt) =>
        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
      ),
    });
  };

  const endPoll = () => {
    if (!activePoll) return;
    setPollHistory([activePoll, ...pollHistory]);
    setActivePoll(null);
  };

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index, value) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
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
              onClick={() => setActiveTool('hunt')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'hunt'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <Target size={18} />
              Bonus Hunt
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
              Game Wheel
            </button>
            <button
              onClick={() => setActiveTool('poll')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'poll'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <BarChart3 size={18} />
              Viewer Polls
            </button>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Bonus Hunt Tracker */}
            {activeTool === 'hunt' && (
              <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                      <Target size={18} />
                      Bonus Hunt Tracker
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter">
                      Track Your Bonus Hunt
                    </h2>
                    <p className="text-white/60">
                      Add bonuses, track costs, and see what percentage you need
                      to break even or profit.
                    </p>
                  </div>
                  <button
                    onClick={resetHunt}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all"
                  >
                    <RefreshCcw size={14} />
                    RESET
                  </button>
                </div>

                {/* Hunt Details */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">
                      Hunt Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Friday Night Hunt"
                      value={huntName}
                      onChange={(e) => setHuntName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">
                      Starting Balance
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={startingBalance || ''}
                      onChange={(e) =>
                        setStartingBalance(Number(e.target.value) || 0)
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <p className="text-xs text-white/60 mb-1">Total Cost</p>
                    <p className="text-2xl font-black text-white">
                      ${totalBonusCost.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-xs text-emerald-400 mb-1">Break Even</p>
                    <p className="text-2xl font-black text-emerald-300">
                      {breakEvenPercentage}%
                    </p>
                  </div>
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <p className="text-xs text-purple-400 mb-1">Profit (20%)</p>
                    <p className="text-2xl font-black text-purple-300">
                      {profitPercentage}%
                    </p>
                  </div>
                </div>

                {/* Add Bonus Form */}
                <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
                  <h3 className="text-sm font-bold text-white/70 mb-3">
                    Add Bonus
                  </h3>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Game name"
                      value={bonusGameInput}
                      onChange={(e) => setBonusGameInput(e.target.value)}
                      className="sm:col-span-2 bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Cost"
                      value={bonusCostInput}
                      onChange={(e) => setBonusCostInput(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={addBonus}
                    className="w-full mt-3 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-bold hover:from-emerald-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Add Bonus
                  </button>
                </div>

                {/* Bonuses List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white/70">
                    Bonuses ({bonuses.length})
                  </h3>
                  {bonuses.length === 0 ? (
                    <div className="text-center py-8 text-white/50">
                      No bonuses added yet. Add your first bonus above!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bonuses.map((bonus) => (
                        <div
                          key={bonus.id}
                          className="p-4 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between gap-4"
                        >
                          <div className="flex-1">
                            <p className="font-bold text-white">{bonus.game}</p>
                            <p className="text-sm text-white/60">
                              Cost: ${bonus.cost.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Result"
                              value={bonus.result || ''}
                              onChange={(e) =>
                                updateBonusResult(bonus.id, e.target.value)
                              }
                              className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                            />
                            <button
                              onClick={() => removeBonus(bonus.id)}
                              className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Viewer Polls Tool */}
            {activeTool === 'poll' && (
              <div className="space-y-6">
                {/* Create Poll Section */}
                {!activePoll && (
                  <div className="p-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                    <div className="mb-6">
                      <div className="flex items-center gap-2 text-blue-300 font-bold mb-2">
                        <BarChart3 size={18} />
                        Create Poll
                      </div>
                      <h2 className="text-3xl font-black tracking-tighter">
                        Viewer Poll Creator
                      </h2>
                      <p className="text-white/60">
                        Let your viewers vote on which slot to play next.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-white/60 mb-2">
                          Poll Question
                        </label>
                        <input
                          type="text"
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="e.g., Which slot should we play next?"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-white/60 mb-2">
                          Options (2-6)
                        </label>
                        <div className="space-y-2">
                          {pollOptions.map((option, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) =>
                                  updatePollOption(index, e.target.value)
                                }
                                placeholder={`Option ${index + 1}`}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-400 focus:outline-none"
                              />
                              {pollOptions.length > 2 && (
                                <button
                                  onClick={() => removePollOption(index)}
                                  className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-100 hover:bg-red-500/30 transition-all"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {pollOptions.length < 6 && (
                          <button
                            onClick={addPollOption}
                            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-blue-400/60 transition-all"
                          >
                            <Plus size={16} />
                            Add Option
                          </button>
                        )}
                      </div>

                      <button
                        onClick={createPoll}
                        disabled={
                          !pollQuestion.trim() ||
                          pollOptions.filter((opt) => opt.trim()).length < 2
                        }
                        className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Start Poll
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Poll Section */}
                {activePoll && (
                  <div className="p-8 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-2 text-purple-300 font-bold mb-2">
                          <BarChart3 size={18} />
                          Active Poll
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter">
                          {activePoll.question}
                        </h2>
                        <p className="text-white/60">
                          Started at {activePoll.createdAt}
                        </p>
                      </div>
                      <button
                        onClick={endPoll}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-red-400/60 transition-all"
                      >
                        <RefreshCcw size={14} />
                        END POLL
                      </button>
                    </div>

                    <div className="space-y-3">
                      {activePoll.options.map((option) => {
                        const totalVotes = activePoll.options.reduce(
                          (sum, opt) => sum + opt.votes,
                          0
                        );
                        const percentage =
                          totalVotes > 0
                            ? ((option.votes / totalVotes) * 100).toFixed(1)
                            : 0;

                        return (
                          <div
                            key={option.id}
                            className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-purple-400/60 transition-all cursor-pointer"
                            onClick={() => vote(option.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-white">
                                {option.text}
                              </span>
                              <div className="flex items-center gap-4">
                                <span className="text-purple-300 font-bold">
                                  {percentage}%
                                </span>
                                <span className="text-white/60 text-sm">
                                  {option.votes} votes
                                </span>
                              </div>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-sm text-blue-200">
                        <strong>Stream Tip:</strong> Click an option to manually
                        add a vote, or integrate with Twitch chat commands for
                        automatic voting.
                      </p>
                    </div>
                  </div>
                )}

                {/* Poll History */}
                {pollHistory.length > 0 && !activePoll && (
                  <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                    <h3 className="text-xl font-bold mb-4">Recent Polls</h3>
                    <div className="space-y-3">
                      {pollHistory.slice(0, 3).map((poll) => {
                        const winner = poll.options.reduce((prev, current) =>
                          current.votes > prev.votes ? current : prev
                        );
                        const totalVotes = poll.options.reduce(
                          (sum, opt) => sum + opt.votes,
                          0
                        );

                        return (
                          <div
                            key={poll.id}
                            className="p-4 rounded-lg bg-black/30 border border-white/5"
                          >
                            <p className="font-bold text-white mb-1">
                              {poll.question}
                            </p>
                            <p className="text-sm text-emerald-300">
                              Winner: {winner.text} ({winner.votes} votes)
                            </p>
                            <p className="text-xs text-white/50">
                              {poll.createdAt} • {totalVotes} total votes
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

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

          <div className="space-y-6">
            {/* Compact Bankroll & Bet Sizing */}
            {activeTool === 'hunt' && (
              <div className="p-6 bg-gradient-to-br from-blue-900/20 to-emerald-900/20 border border-blue-500/20 rounded-xl backdrop-blur-sm space-y-4">
                <div className="flex items-center gap-2 text-blue-300 font-bold mb-2">
                  <Wallet size={16} />
                  Bankroll & Bet Sizing
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-2">
                      Current Bankroll
                    </label>
                    <input
                      type="number"
                      value={bankroll}
                      onChange={(e) => setBankroll(Number(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/60 mb-2">
                      Risk Profile
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(riskProfiles).map(([key, profile]) => (
                        <button
                          key={key}
                          onClick={() => setRisk(key)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                            risk === key
                              ? 'bg-blue-500/30 border border-blue-400/60 text-blue-200'
                              : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          {profile.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/50 mt-2">
                      {riskProfiles[risk].note}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/60">Recommended Bet</span>
                      <span className="text-xs text-white/40">{riskProfiles[risk].pct}% of bankroll</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-300">
                      ${recommendedBet.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <ShieldCheck size={16} />
                Responsible Play
              </div>
              <p className="text-white/70 text-sm">
                Gamba is entertainment and entertainment ONLY. Set limits, take
                breaks, and mute if you feel tilted. Chat should hear your plan
                before each session.
              </p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>ƒ?› Cash-out when goal is hit twice in a row.</li>
                <li>
                  ƒ?› If down {stopLoss > 0 ? `$${stopLoss}` : 'your stop-loss'}
                  , call it.
                </li>
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
                <PromptItem
                  title="Warmup"
                  detail="Low-volatility slots, show bet sizing overlay."
                />
                <PromptItem
                  title="Heat Check"
                  detail="1-2 higher stakes buys, stop if net goes red twice."
                />
                <PromptItem
                  title="Cooldown"
                  detail="Switch to high RTP game / react content for 15m."
                />
                <PromptItem
                  title="Viewer Picks"
                  detail="Run a poll with 3 games you pre-approved."
                />
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
