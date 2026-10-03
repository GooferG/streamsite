import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Undo2 } from 'lucide-react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useClock } from '../../hooks/useClock';
import {
  FILTERS,
  FILTER_LABELS,
  QUEUE_CAP,
  ageLabel,
  filterCounts,
  filterQueue,
  kindGroup,
  kindLabel,
  newestAt,
  queueOrder,
  showsCost,
  whoRedeemed,
} from './redemptions';
import { useRedemptionAction } from './useRedemptionAction';

const ARM_MS = 4000;

// Refund only goes through on a second press inside 4s. The label counts down
// so the operator can see the window closing.
function RefundButton({ disabled, onConfirm }) {
  const [armedAt, setArmedAt] = useState(null);
  const armed = armedAt != null;
  const now = useClock({ intervalMs: 250, active: armed });
  useEffect(() => {
    if (armedAt == null) return undefined;
    const t = setTimeout(() => setArmedAt(null), ARM_MS);
    return () => clearTimeout(t);
  }, [armedAt]);
  const left = armed
    ? Math.min(ARM_MS / 1000, Math.max(1, Math.ceil((armedAt + ARM_MS - now) / 1000)))
    : 0;
  return (
    <button
      type="button"
      className="cr-btn"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmedAt(null);
          onConfirm();
        } else {
          setArmedAt(Date.now());
        }
      }}
    >
      <Undo2 size={12} aria-hidden="true" />
      {armed ? `Confirm refund · ${left}s` : 'Refund'}
    </button>
  );
}

function Row({ r, now, open, onToggle, note, onNote, busy, error, onAct }) {
  const noteId = `cr-red-note-${r.id}`;
  const name = r.itemName || 'Untitled';
  const meta = [whoRedeemed(r), ageLabel(r.createdAt, now), showsCost(r) ? `${r.cost}t` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="cr-red-row">
      <button
        type="button"
        className="cr-red-summary"
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        onClick={onToggle}
      >
        {r.profileImageUrl ? (
          <img src={r.profileImageUrl} alt="" className="w-7 h-7 rounded-full border border-white/15" />
        ) : (
          <span className="w-7 h-7 border border-white/15" aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="cr-red-item text-sm font-bold text-white-body truncate">{name}</span>
            <span className={`cr-kind ${kindGroup(r.kind) === 'payouts' ? 'is-payout' : ''}`}>{kindLabel(r.kind)}</span>
          </span>
          <span className="cr-lbl block mt-1">{meta}</span>
          {r.note && <span className="block mt-1 text-xs italic text-white/55">{r.note}</span>}
        </span>
      </button>
      {open && (
        <input
          id={noteId}
          type="text"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Optional note…"
          aria-label={`Note for ${name}`}
          className="cr-red-note"
        />
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" className="cr-btn is-go" disabled={!!busy} onClick={() => onAct('fulfill')}>
          <Check size={12} aria-hidden="true" />
          {busy === 'fulfill' ? 'Fulfilling…' : 'Fulfill'}
        </button>
        <RefundButton disabled={!!busy} onConfirm={() => onAct('cancel')} />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

// Pending redemptions, oldest first, with the same actions as
// /admin/redemptions. Being on screen marks them seen.
export default function RedeemTab() {
  const cr = useControlRoom();
  const list = cr.redemptions || [];
  const filter = cr.prefs.redeemFilter;
  const counts = filterCounts(list);
  const rows = queueOrder(filterQueue(list, filter));
  const now = useClock({ intervalMs: 30_000, active: list.length > 0 });
  const [openId, setOpenId] = useState(null);
  const [notes, setNotes] = useState({});
  const { busy, errors, run } = useRedemptionAction();

  const newest = newestAt(list);
  const { markRedeemSeen, ducked } = cr;
  useEffect(() => {
    if (!ducked && newest != null) markRedeemSeen(newest);
  }, [newest, ducked, markRedeemSeen]);

  const act = async (id, action) => {
    const ok = await run(id, action, notes[id]);
    if (!ok) return;
    setNotes((n) => {
      const next = { ...n };
      delete next[id];
      return next;
    });
    setOpenId((o) => (o === id ? null : o));
  };

  return (
    <div>
      <div role="group" aria-label="Filter redemptions" className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className={`cr-chip ${filter === f ? 'is-on' : ''}`}
            onClick={() => cr.setRedeemFilter(f)}
          >
            {FILTER_LABELS[f]} {counts[f]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="mt-3">
          <p className="cr-lbl">redemptions</p>
          <p className="cr-timecode is-quiet">IDLE</p>
          <p className="text-sm text-white/55 mt-2">Nothing waiting.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/55 mt-3">Nothing in {FILTER_LABELS[filter].toLowerCase()}.</p>
      ) : (
        <ul aria-label="Pending redemptions" className="mt-3 space-y-2">
          {rows.map((r) => (
            <Row
              key={r.id}
              r={r}
              now={now}
              open={openId === r.id}
              onToggle={() => setOpenId((o) => (o === r.id ? null : r.id))}
              note={notes[r.id] || ''}
              onNote={(v) => setNotes((n) => ({ ...n, [r.id]: v }))}
              busy={busy[r.id]}
              error={errors[r.id]}
              onAct={(action) => act(r.id, action)}
            />
          ))}
        </ul>
      )}
      {cr.redeem?.capped && <p className="cr-lbl mt-3">Showing newest {QUEUE_CAP} · rest in admin</p>}
      <div className="mt-4 flex justify-end">
        <Link to="/admin/redemptions" className="cr-lbl hover:text-white-body">
          Open in admin ↗
        </Link>
      </div>
    </div>
  );
}
