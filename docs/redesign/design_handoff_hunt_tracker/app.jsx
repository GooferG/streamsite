// app.jsx — Hunt Tracker main application.
const { useState, useMemo, useRef, useEffect } = React;
const H = window.HUNT;

const CHANNELS = [
  { id: "hub",   ch: null,  icon: "grid",   label: "HUB" },
  { id: "lead",  ch: "01",  icon: "radio",  label: "LEADERBOARD" },
  { id: "track", ch: "02",  icon: "target", label: "HUNT TRACKER", active: true },
  { id: "hunts", ch: "03",  icon: "stack",  label: "BONUS HUNTS" },
  { id: "battle",ch: "04",  icon: "swords", label: "BONUS BATTLE" },
  { id: "pick",  ch: "05",  icon: "dice",   label: "SLOT PICKER" },
];

function ChannelNav() {
  return (
    <nav className="channel-nav">
      {CHANNELS.map((c) => (
        <button key={c.id} className={"chan" + (c.active ? " active" : "")}>
          {c.ch && <span className="chan-num mono">CH {c.ch}</span>}
          <Icon name={c.icon} size={15} />
          <span className="chan-label mono">{c.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ---- Watch / Collect links --------------------------------------------------
function LinkPanel() {
  const [open, setOpen] = useState(true);
  return (
    <section className="panel link-panel">
      <div className="panel-head">
        <h3 className="mini-title"><Icon name="link" size={14} /> Share links</h3>
        <button className="collapse-btn" onClick={() => setOpen(!open)}>
          <Icon name="chevron" size={16} style={{ transform: open ? "none" : "rotate(-90deg)" }} />
        </button>
      </div>
      {open && (
        <div className="link-stack">
          <div className="link-block">
            <div className="link-title"><span className="dot live" /> <span className="mono">WATCH · LIVE</span></div>
            <div className="link-row">
              <code className="link-field">goofer.tv/live/31b7145b-989f-4269</code>
              <Btn kind="ghost" icon="copy" sm>Copy</Btn>
              <Btn kind="danger-ghost" icon="stop" sm>Stop</Btn>
            </div>
          </div>
          <div className="link-block">
            <div className="link-title"><span className="dot collect" /> <span className="mono">COLLECT · OPEN</span></div>
            <div className="link-row">
              <code className="link-field">goofer.tv/hunt-suggest/aA5Ze1hW-lcz7</code>
              <Btn kind="ghost" icon="copy" sm>Copy</Btn>
              <Btn kind="danger-ghost" icon="link" sm title="Kill link" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---- Bonus logging ----------------------------------------------------------
const TYPES = [
  { id: "regular", label: "Regular" },
  { id: "super", label: "Super" },
  { id: "5scatter", label: "5-Scatter" },
];

function QuickAdd({ onAdd }) {
  const [game, setGame] = useState("");
  const [bet, setBet] = useState("");
  const [caller, setCaller] = useState("");
  const [type, setType] = useState("regular");
  const gameRef = useRef(null);

  function submit() {
    if (!game.trim() || !bet) return;
    onAdd({ game: game.trim(), bet: parseFloat(bet), caller: caller.trim() || "—", type });
    setGame(""); setBet(""); setCaller(""); setType("regular");
    gameRef.current && gameRef.current.focus();
  }

  return (
    <div className="quick-add">
      <div className="qa-row">
        <input ref={gameRef} className="inp inp-game" placeholder="Slot name…" value={game}
          onChange={(e) => setGame(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <input className="inp inp-bet" placeholder="Bet $" value={bet} inputMode="decimal"
          onChange={(e) => setBet(e.target.value.replace(/[^0-9.]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
      <div className="qa-row">
        <input className="inp inp-caller" placeholder="Caller (optional)" value={caller}
          onChange={(e) => setCaller(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div className="type-seg">
          {TYPES.map((t) => (
            <button key={t.id} className={"seg" + (type === t.id ? " on" : "")} onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={submit}>
        <Icon name="plus" size={16} /> <span>Log bonus</span>
        <kbd className="kbd mono">↵</kbd>
      </button>
    </div>
  );
}

function PayoutCell({ bonus, onOpen }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  if (bonus.opened) {
    return (
      <button className="payout-done" onClick={() => { setVal(String(bonus.payout)); setEditing(true); }}>
        {fmt$(bonus.payout)}
      </button>
    );
  }
  if (editing) {
    return (
      <input ref={ref} className="inp inp-payout" placeholder="0.00" value={val} inputMode="decimal"
        onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={() => { onOpen(bonus.id, parseFloat(val || "0")); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { onOpen(bonus.id, parseFloat(val || "0")); setEditing(false); } }} />
    );
  }
  return <button className="btn btn-open btn-sm" onClick={() => setEditing(true)}><Icon name="play" size={11} fill /> Open</button>;
}

function BonusRow({ bonus, idx, onOpen, onDelete, style }) {
  const x = H.multi(bonus);
  if (style === "cards") {
    return (
      <div className={"bonus-card" + (bonus.opened ? " opened" : " pending")}>
        <div className="bc-top">
          <span className="bc-idx mono">{String(idx + 1).padStart(2, "0")}</span>
          <div className="bc-name">
            <div className="bc-game">{bonus.game}</div>
            <div className="bc-prov mono">{bonus.provider}</div>
          </div>
          <TypeBadge type={bonus.type} />
        </div>
        <div className="bc-bottom">
          <div className="bc-cell"><span className="bc-k mono">BET</span><span className="bc-v">{fmt$(bonus.bet)}</span></div>
          <div className="bc-cell"><span className="bc-k mono">PAYOUT</span><PayoutCell bonus={bonus} onOpen={onOpen} /></div>
          <div className="bc-cell"><span className="bc-k mono">MULTI</span><MultiTag x={x} /></div>
          <button className="row-del" onClick={() => onDelete(bonus.id)} title="Remove"><Icon name="x" size={14} /></button>
        </div>
      </div>
    );
  }
  return (
    <tr className={bonus.opened ? "opened" : "pending"}>
      <td className="c-idx mono">{String(idx + 1).padStart(2, "0")}</td>
      <td className="c-game">
        <div className="c-game-name">{bonus.game}</div>
        <div className="c-game-meta mono">{bonus.provider} · {bonus.caller}</div>
      </td>
      <td className="c-type"><TypeBadge type={bonus.type} /></td>
      <td className="c-bet num">{fmt$(bonus.bet)}</td>
      <td className="c-payout"><PayoutCell bonus={bonus} onOpen={onOpen} /></td>
      <td className="c-multi"><MultiTag x={x} /></td>
      <td className="c-act"><button className="row-del" onClick={() => onDelete(bonus.id)} title="Remove"><Icon name="x" size={14} /></button></td>
    </tr>
  );
}

function BonusLog({ bonuses, onAdd, onOpen, onDelete, stats, logStyle }) {
  const [q, setQ] = useState("");
  const filtered = bonuses.filter((b) => b.game.toLowerCase().includes(q.toLowerCase()));
  const opening = stats.remaining > 0 && stats.openedCount > 0;
  return (
    <section className="panel bonus-log">
      <div className="panel-head">
        <h2 className="panel-title"><span className="ttl-no mono">01</span> Bonus list
          <span className="count-chip mono">{stats.openedCount}/{stats.count} opened</span>
        </h2>
        {opening && <div className="opening-flag mono"><span className="dot opening" /> OPENING</div>}
      </div>

      <QuickAdd onAdd={onAdd} />

      {bonuses.length > 5 && (
        <div className="log-search">
          <Icon name="search" size={14} />
          <input className="inp inp-search" placeholder="Filter logged slots…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {bonuses.length === 0 ? (
        <div className="empty mono">Nothing logged yet. Call the first slot.</div>
      ) : logStyle === "cards" ? (
        <div className="bonus-cards">
          {filtered.map((b, i) => <BonusRow key={b.id} bonus={b} idx={bonuses.indexOf(b)} onOpen={onOpen} onDelete={onDelete} style="cards" />)}
        </div>
      ) : (
        <table className="bonus-table">
          <thead>
            <tr>
              <th className="c-idx mono">#</th>
              <th className="c-game mono">GAME</th>
              <th className="c-type mono">TYPE</th>
              <th className="c-bet mono">BET</th>
              <th className="c-payout mono">PAYOUT</th>
              <th className="c-multi mono">MULTI</th>
              <th className="c-act"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => <BonusRow key={b.id} bonus={b} idx={bonuses.indexOf(b)} onOpen={onOpen} onDelete={onDelete} style="table" />)}
          </tbody>
        </table>
      )}

      {stats.best && stats.best.b && (
        <div className="log-foot">
          <span className="mono">TOP MULTI</span>
          <strong>{stats.best.b.game}</strong>
          <MultiTag x={stats.best.x} />
          <span className="foot-sep">·</span>
          <span className="mono">{stats.remaining} left to open</span>
          {stats.remaining > 0 && <span className="need mono">need {fmt$(stats.needPerRemaining)} avg to break even</span>}
        </div>
      )}
    </section>
  );
}

// ---- Squad split ------------------------------------------------------------
function SquadSplit({ squad, onAdd, onEdit, onRemove, basis, basisLabel }) {
  const { pot, rows } = H.squadWithSplit(squad, basis);
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");
  function add() {
    if (!name.trim() || !amt) return;
    onAdd({ name: name.trim(), in: parseFloat(amt) });
    setName(""); setAmt("");
  }
  const positive = basis >= 0;
  return (
    <section className="panel squad">
      <div className="panel-head">
        <h2 className="panel-title"><Icon name="users" size={16} /> Squad split</h2>
        <span className={"basis-chip mono " + (positive ? "pos" : "neg")}>{basisLabel}: {fmt$(basis)}</span>
      </div>
      <div className="squad-add">
        <input className="inp" placeholder="Name" value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input className="inp inp-bet" placeholder="In for $" value={amt} inputMode="decimal"
          onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-primary btn-icon" onClick={add}><Icon name="plus" size={16} /></button>
      </div>
      <table className="squad-table">
        <thead>
          <tr><th className="mono">MEMBER</th><th className="mono num">IN FOR</th><th className="mono num">SHARE</th><th className="mono num">PAYOUT</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="sq-name">{r.name}</td>
              <td className="num">
                <input className="inp-inline num" value={r.in}
                  onChange={(e) => onEdit(r.id, parseFloat(e.target.value.replace(/[^0-9.]/g, "") || "0"))} />
              </td>
              <td className="num sq-pct">{(r.pct * 100).toFixed(1)}%</td>
              <td className={"num sq-pay " + (positive ? "pos" : "neg")}>{fmt$(r.payout)}</td>
              <td><button className="row-del" onClick={() => onRemove(r.id)}><Icon name="x" size={13} /></button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="mono">TOTAL</td>
            <td className="num">{fmt$(pot)}</td>
            <td className="num">100%</td>
            <td className={"num " + (positive ? "pos" : "neg")}>{fmt$(basis)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

// ---- Side widgets -----------------------------------------------------------
function SoftBanned({ list, onChange }) {
  return (
    <section className="panel mini">
      <div className="panel-head"><h3 className="mini-title"><Icon name="ban" size={14} /> Soft banned</h3><span className="mini-count mono">{list.length}</span></div>
      <div className="ban-chips">
        {list.map((s, i) => <span key={i} className="ban-chip mono">{s}<button onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="x" size={11} /></button></span>)}
        <input className="ban-input mono" placeholder="add slot to avoid…"
          onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { onChange([...list, e.target.value.trim()]); e.target.value = ""; } }} />
      </div>
    </section>
  );
}

function SlotCalls({ calls, onPromote, onMiss, onOpenLog }) {
  // Group calls by caller, preserving first-seen order.
  const groups = [];
  const idx = {};
  calls.forEach((c) => {
    if (idx[c.caller] == null) { idx[c.caller] = groups.length; groups.push({ caller: c.caller, items: [] }); }
    groups[idx[c.caller]].items.push(c);
  });
  return (
    <section className="panel mini">
      <div className="panel-head">
        <h3 className="mini-title"><Icon name="radio" size={14} /> Viewer calls</h3>
        <div className="mini-head-right">
          <span className="mini-count mono">{calls.length} pending</span>
          <LinkPopover label="Suggestions" icon="link" kind="ghost" sm align="right"
            title="COLLECT · OPEN" url="goofer.tv/hunt-suggest/aA5Ze1hW-lcz7"
            note="Open · anyone with the link can submit a slot"
            danger={{ icon: "ban", label: "Kill link" }} />
        </div>
      </div>
      <div className="calls-list">
        {groups.length === 0 && <div className="empty mono" style={{ padding: "28px 16px" }}>No pending calls.</div>}
        {groups.map((g) => (
          <div key={g.caller} className="call-group">
            <div className="cg-head">
              <button className="caller-link" onClick={() => onOpenLog(g.caller)} title="View caller track record">
                {g.caller}<Icon name="chevron" size={12} style={{ transform: "rotate(-90deg)", opacity: 0.5 }} />
              </button>
              {g.items.length > 1 && (
                <div className="cg-bulk">
                  <span className="cg-count mono">{g.items.length} calls</span>
                  <button className="cg-skip-all mono" onClick={() => g.items.forEach(onMiss)}>Skip all</button>
                </div>
              )}
            </div>
            {g.items.map((c) => (
              <div key={c.id} className="call-row">
                <div className="call-meta">
                  <span className="call-game">{c.game}</span>
                  <span className="call-by mono">{c.ts}</span>
                </div>
                <div className="call-actions">
                  <button className="btn btn-ghost btn-sm call-skip" onClick={() => onMiss(c)} title="Didn’t make the hunt — counts against this caller">
                    <Icon name="x" size={12} /> Skip
                  </button>
                  <button className="btn btn-open btn-sm" onClick={() => onPromote(c)} title="Add to the hunt"><Icon name="plus" size={12} /> Add</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Link popover (share / suggestions) ------------------------------------
function LinkPopover({ label, icon, url, kind = "ghost", sm, align, title, note, danger }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  function copy() {
    if (navigator.clipboard) navigator.clipboard.writeText("https://" + url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="popwrap" ref={ref}>
      <button className={`btn btn-${kind}${sm ? " btn-sm" : ""}${open ? " is-open" : ""}`} onClick={() => setOpen(!open)}>
        <Icon name={icon} size={sm ? 13 : 15} /><span>{label}</span>
      </button>
      {open && (
        <div className={"popover " + (align === "right" ? "to-right" : "")}>
          <div className="pop-title mono">{title}</div>
          <div className="link-row">
            <code className="link-field">{url}</code>
            <button className="btn btn-primary btn-sm" onClick={copy}>
              <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {note && <div className="pop-note mono">{note}</div>}
          {danger && (
            <button className="pop-danger" onClick={() => setOpen(false)}>
              <Icon name={danger.icon} size={13} /> {danger.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Caller stats (panel 05) -----------------------------------------------
function FormStrip({ form }) {
  if (!form.length) return <span className="form-empty mono">no plays</span>;
  return (
    <span className="form-strip" title="Recent calls (newest right)">
      {form.map((f, i) => <span key={i} className={"form-pip " + f} />)}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === "hot") return <span className="cstatus hot mono"><Icon name="flame" size={11} fill /> HOT</span>;
  if (status === "cold") return <span className="cstatus cold mono"><Icon name="bolt" size={11} /> COLD</span>;
  return <span className="cstatus steady mono">STEADY</span>;
}

function CallerStats({ bonuses, ledger, onOpenLog }) {
  const s = H.computeCallerStats(bonuses, ledger);
  return (
    <section className="panel mini caller-stats">
      <div className="panel-head">
        <h3 className="mini-title"><span className="ttl-no mono">05</span> Caller stats</h3>
        <span className="mini-count mono">{s.leaderboard.length} callers</span>
      </div>

      <div className="cs-highlights">
        <div className="cs-tile">
          <div className="cs-k mono"><Icon name="flame" size={11} fill /> ON A HEATER</div>
          {s.hotCaller
            ? <div className="cs-v"><strong>{s.hotCaller.name}</strong><span className="cs-sub mono">avg {fmtX(s.hotCaller.avgX)} · {s.hotCaller.hotStreak} hot in a row</span></div>
            : <div className="cs-v"><span className="cs-dash">—</span></div>}
        </div>
        <div className="cs-tile">
          <div className="cs-k mono pos"><Icon name="trophy" size={11} /> BEST CALL</div>
          <div className="cs-v">{s.bestCall ? <React.Fragment><strong>{s.bestCall.slot}</strong><span className="cs-sub mono">{fmtX(s.bestCall.x)} · {s.bestCall.caller}</span></React.Fragment> : <span className="cs-dash">—</span>}</div>
        </div>
        <div className="cs-tile">
          <div className="cs-k mono neg"><Icon name="ban" size={11} /> BRICK OF THE HUNT</div>
          <div className="cs-v">{s.worstCall ? <React.Fragment><strong>{s.worstCall.slot}</strong><span className="cs-sub mono">{fmtX(s.worstCall.x)} · {s.worstCall.caller}</span></React.Fragment> : <span className="cs-dash">—</span>}</div>
        </div>
      </div>

      <table className="caller-table">
        <thead>
          <tr>
            <th className="mono">CALLER</th>
            <th className="mono num">GOT IN</th>
            <th className="mono">FORM</th>
            <th className="mono num">AVG X</th>
          </tr>
        </thead>
        <tbody>
          {s.leaderboard.map((r, i) => (
            <tr key={r.name}>
              <td className="ct-name">
                <span className="ct-rank mono">{i + 1}</span>
                <button className="ct-who caller-link" onClick={() => onOpenLog(r.name)}>{r.name}</button>
                <StatusBadge status={r.status} />
              </td>
              <td className="num ct-got">
                <span className="ct-in">{r.gotIn}</span><span className="ct-of mono">/{r.calls}</span>
                {r.missed > 0 && <span className="ct-missed mono">{r.missed} missed</span>}
              </td>
              <td className="ct-form"><FormStrip form={r.form} /></td>
              <td className={"num ct-avg " + (r.avgX == null ? "" : r.avgX >= 20 ? "pos" : r.avgX < 1 ? "neg" : "")}>
                {r.avgX == null ? "—" : fmtX(r.avgX)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.coldCaller && (
        <div className="cs-foot mono">
          <Icon name="bolt" size={12} /> <strong>{s.coldCaller.name}</strong> on a cold streak · {Math.round(s.coldCaller.acceptRate * 100)}% of calls get in
        </div>
      )}
    </section>
  );
}

// ---- Caller call-log drawer ------------------------------------------------
function CallerLog({ name, bonuses, ledger, calls, onClose }) {
  const stats = H.computeCallerStats(bonuses, ledger);
  const row = stats.leaderboard.find((r) => r.name === name) || { calls: 0, gotIn: 0, missed: 0, avgX: null, best: null, form: [], status: "steady", acceptRate: 0 };
  const huntCalls = bonuses.filter((b) => (b.caller || "").trim() === name);
  const pending = calls.filter((c) => c.caller === name);
  const led = ledger.find((l) => l.name === name) || { gotInPrev: 0, missedPrev: 0, prevX: [] };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="ml-id">
            <GameAvatar name={name} size={40} />
            <div>
              <div className="ml-name">{name} <StatusBadge status={row.status} /></div>
              <div className="ml-sub mono">{row.gotIn} of {row.calls} calls made the hunt · {Math.round(row.acceptRate * 100)}% accept rate</div>
            </div>
          </div>
          <button className="asst-x" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="ml-stats">
          <div className="ml-stat"><div className="ml-k mono">AVG X</div><div className={"ml-v " + (row.avgX >= 20 ? "pos" : row.avgX != null && row.avgX < 1 ? "neg" : "")}>{row.avgX == null ? "—" : fmtX(row.avgX)}</div></div>
          <div className="ml-stat"><div className="ml-k mono">BEST X</div><div className="ml-v pos">{row.best == null ? "—" : fmtX(row.best)}</div></div>
          <div className="ml-stat"><div className="ml-k mono">SKIPPED</div><div className="ml-v">{row.missed}</div></div>
          <div className="ml-stat"><div className="ml-k mono">FORM</div><div className="ml-v"><FormStrip form={row.form} /></div></div>
        </div>

        <div className="ml-section">
          <div className="ml-section-h mono">THIS HUNT · {huntCalls.length} in</div>
          {huntCalls.length === 0 && <div className="ml-empty mono">No calls in the hunt yet.</div>}
          {huntCalls.map((b) => {
            const x = H.multi(b);
            return (
              <div key={b.id} className="ml-row">
                <span className="ml-slot">{b.game}</span>
                {b.opened ? <MultiTag x={x} /> : <span className="ml-pending mono">opening…</span>}
              </div>
            );
          })}
          {pending.length > 0 && pending.map((c) => (
            <div key={c.id} className="ml-row dim">
              <span className="ml-slot">{c.game}</span>
              <span className="ml-pending mono">pending call</span>
            </div>
          ))}
        </div>

        <div className="ml-section">
          <div className="ml-section-h mono">PRIOR HUNTS</div>
          <div className="ml-prior mono">{led.gotInPrev} slots in · {led.missedPrev} skipped · {led.prevX.length} played{led.prevX.length ? ` · avg ${fmtX(led.prevX.reduce((s, x) => s + x, 0) / led.prevX.length)}` : ""}</div>
        </div>
      </div>
    </div>
  );
}

function AssistantTip({ onClose }) {
  return (
    <div className="assistant">
      <span className="asst-tag mono"><Icon name="sparkle" size={13} /> ASSISTANT</span>
      <span className="asst-text">Wanted Dead or Payout just hit <strong>64x</strong> — your pace turned positive. 5 bonuses left to open.</span>
      <button className="asst-x" onClick={onClose}><Icon name="x" size={14} /></button>
    </div>
  );
}

// ---- Hunt history (completed hunts) ----------------------------------------
function HuntHistory({ hunts, onOpenLog }) {
  const [openId, setOpenId] = useState(hunts[0] ? hunts[0].id : null);
  return (
    <section className="panel hunt-history">
      <div className="panel-head">
        <h2 className="panel-title"><Icon name="stack" size={16} /> Hunt history</h2>
        <span className="count-chip mono">{hunts.length} completed</span>
      </div>
      <div className="hh-list">
        {hunts.map((h) => {
          const bonuses = h.bonuses.map((b, i) => ({ ...b, opened: true, id: h.id + "-" + i }));
          const stats = H.computeStats(bonuses, h.startCost);
          const cs = H.computeCallerStats(bonuses, []);
          const open = openId === h.id;
          const pos = h.profit >= 0;
          return (
            <div key={h.id} className={"hh-item" + (open ? " open" : "")}>
              <button className="hh-row" onClick={() => setOpenId(open ? null : h.id)}>
                <Icon name="chevron" size={15} style={{ transform: open ? "none" : "rotate(-90deg)", color: "var(--text-faint)" }} />
                <div className="hh-name">{h.name}</div>
                <div className="hh-date mono">{h.date}</div>
                <div className="hh-meta mono">{stats.count} bonuses · {fmtX(stats.totalX)}</div>
                <div className={"hh-pl " + (pos ? "pos" : "neg")}>{fmt$(h.profit)}</div>
              </button>
              {open && (
                <div className="hh-body">
                  <table className="bonus-table hh-bonus">
                    <thead><tr>
                      <th className="c-game mono">GAME</th><th className="mono">CALLER</th>
                      <th className="c-bet mono">BET</th><th className="c-payout mono">PAYOUT</th><th className="c-multi mono">MULTI</th>
                    </tr></thead>
                    <tbody>
                      {bonuses.map((b) => (
                        <tr key={b.id}>
                          <td className="c-game"><div className="c-game-name">{b.game}</div></td>
                          <td><button className="caller-link" onClick={() => onOpenLog(b.caller)}>{b.caller}</button></td>
                          <td className="c-bet num">{fmt$(b.bet)}</td>
                          <td className="num">{fmt$(b.payout)}</td>
                          <td><MultiTag x={b.bet ? b.payout / b.bet : null} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="hh-callers">
                    <div className="hh-c-block">
                      <div className="hh-c-h mono">TOP CALLERS</div>
                      {cs.leaderboard.slice(0, 4).map((r, i) => (
                        <div key={r.name} className="hh-c-row">
                          <span className="mono hh-c-rank">{i + 1}</span>
                          <button className="caller-link" onClick={() => onOpenLog(r.name)}>{r.name}</button>
                          <span className="hh-c-calls mono">{r.gotIn} in</span>
                          <span className={"hh-c-x " + (r.avgX >= 20 ? "pos" : "")}>{r.avgX == null ? "—" : fmtX(r.avgX)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="hh-c-highlights">
                      <div className="hh-hl"><span className="cs-k mono pos"><Icon name="trophy" size={11} /> BEST</span><span className="hh-hl-v">{cs.bestCall ? `${cs.bestCall.slot} · ${fmtX(cs.bestCall.x)}` : "—"}<span className="cs-sub mono">{cs.bestCall ? cs.bestCall.caller : ""}</span></span></div>
                      <div className="hh-hl"><span className="cs-k mono neg"><Icon name="ban" size={11} /> BRICK</span><span className="hh-hl-v">{cs.worstCall ? `${cs.worstCall.slot} · ${fmtX(cs.worstCall.x)}` : "—"}<span className="cs-sub mono">{cs.worstCall ? cs.worstCall.caller : ""}</span></span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Opening flow (focus mode) ---------------------------------------------
function GameAvatar({ name, size = 54 }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="game-avatar" style={{ width: size, height: size }}>
      <span className="mono">{initials}</span>
    </div>
  );
}

function OpeningFlow({ bonuses, idx, setIdx, onSave, onExit }) {
  const bonus = bonuses[idx];
  const next = bonuses[idx + 1];
  const [payout, setPayout] = useState("");
  const [note, setNote] = useState("");
  const payoutRef = useRef(null);

  useEffect(() => {
    if (!bonus) return;
    setPayout(bonus.opened && bonus.payout != null ? String(bonus.payout) : "");
    setNote(bonus.note || "");
    const id = setTimeout(() => payoutRef.current && payoutRef.current.focus(), 30);
    return () => clearTimeout(id);
  }, [idx, bonus]);

  function commit(advance) {
    if (!bonus) return;
    const val = parseFloat(payout || "0");
    onSave(bonus.id, val, note);
    if (advance && idx < bonuses.length - 1) setIdx(idx + 1);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "TEXTAREA") return;
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      else if (e.key === "ArrowRight") { commit(false); if (idx < bonuses.length - 1) setIdx(idx + 1); }
      else if (e.key === "ArrowLeft" && idx > 0) { commit(false); setIdx(idx - 1); }
      else if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!bonus) return null;
  const mult = bonus.bet && payout ? parseFloat(payout) / bonus.bet : null;
  const openedCount = bonuses.filter((b) => b.opened).length;
  const last = idx === bonuses.length - 1;

  return (
    <section className="opener">
      <div className="opener-bar">
        <button className="back-link" onClick={onExit}><Icon name="arrowL" size={14} /> Back to hunt</button>
        <div className="opener-progress mono">OPENING · {openedCount}/{bonuses.length} done</div>
        <div className="hotkeys mono">
          <kbd className="kbd">↵</kbd> next <span className="hk-sep">·</span>
          <kbd className="kbd">←</kbd><kbd className="kbd">→</kbd> nav <span className="hk-sep">·</span>
          <kbd className="kbd">esc</kbd> exit
        </div>
      </div>

      <div className="opener-card">
        <div className="oc-head">
          <GameAvatar name={bonus.game} />
          <div className="oc-id">
            <div className="oc-name">{bonus.game} <TypeBadge type={bonus.type} /></div>
            <div className="oc-meta mono">{bonus.provider} · called by {bonus.caller} · bonus {idx + 1} of {bonuses.length}</div>
          </div>
          <div className="oc-nav">
            <button className="nav-arrow" disabled={idx === 0} onClick={() => { commit(false); setIdx(idx - 1); }}>
              <Icon name="chevron" size={18} style={{ transform: "rotate(90deg)" }} />
            </button>
            <button className="nav-arrow" disabled={last} onClick={() => { commit(false); setIdx(idx + 1); }}>
              <Icon name="chevron" size={18} style={{ transform: "rotate(-90deg)" }} />
            </button>
          </div>
        </div>

        <div className="oc-fields">
          <div className="oc-field">
            <label className="oc-label mono">BET SIZE</label>
            <div className="oc-input static"><span className="oc-pre">$</span>{bonus.bet.toFixed(2)}</div>
          </div>
          <div className="oc-field">
            <label className="oc-label mono">PAYOUT</label>
            <div className="oc-input focus-input">
              <span className="oc-pre">$</span>
              <input ref={payoutRef} className="oc-raw num" placeholder="0.00" value={payout} inputMode="decimal"
                onChange={(e) => setPayout(e.target.value.replace(/[^0-9.]/g, ""))} />
            </div>
          </div>
          <div className="oc-field">
            <label className="oc-label mono">MULTIPLIER</label>
            <div className={"oc-mult " + (mult == null ? "empty" : mult >= 100 ? "huge" : mult >= 20 ? "big" : mult === 0 ? "zero" : "low")}>
              {mult == null ? "—" : fmtX(mult)}
            </div>
          </div>
        </div>

        <div className="oc-field">
          <label className="oc-label mono">NOTES</label>
          <textarea className="oc-notes" placeholder="Bonus story, retrigger, big tile…" value={note}
            onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="oc-foot">
          <button className="btn btn-ghost" onClick={onExit}>Cancel</button>
          {next && (
            <div className="next-game mono">
              NEXT <GameAvatar name={next.game} size={28} /> <strong>{next.game}</strong>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => last ? (commit(false), onExit()) : commit(true)}>
            {last ? "Finish opening" : "Save & continue"} <Icon name={last ? "check" : "arrowL"} size={15} style={last ? {} : { transform: "rotate(180deg)" }} />
          </button>
        </div>
      </div>
    </section>
  );
}
