import { PRIZE_KINDS, placeLabel } from '../../../utils/predictionRewards';
import { inputCls } from './shared';

const miniLabel =
  'block text-[0.5625rem] font-bold tracking-eyebrow uppercase text-white/40 mb-1 font-mono';

// Controlled editor for a round's reward tiers. value / onChange use the
// RewardsForm shape from utils/predictionRewards (rows of strings plus
// thirdEnabled).
export default function RewardsEditor({ value, onChange }) {
  const setRow = (place, patch) =>
    onChange({
      ...value,
      rows: value.rows.map((row) => (row.place === place ? { ...row, ...patch } : row)),
    });
  const rows = value.rows.filter((row) => row.place !== 3 || value.thirdEnabled);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const name = `${placeLabel(row.place)} place`;
        return (
          <div key={row.place} className="grid grid-cols-[2.5rem_1fr_1fr_1fr] gap-2 items-end">
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono pb-2.5">
              {placeLabel(row.place)}
            </span>
            <div>
              <span className={miniLabel} aria-hidden="true">tickets</span>
              <input
                type="number"
                min="0"
                step="1"
                aria-label={`${name} tickets`}
                value={row.tickets}
                onChange={(e) => setRow(row.place, { tickets: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <span className={miniLabel} aria-hidden="true">prize</span>
              <select
                aria-label={`${name} prize`}
                value={row.prizeKind}
                onChange={(e) => setRow(row.place, { prizeKind: e.target.value })}
                className={inputCls}
              >
                {PRIZE_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
            {row.prizeKind !== 'none' ? (
              <div>
                <span className={miniLabel} aria-hidden="true">amount ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`${name} prize amount`}
                  value={row.prizeAmount}
                  onChange={(e) => setRow(row.place, { prizeAmount: e.target.value })}
                  placeholder="10"
                  className={inputCls}
                />
              </div>
            ) : (
              <div />
            )}
          </div>
        );
      })}
      <label className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          checked={value.thirdEnabled}
          onChange={(e) => onChange({ ...value, thirdEnabled: e.target.checked })}
        />
        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
          Enable 3rd place
        </span>
      </label>
    </div>
  );
}
