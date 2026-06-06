// app-root.jsx — header, stats grid, root App (state + tweaks).
const { useState: useStateR, useMemo: useMemoR } = React;
const HR = window.HUNT;

function HuntHeader({ name, started, onStart, openedAll }) {
  return (
    <header className="hunt-head">
      <button className="back-btn"><Icon name="arrowL" size={15} /></button>
      <div className="hunt-id">
        <div className="hunt-kicker mono"><span className="dot live" /> ACTIVE HUNT · 06 / 05 / 2026</div>
        <h1 className="hunt-name">{name} <button className="name-edit"><Icon name="edit" size={14} /></button></h1>
      </div>
      <div className="head-actions">
        {!started
          ? <Btn kind="accent" icon="play" onClick={onStart}>Start opening</Btn>
          : <Btn kind="accent" icon="play" onClick={onStart}>Resume opening</Btn>}
        <Btn kind="ghost" icon="users">Collab</Btn>
        <LinkPopover label="Share" icon="link" kind="ghost" align="right"
          title="WATCH · LIVE" url="goofer.tv/live/31b7145b-989f-4269"
          note="Live · viewers are watching this hunt"
          danger={{ icon: "stop", label: "Stop stream" }} />
        <Btn kind="ghost" icon="download">Export split</Btn>
        <Btn kind={openedAll ? "success" : "ghost"} icon="check">Complete</Btn>
        <button className="btn btn-ghost btn-icon"><Icon name="dots" size={16} /></button>
      </div>
    </header>
  );
}

function StatsGrid({ stats, startCost, dense }) {
  const pace = { reqX: stats.reqX, behind: stats.profit < 0 };
  const secondary = [
    { label: "BONUSES",  value: <span>{stats.count}</span>, sub: `${stats.remaining} pending` },
    { label: "START COST", value: fmt$(startCost) },
    { label: "WINNINGS", value: fmt$(stats.winnings), tone: stats.winnings > 0 ? "pos" : null },
    { label: "AVG REQ",  value: fmt$(stats.avgReq) },
    { label: "CUR AVG",  value: fmt$(stats.curAvg) },
    { label: "TOTAL X",  value: fmtX(stats.totalX) },
    { label: "REQ X",    value: fmtX(stats.reqX) },
    { label: "CUR AVG X",value: fmtX(stats.curAvgX), tone: stats.curAvgX >= stats.reqX ? "pos" : "neg" },
  ];
  const shown = dense ? secondary.slice(0, 4) : secondary;
  return (
    <div className="stats-grid">
      <HeroStat profit={stats.profit} startCost={startCost} winnings={stats.winnings} pace={pace} />
      <div className={"stat-cards" + (dense ? " dense" : "")}>
        {shown.map((s) => <StatCard key={s.label} {...s} />)}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [bonuses, setBonuses] = useStateR(HR.SEED_BONUSES);
  const [squad, setSquad] = useStateR(HR.SEED_SQUAD);
  const [calls, setCalls] = useStateR(HR.SEED_CALLS);
  const [banned, setBanned] = useStateR(["Wild Wild Riches", "Juicy Fruits"]);
  const [ledger, setLedger] = useStateR(HR.SEED_CALLER_LEDGER);
  const [started, setStarted] = useStateR(true);
  const [tip, setTip] = useStateR(true);
  const [openMode, setOpenMode] = useStateR(false);
  const [openIdx, setOpenIdx] = useStateR(0);
  const [logCaller, setLogCaller] = useStateR(null);

  const startCost = HR.START_COST;
  const stats = useMemoR(() => HR.computeStats(bonuses, startCost), [bonuses]);

  function enterOpening() {
    const firstPending = bonuses.findIndex((b) => !b.opened);
    setOpenIdx(firstPending >= 0 ? firstPending : 0);
    setStarted(true);
    setOpenMode(true);
  }

  function addBonus(b) {
    const provs = HR.PROVIDERS;
    setBonuses((prev) => [...prev, {
      id: "b" + Date.now(), provider: provs[Math.floor(Math.random() * provs.length)],
      payout: null, opened: false, ...b,
    }]);
  }
  function openBonus(id, payout, note) {
    setBonuses((prev) => prev.map((b) => b.id === id ? { ...b, payout, opened: true, note: note !== undefined ? note : b.note } : b));
  }
  function delBonus(id) { setBonuses((prev) => prev.filter((b) => b.id !== id)); }

  function addMember(m) { setSquad((p) => [...p, { id: "s" + Date.now(), ...m }]); }
  function editMember(id, val) { setSquad((p) => p.map((m) => m.id === id ? { ...m, in: val } : m)); }
  function rmMember(id) { setSquad((p) => p.filter((m) => m.id !== id)); }

  function promoteCall(c) {
    addBonus({ game: c.game, bet: 5, caller: c.caller, type: "regular" });
    setCalls((p) => p.filter((x) => x.id !== c.id));
  }
  function missCall(c) {
    setCalls((p) => p.filter((x) => x.id !== c.id));
    setLedger((prev) => {
      const i = prev.findIndex((l) => l.name === c.caller);
      if (i === -1) return [...prev, { name: c.caller, gotInPrev: 0, missedPrev: 1, prevX: [] }];
      return prev.map((l, j) => j === i ? { ...l, missedPrev: l.missedPrev + 1 } : l);
    });
  }

  const basis = t.splitBasis === "profit" ? stats.profit : stats.winnings;
  const basisLabel = t.splitBasis === "profit" ? "Net P/L" : "Winnings pool";

  const accentVars = t.brand === "gooferg" ? {} : {
    "--accent": t.accent[0], "--accent-soft": t.accent[1], "--accent-dim": t.accent[2],
  };

  return (
    <div className={"app fnt-" + t.font + (t.brand === "gooferg" ? " brand-gooferg" : "")} style={accentVars} data-density={t.density}>
      <ChannelNav />
      <main className="stage">
        <HuntHeader name={HR.HUNT_NAME} started={started} onStart={enterOpening}
          openedAll={stats.remaining === 0} />
        <StatsGrid stats={stats} startCost={startCost} dense={t.statMode === "compact"} />
        {openMode ? (
          <OpeningFlow bonuses={bonuses} idx={openIdx} setIdx={setOpenIdx}
            onSave={openBonus} onExit={() => setOpenMode(false)} />
        ) : (
        <React.Fragment>
        {t.showTip && tip && <AssistantTip onClose={() => setTip(false)} />}
        <div className="work-grid">
          <div className="col-main">
            <BonusLog bonuses={bonuses} onAdd={addBonus} onOpen={openBonus} onDelete={delBonus}
              stats={stats} logStyle={t.logStyle} />
          </div>
          <div className="col-side">
            <SquadSplit squad={squad} onAdd={addMember} onEdit={editMember} onRemove={rmMember}
              basis={basis} basisLabel={basisLabel} />
            <SlotCalls calls={calls} onPromote={promoteCall} onMiss={missCall} onOpenLog={setLogCaller} />
            <SoftBanned list={banned} onChange={setBanned} />
            <CallerStats bonuses={bonuses} ledger={ledger} onOpenLog={setLogCaller} />
          </div>
        </div>
        <HuntHistory hunts={HR.PAST_HUNTS} onOpenLog={setLogCaller} />
        </React.Fragment>
        )}
      </main>

      {logCaller && <CallerLog name={logCaller} bonuses={bonuses} ledger={ledger} calls={calls} onClose={() => setLogCaller(null)} />}

      <TweaksPanel>
        <TweakSection label="Bonus log" />
        <TweakRadio label="Layout" value={t.logStyle} options={["table", "cards"]}
          onChange={(v) => setTweak("logStyle", v)} />
        <TweakSection label="Stats" />
        <TweakRadio label="Detail" value={t.statMode} options={["full", "compact"]}
          onChange={(v) => setTweak("statMode", v)} />
        <TweakRadio label="Density" value={t.density} options={["cozy", "compact"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Squad split basis" />
        <TweakRadio label="Pay out on" value={t.splitBasis} options={["winnings", "profit"]}
          onChange={(v) => setTweak("splitBasis", v)} />
        <TweakSection label="Theme" />
        <TweakRadio label="Brand" value={t.brand} options={["studio", "gooferg"]}
          onChange={(v) => setTweak("brand", v)} />
        <TweakColor label="Accent" value={t.accent}
          options={[
            ["#8b7bf0", "#2a2350", "#a99bff"],
            ["#3fb6c8", "#11363d", "#5fd4e6"],
            ["#e0689a", "#3a1f2c", "#ff8fb8"],
            ["#5db87a", "#16331f", "#7ad696"],
          ]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Heading font" value={t.font} options={["grotesk", "mono"]}
          onChange={(v) => setTweak("font", v)} />
        <TweakSection label="Assistant" />
        <TweakToggle label="Show tips" value={t.showTip} onChange={(v) => setTweak("showTip", v)} />
      </TweaksPanel>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "logStyle": "table",
  "statMode": "full",
  "density": "cozy",
  "splitBasis": "winnings",
  "brand": "gooferg",
  "accent": ["#8b7bf0", "#2a2350", "#a99bff"],
  "font": "grotesk",
  "showTip": true
}/*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
