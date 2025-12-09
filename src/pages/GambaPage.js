import React, { useMemo, useState, useEffect } from 'react';
import {
  Wallet,
  Target,
  Flame,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Timer,
  ExternalLink,
  BarChart3,
  Plus,
  X,
  Gamepad2,
} from 'lucide-react';
import GameWheel from '../components/GameWheel';

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

  // Slot providers and their popular games
  const slotProviders = {
    Pragmatic: ['Sweet Bonanza', 'Gates of Olympus', 'The Dog House', 'Sugar Rush', 'Starlight Princess'],
    'Play\'n GO': ['Book of Dead', 'Reactoonz', 'Moon Princess', 'Fire Joker', 'Rise of Olympus'],
    NetEnt: ['Starburst', 'Gonzo\'s Quest', 'Dead or Alive 2', 'Blood Suckers', 'Divine Fortune'],
    'Push Gaming': ['Jammin\' Jars', 'Razor Shark', 'Fat Rabbit', 'The Shadow Order', 'Jammin\' Jars 2'],
    'Nolimit City': ['Tombstone RIP', 'San Quentin xWays', 'Mental', 'Fire in the Hole', 'Das xBoot'],
    Hacksaw: ['Wanted Dead or a Wild', 'Chaos Crew', 'RIP City', 'Le Bandit', 'Cubes 2'],
    Relax: ['Money Train 2', 'Money Train 3', 'Snake Arena', 'Templar Tumble', 'TNT Tumble'],
    'Red Tiger': ['Gonzo\'s Quest Megaways', 'Dragon\'s Luck', 'Pirates Plenty', 'Reel King Mega', 'Piggy Riches'],
    'Big Time Gaming': ['Bonanza Megaways', 'Extra Chilli', 'White Rabbit', 'Danger High Voltage', 'Star Clusters'],
    Microgaming: ['Immortal Romance', 'Thunderstruck II', 'Mega Moolah', 'Book of Oz', 'Sisters of Oz'],
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

  const [goal, setGoal] = useState(() => {
    const saved = localStorage.getItem('gamba_goal');
    return saved ? Number(saved) : 250;
  });

  const [stopLoss, setStopLoss] = useState(() => {
    const saved = localStorage.getItem('gamba_stopLoss');
    return saved ? Number(saved) : 200;
  });

  const [entries, setEntries] = useState([]);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [activeTool, setActiveTool] = useState('bankroll'); // 'bankroll', 'session', 'poll', or 'wheel'

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '']);
  const [activePoll, setActivePoll] = useState(null);
  const [pollHistory, setPollHistory] = useState([]);

  // Game Wheel state
  const [enabledProviders, setEnabledProviders] = useState(() => {
    const saved = localStorage.getItem('gamba_enabledProviders');
    return saved ? JSON.parse(saved) : Object.keys(slotProviders);
  });
  const [selectedGame, setSelectedGame] = useState(null);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('gamba_bankroll', bankroll.toString());
  }, [bankroll]);

  useEffect(() => {
    localStorage.setItem('gamba_risk', risk);
  }, [risk]);

  useEffect(() => {
    localStorage.setItem('gamba_goal', goal.toString());
  }, [goal]);

  useEffect(() => {
    localStorage.setItem('gamba_stopLoss', stopLoss.toString());
  }, [stopLoss]);

  useEffect(() => {
    localStorage.setItem('gamba_enabledProviders', JSON.stringify(enabledProviders));
  }, [enabledProviders]);

  // Get filtered games based on enabled providers
  const availableGames = useMemo(() => {
    const games = [];
    enabledProviders.forEach(provider => {
      if (slotProviders[provider]) {
        slotProviders[provider].forEach(game => {
          games.push(`${game} (${provider})`);
        });
      }
    });
    return games;
  }, [enabledProviders, slotProviders]);

  const recommendedBet = useMemo(() => {
    const pct = riskProfiles[risk].pct / 100;
    const raw = bankroll * pct;
    return Math.max(1, Math.round(raw * 100) / 100);
  }, [bankroll, risk, riskProfiles]);

  const sessionNet = useMemo(
    () =>
      entries.reduce(
        (total, entry) =>
          entry.type === 'win' ? total + entry.amount : total - entry.amount,
        0
      ),
    [entries]
  );

  const status =
    sessionNet >= goal
      ? { label: 'Goal hit — lock it in', tone: 'text-emerald-400' }
      : sessionNet <= -stopLoss
      ? { label: 'Stop-loss hit — step away', tone: 'text-red-400' }
      : { label: 'In session', tone: 'text-white/60' };

  const rangeProgress =
    goal + stopLoss === 0
      ? 50
      : Math.min(
          100,
          Math.max(0, ((sessionNet + stopLoss) / (goal + stopLoss)) * 100)
        );

  const quickAdjustments = [10, 25, 50, 100];

  const addEntry = (type, value, quickNote) => {
    const amount =
      typeof value === 'number' ? value : parseFloat(value || amountInput);

    if (Number.isNaN(amount) || amount <= 0) return;

    const makeId = () =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setEntries((prev) => [
      ...prev,
      {
        id: makeId(),
        type,
        amount: Math.round(amount * 100) / 100,
        note: quickNote || noteInput || 'Logged manually',
        at: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    setAmountInput('');
    setNoteInput('');
  };

  const resetSession = () => {
    setEntries([]);
    setAmountInput('');
    setNoteInput('');
  };

  const resetBankrollSettings = () => {
    setBankroll(750);
    setRisk('steady');
    setGoal(250);
    setStopLoss(200);
    localStorage.removeItem('gamba_bankroll');
    localStorage.removeItem('gamba_risk');
    localStorage.removeItem('gamba_goal');
    localStorage.removeItem('gamba_stopLoss');
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

  // Game Wheel functions
  const toggleProvider = (provider) => {
    if (enabledProviders.includes(provider)) {
      // Don't allow disabling all providers
      if (enabledProviders.length > 1) {
        setEnabledProviders(enabledProviders.filter(p => p !== provider));
      }
    } else {
      setEnabledProviders([...enabledProviders, provider]);
    }
  };

  const handleGameChosen = (game) => {
    setSelectedGame(game);
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
              onClick={() => setActiveTool('bankroll')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'bankroll'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <ShieldCheck size={18} />
              Bankroll & Bet Sizing
            </button>
            <button
              onClick={() => setActiveTool('session')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'session'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-purple-400/60'
              }`}
            >
              <ActivityIndicator net={sessionNet} />
              Live Session Log
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
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Bankroll & Bet Sizing Tool */}
            {activeTool === 'bankroll' && (
              <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                      <ShieldCheck size={18} />
                      Session Guardrails
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter">
                      Bankroll & Bet Sizing
                    </h2>
                    <p className="text-white/60">
                      Set risk, stop-loss, and goals before spinning. Stick to
                      the script live.
                    </p>
                  </div>
                  <button
                    onClick={resetBankrollSettings}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all"
                  >
                    <RefreshCcw size={14} />
                    RESET
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="block text-sm text-white/60">
                      Bankroll (live)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <Wallet className="text-emerald-400" size={18} />
                      </div>
                      <input
                        type="number"
                        value={bankroll}
                        onChange={(e) =>
                          setBankroll(Number(e.target.value) || 0)
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(riskProfiles).map(([key, profile]) => (
                        <button
                          key={key}
                          onClick={() => setRisk(key)}
                          className={`px-3 py-2 rounded-lg border text-sm font-bold tracking-wide transition-all duration-200 ${
                            risk === key
                              ? 'bg-gradient-to-r from-emerald-500 to-purple-500 border-transparent text-white'
                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          {profile.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/50">
                      {riskProfiles[risk].note}. Keep chat aware of limits and
                      call out breaks.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <GuardrailInput
                      icon={<Target size={16} />}
                      label="Profit Goal"
                      value={goal}
                      onChange={(e) => setGoal(Number(e.target.value) || 0)}
                    />
                    <GuardrailInput
                      icon={<Flame size={16} />}
                      label="Stop-Loss"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(Number(e.target.value) || 0)}
                    />

                    <div className="p-4 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white/60">
                          Suggested Bet Size
                        </p>
                        <p className="text-2xl font-black tracking-tight text-emerald-400">
                          ${recommendedBet.toLocaleString()}
                        </p>
                        <p className="text-xs text-white/40">
                          {(riskProfiles[risk].pct / 100).toLocaleString(
                            undefined,
                            {
                              style: 'percent',
                              minimumFractionDigits: 1,
                            }
                          )}{' '}
                          of bankroll
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white/60">Break cadence</p>
                        <div className="flex items-center gap-2 font-bold">
                          <Timer size={16} className="text-purple-300" />
                          <span>5m every 40m</span>
                        </div>
                        <p className="text-xs text-white/40">
                          Announce timers on stream
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Session Log Tool */}
            {activeTool === 'session' && (
              <div className="p-8 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 text-purple-300 font-bold mb-2">
                      <ActivityIndicator net={sessionNet} />
                      Session Tracker
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter">
                      Live Session Log
                    </h2>
                    <p className="text-white/60">
                      Fast add wins/losses, track net, and call out when to walk
                      away.
                    </p>
                  </div>
                  <button
                    onClick={resetSession}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all"
                  >
                    <RefreshCcw size={14} />
                    RESET
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <StatCard
                    icon={<TrendingUp size={16} />}
                    label="Net Position"
                    value={`$${sessionNet.toLocaleString()}`}
                    tone={
                      sessionNet > 0
                        ? 'text-emerald-400'
                        : sessionNet < 0
                        ? 'text-red-400'
                        : 'text-white'
                    }
                  />
                  <StatCard
                    icon={<Target size={16} />}
                    label="Profit Goal"
                    value={`$${goal.toLocaleString()}`}
                    tone="text-white"
                  />
                  <StatCard
                    icon={<Flame size={16} />}
                    label="Stop-Loss"
                    value={`-$${stopLoss.toLocaleString()}`}
                    tone="text-white"
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm text-white/60 mb-2">
                    <span>
                      Status:{' '}
                      <span className={status.tone}>{status.label}</span>
                    </span>
                    <span>{Math.round(rangeProgress)}% to range limits</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                      className={`h-full bg-gradient-to-r ${
                        sessionNet >= 0
                          ? 'from-emerald-500 to-purple-500'
                          : 'from-red-500 to-purple-500'
                      } transition-all duration-500`}
                      style={{ width: `${rangeProgress}%` }}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {quickAdjustments.map((value) => (
                        <QuickAdjustButtons
                          key={value}
                          value={value}
                          onWin={() =>
                            addEntry('win', value, `Quick +${value}`)
                          }
                          onLoss={() =>
                            addEntry('loss', value, `Quick -${value}`)
                          }
                        />
                      ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => addEntry('win')}
                        className="flex-1 px-4 py-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 font-bold hover:bg-emerald-500/30 transition-all"
                      >
                        Log Win
                      </button>
                      <button
                        onClick={() => addEntry('loss')}
                        className="flex-1 px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-100 font-bold hover:bg-red-500/30 transition-all"
                      >
                        Log Loss
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3 max-h-72 overflow-y-auto">
                    {entries.length === 0 ? (
                      <p className="text-white/50 text-sm">
                        No entries yet. Add wins/losses to track the run live.
                      </p>
                    ) : (
                      entries
                        .slice()
                        .reverse()
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between p-3 rounded-lg bg-black/30 border border-white/5"
                          >
                            <div>
                              <p
                                className={`font-bold ${
                                  entry.type === 'win'
                                    ? 'text-emerald-300'
                                    : 'text-red-300'
                                }`}
                              >
                                {entry.type === 'win' ? '+$' : '-$'}
                                {entry.amount.toLocaleString()}
                              </p>
                              <p className="text-xs text-white/50">
                                {entry.note}
                              </p>
                            </div>
                            <span className="text-xs text-white/40">
                              {entry.at}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
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

            {/* Game Wheel Tool */}
            {activeTool === 'wheel' && (
              <div className="space-y-6">
                {/* Provider Filter Section */}
                <div className="p-8 bg-gradient-to-br from-orange-900/20 to-pink-900/20 border border-orange-500/20 rounded-xl backdrop-blur-sm">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-orange-300 font-bold mb-2">
                      <Gamepad2 size={18} />
                      Provider Filters
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter">
                      Select Providers
                    </h2>
                    <p className="text-white/60">
                      Choose which slot providers to include in the wheel. At least one must be enabled.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Object.keys(slotProviders).map((provider) => {
                      const isEnabled = enabledProviders.includes(provider);
                      const isLastEnabled = enabledProviders.length === 1 && isEnabled;

                      return (
                        <button
                          key={provider}
                          onClick={() => toggleProvider(provider)}
                          disabled={isLastEnabled}
                          className={`px-4 py-3 rounded-lg border text-sm font-bold tracking-wide transition-all duration-200 ${
                            isEnabled
                              ? 'bg-gradient-to-r from-orange-500 to-pink-500 border-transparent text-white'
                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-orange-400/60'
                          } ${isLastEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {provider}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <p className="text-sm text-orange-200">
                      <strong>{enabledProviders.length}</strong> provider{enabledProviders.length !== 1 ? 's' : ''} enabled •
                      <strong> {availableGames.length}</strong> game{availableGames.length !== 1 ? 's' : ''} in pool
                    </p>
                  </div>
                </div>

                {/* Wheel Section */}
                <div className="p-8 bg-gradient-to-br from-pink-900/20 to-orange-900/20 border border-pink-500/20 rounded-xl backdrop-blur-sm">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-pink-300 font-bold mb-2">
                      <Gamepad2 size={18} />
                      Spin the Wheel
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter">
                      Random Game Picker
                    </h2>
                    <p className="text-white/60">
                      Let fate decide which slot you play next!
                    </p>
                  </div>

                  {availableGames.length > 0 ? (
                    <div className="flex flex-col items-center">
                      <GameWheel
                        games={availableGames}
                        onGameChosen={handleGameChosen}
                      />

                      {selectedGame && (
                        <div className="mt-6 p-6 rounded-lg bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 w-full max-w-md">
                          <p className="text-center text-white/60 text-sm mb-2">
                            Selected Game
                          </p>
                          <p className="text-center text-2xl font-black text-white">
                            {selectedGame}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-white/60">
                        No games available. Please enable at least one provider.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
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

function GuardrailInput({ icon, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-white/60">{label}</label>
      <div className="flex items-center gap-3">
        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
          {icon}
        </div>
        <input
          type="number"
          value={value}
          onChange={onChange}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone }) {
  return (
    <div className="p-4 rounded-lg border border-white/10 bg-white/5">
      <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-black tracking-tight mt-1 ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function QuickAdjustButtons({ value, onWin, onLoss }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/10">
      <button
        onClick={onWin}
        className="px-3 py-2 bg-emerald-500/20 text-emerald-100 text-sm font-bold hover:bg-emerald-500/30 transition-all"
      >
        +${value}
      </button>
      <button
        onClick={onLoss}
        className="px-3 py-2 bg-red-500/20 text-red-100 text-sm font-bold hover:bg-red-500/30 transition-all"
      >
        -${value}
      </button>
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

function ActivityIndicator({ net }) {
  if (net > 0) return <TrendingUp size={16} />;
  if (net < 0) return <TrendingDown size={16} />;
  return <RefreshCcw size={16} />;
}
