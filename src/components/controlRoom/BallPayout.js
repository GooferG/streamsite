import { useEffect, useMemo, useRef, useState } from 'react';
import HoldButton from '../onAir/HoldButton';
import useBallHunt from '../../hooks/useBallHunt';
import { normName, resultRows } from '../../utils/ballResults';
import { formatMulti, pad2, prizeText, who } from '../../utils/ball';
import { inputCls } from '../admin/predictions/shared';
import { useBallRun } from './useBallRun';

const EMPTY = { multiplier: '', win: '', bonusIndex: null };
const STALE_PREVIEW = ['WINNER_CHANGED', 'HUNT_CHANGED'];

const blank = (v) => String(v ?? '').trim() === '';
const validNumber = (v) => {
  const t = String(v ?? '').trim();
  return t === '' || (Number.isFinite(Number(t)) && Number(t) >= 0);
};
const isInvalid = (e) => !validNumber(e.multiplier) || !validNumber(e.win);

// Only rows staff actually touched go to the server, trimmed.
function overridesFrom(edits) {
  const out = {};
  for (const [drawNo, e] of Object.entries(edits)) {
    if (!blank(e.multiplier) || e.bonusIndex != null) {
      out[drawNo] = { ...e, multiplier: String(e.multiplier ?? '').trim(), win: String(e.win ?? '').trim() };
    }
  }
  return out;
}

function huntMatches(slotName, bonuses) {
  const key = normName(slotName);
  return key ? bonuses.filter((b) => b && normName(b.slot) === key) : [];
}

function optionLabel(b, i) {
  const bits = [`Hunt row ${i + 1}`, formatMulti(b.multiplier)];
  if (b.win != null && b.win !== '') bits.push(`win ${b.win}`);
  return bits.join(' · ');
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
  const key = JSON.stringify(overrides);
  const latestKey = useRef(key);
  latestKey.current = key;
  const bonuses = (hunt && hunt.bonuses) || [];
  const rows = resultRows(round, bonuses, overrides);
  const anyInvalid = Object.values(edits).some(isInvalid);

  useEffect(() => {
    setPreview(null);
  }, [round.huntId]);

  const edit = (drawNo, patch) => {
    setPreview(null);
    setEdits((all) => ({ ...all, [drawNo]: { ...EMPTY, ...all[drawNo], ...patch } }));
  };

  const doPreview = async () => {
    const sent = key;
    const { ok, data } = await run({ action: 'preview_settle', id: round.id, overrides });
    // Staff edited while the request was out: that answer is for other numbers.
    if (ok && latestKey.current === sent) setPreview(data);
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
            const asInput = r.source !== 'hunt' || !blank(e.multiplier);
            const badMulti = !validNumber(e.multiplier);
            const badWin = !validNumber(e.win);
            const matches = huntMatches(r.slotName, bonuses);
            const unmatched = !!round.huntId && !!hunt && r.matchCount === 0;
            const unopened = r.matchCount > 0 && r.source == null && blank(e.multiplier);
            return (
              <tr key={r.drawNo} className={`border-t border-white/10${unmatched ? ' bg-orange-admin/10' : ''}`}>
                <td className="py-1 pr-2 font-mono text-white/45">{pad2(r.drawNo)}</td>
                <td className="py-1 pr-2">
                  <span className="block truncate text-white-body">{r.slotName}</span>
                  <span className="text-xs text-white/45">@{who(r)}</span>
                  {unmatched && <span className="block text-xs font-mono text-orange-admin">No hunt row: type it</span>}
                  {unopened && <span className="block text-xs font-mono text-white/45">Not opened yet</span>}
                  {r.matchCount > 1 && (
                    <select
                      className={`${inputCls} mt-1`}
                      aria-label={`Hunt row for ball ${r.drawNo}`}
                      value={e.bonusIndex ?? 0}
                      onChange={(ev) => edit(r.drawNo, { bonusIndex: Number(ev.target.value) })}
                    >
                      {matches.map((b, i) => (
                        <option key={i} value={i}>{optionLabel(b, i)}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="w-28 py-1 text-right">
                  {asInput ? (
                    <div className="space-y-1">
                      <input
                        className={`${inputCls}${badMulti ? ' border-red-destructive' : ''}`}
                        inputMode="decimal"
                        placeholder="multi"
                        aria-label={`Multiplier for ball ${r.drawNo}`}
                        aria-invalid={badMulti ? 'true' : undefined}
                        value={e.multiplier}
                        onChange={(ev) => edit(r.drawNo, { multiplier: ev.target.value })}
                      />
                      <input
                        className={`${inputCls}${badWin ? ' border-red-destructive' : ''}`}
                        inputMode="decimal"
                        placeholder="win"
                        aria-label={`Win for ball ${r.drawNo}`}
                        aria-invalid={badWin ? 'true' : undefined}
                        value={e.win}
                        onChange={(ev) => edit(r.drawNo, { win: ev.target.value })}
                      />
                      {(badMulti || badWin) && <span className="block text-xs font-mono text-red-destructive">Not a number</span>}
                    </div>
                  ) : (
                    <>
                      <span className="block font-mono text-orange-admin">{formatMulti(r.multiplier)}</span>
                      {(r.win != null || r.bet != null) && (
                        <span className="block text-xs font-mono text-white/45">
                          {[r.win != null && `win ${r.win}`, r.bet != null && `bet ${r.bet}`].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      <button
                        type="button"
                        className="cr-btn mt-1 px-2"
                        aria-label={`Edit ball ${r.drawNo}`}
                        onClick={() => edit(r.drawNo, { multiplier: String(r.multiplier), win: r.win != null ? String(r.win) : '' })}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="cr-btn mt-3 w-full" disabled={!!busy || anyInvalid} onClick={doPreview}>
        Preview
      </button>
      {preview && preview.huntError && (
        <p className="mt-2 text-xs font-mono text-orange-admin">{`Hunt unavailable (${preview.huntError}). Type every multiplier to pay out.`}</p>
      )}
      {preview && preview.winner && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-white-body">
            {`@${who(preview.winner)} · ${preview.winner.slotName} · ${formatMulti(preview.winner.multiplier)} wins ${prizeText(round.prize)}`}
          </p>
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
