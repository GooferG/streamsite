import { useMemo, useState } from 'react';
import HoldButton from '../onAir/HoldButton';
import useBallHunt from '../../hooks/useBallHunt';
import { resultRows } from '../../utils/ballResults';
import { formatMulti, pad2, prizeText, who } from '../../utils/ball';
import { inputCls } from '../admin/predictions/shared';
import { useBallRun } from './useBallRun';

const EMPTY = { multiplier: '', win: '', bonusIndex: null };
const STALE_PREVIEW = ['WINNER_CHANGED', 'HUNT_CHANGED'];

// Only rows staff actually touched go to the server.
function overridesFrom(edits) {
  const out = {};
  for (const [drawNo, e] of Object.entries(edits)) {
    if (e.multiplier !== '' || e.bonusIndex != null) out[drawNo] = e;
  }
  return out;
}

// The payout table for a closed round (spec: Results and payout): the hunt's
// numbers per drawn ball, typed numbers where it has none, then Preview and
// a hold-to-confirm Pay out. The server re-reads the hunt and re-ranks.
export default function BallPayout({ round }) {
  const { hunt, stale } = useBallHunt(round.huntId, { enabled: !!round.huntId });
  const [edits, setEdits] = useState({});
  const [preview, setPreview] = useState(null);
  const { busy, error, run } = useBallRun();
  const overrides = useMemo(() => overridesFrom(edits), [edits]);
  const rows = resultRows(round, (hunt && hunt.bonuses) || [], overrides);
  const edit = (drawNo, patch) => {
    setPreview(null);
    setEdits((all) => ({ ...all, [drawNo]: { ...EMPTY, ...all[drawNo], ...patch } }));
  };

  const doPreview = async () => {
    const { ok, data } = await run({ action: 'preview_settle', id: round.id, overrides });
    if (ok) setPreview(data);
  };

  // Pays the previewed winner; the server answers 409 if a re-rank differs.
  const doPay = async () => {
    const { ok, data } = await run({ action: 'settle', id: round.id, overrides, expectDrawNo: preview.winner.drawNo });
    if (!ok && data && STALE_PREVIEW.includes(data.error)) setPreview(null);
  };

  return (
    <div className="mt-3">
      <p className="cr-lbl">payout</p>
      {!round.huntId && <p className="mt-1 text-xs text-white/55">No hunt linked: type each multiplier.</p>}
      {stale && <p className="mt-1 text-xs font-mono text-orange-admin">Hunt numbers are stale (communityhunts.gg not answering).</p>}
      <table className="mt-2 w-full text-sm">
        <tbody>
          {rows.map((r) => {
            const e = edits[r.drawNo] || EMPTY;
            const fromHunt = r.source === 'hunt';
            return (
              <tr key={r.drawNo} className="border-t border-white/10">
                <td className="py-1 pr-2 font-mono text-white/45">{pad2(r.drawNo)}</td>
                <td className="py-1 pr-2">
                  <span className="block truncate text-white-body">{r.slotName}</span>
                  <span className="text-xs text-white/45">@{who(r)}</span>
                  {r.matchCount > 1 && (
                    <select
                      className={`${inputCls} mt-1`}
                      aria-label={`Hunt row for ball ${r.drawNo}`}
                      value={e.bonusIndex ?? 0}
                      onChange={(ev) => edit(r.drawNo, { bonusIndex: Number(ev.target.value) })}
                    >
                      {Array.from({ length: r.matchCount }, (_, i) => (
                        <option key={i} value={i}>{`Hunt row ${i + 1}`}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="w-24 py-1 text-right">
                  {fromHunt && e.multiplier === '' ? (
                    <span className="font-mono text-orange-admin">{formatMulti(r.multiplier)}</span>
                  ) : (
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="multi"
                      aria-label={`Multiplier for ball ${r.drawNo}`}
                      value={e.multiplier}
                      onChange={(ev) => edit(r.drawNo, { multiplier: ev.target.value })}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="cr-btn mt-3 w-full" disabled={!!busy} onClick={doPreview}>
        Preview
      </button>
      {preview && preview.winner && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-white-body">
            {`@${who(preview.winner)} · ${preview.winner.slotName} · ${formatMulti(preview.winner.multiplier)} wins ${prizeText(round.prize)}`}
          </p>
          {preview.huntError && <p className="text-xs font-mono text-orange-admin">{`Hunt unavailable (${preview.huntError}); typed numbers only.`}</p>}
          <HoldButton
            size="sm"
            variant="winner"
            idleLabel="Hold to pay out"
            armedLabel="Press again to pay out"
            disabled={!!busy}
            onConfirm={doPay}
          />
        </div>
      )}
      {preview && !preview.winner && <p className="mt-2 text-xs font-mono text-red-destructive">No drawn ball has a result yet.</p>}
      {error && <p className="mt-2 text-xs font-mono text-red-destructive">{error}</p>}
    </div>
  );
}
