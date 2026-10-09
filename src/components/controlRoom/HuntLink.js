import { useState } from 'react';
import useCommunityHunts from '../../hooks/useCommunityHunts';
import { useBallRun } from './useBallRun';

function huntLabel(h) {
  const when = h.startedAt ? new Date(h.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  return `${h.status === 'live' ? 'LIVE · ' : ''}${h.bonusCount ?? 0} bonuses${when ? ` · ${when}` : ''}`;
}

function Picker({ onPick, busy }) {
  const { live, recent, loading, error } = useCommunityHunts();
  const list = [live, ...(recent || []).filter((h) => !live || h.id !== live.id)].filter(Boolean).slice(0, 6);
  if (loading) return <p className="cr-lbl mt-2">Tuning…</p>;
  if (error && list.length === 0) return <p className="mt-2 text-xs font-mono text-red-destructive">communityhunts.gg is unavailable.</p>;
  return (
    <ul className="mt-2 space-y-1">
      {list.map((h) => (
        <li key={h.id}>
          <button type="button" className="cr-btn w-full justify-start" disabled={busy} onClick={() => onPick(h.id)}>
            {huntLabel(h)}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Which communityhunts hunt the live rack and the payout read (spec: Results
// and payout). Linkable any time while the round is open or closed.
export default function HuntLink({ round }) {
  const [picking, setPicking] = useState(false);
  const { busy, error, run } = useBallRun();
  const pick = async (huntId) => {
    const { ok } = await run({ action: 'link_hunt', id: round.id, huntId });
    if (ok) setPicking(false);
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="cr-lbl">{round.huntId ? `hunt · ${round.huntId}` : 'no hunt linked'}</p>
        <div className="flex gap-1">
          {round.huntId && (
            <button type="button" className="cr-btn flex-none px-2" disabled={!!busy} onClick={() => pick(null)}>
              Unlink
            </button>
          )}
          <button type="button" className="cr-btn flex-none px-2" onClick={() => setPicking((p) => !p)}>
            {round.huntId ? 'Change' : 'Link hunt'}
          </button>
        </div>
      </div>
      {picking && <Picker onPick={pick} busy={!!busy} />}
      {error && <p className="mt-1 text-xs font-mono text-red-destructive">{error}</p>}
    </div>
  );
}
