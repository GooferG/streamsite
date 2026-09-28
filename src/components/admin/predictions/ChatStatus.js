import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useClock } from '../../../hooks/useClock';
import { roundsAction, announceFailure } from './shared';

const EVENTS = [
  { key: 'opened', label: 'Opened' },
  { key: 'locked', label: 'Locked' },
  { key: 'results', label: 'Results' },
];

const shellCls =
  'flex items-center gap-x-4 gap-y-2 px-3 py-2 border border-white/10 bg-zinc-broadcast/40 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono';

// Whether the round has reached the moment a line posts for.
function reached(round, key) {
  if (key === 'opened') return true;
  if (key === 'locked') return round.status === 'locked' || round.status === 'settled';
  return round.status === 'settled';
}

// Chat post status for a round's three lines. `results` comes from
// useResultsAnnounce for the current round; past rounds pass null and retry
// results here like the other two.
export default function ChatStatus({ round, results }) {
  const [local, setLocal] = useState({});
  const pending = !!results?.dueAt && !round.announced?.results;
  const now = useClock({ intervalMs: 500, active: pending });

  const retry = async (key) => {
    setLocal((s) => ({ ...s, [key]: { posting: true, error: null } }));
    const { ok, data } = await roundsAction({ action: 'announce', id: round.id, event: key });
    setLocal((s) => ({ ...s, [key]: { posting: false, error: announceFailure(ok, data) } }));
  };

  if (!round.announce) {
    return (
      <div className={shellCls}>
        <MessageSquare size={11} className="text-white/40 flex-shrink-0" aria-hidden="true" />
        <span className="text-white/35">Chat announce off</span>
      </div>
    );
  }

  return (
    <div className={`${shellCls} flex-wrap`}>
      <MessageSquare size={11} className="text-white/40 flex-shrink-0" aria-hidden="true" />
      {EVENTS.map(({ key, label }) => {
        const useHook = key === 'results' && results;
        const own = useHook ? results : local[key] || {};
        const onRetry = useHook ? results.retry : () => retry(key);
        let body;
        let canRetry = false;
        if (!reached(round, key)) {
          body = <span className="text-white/30">not yet</span>;
        } else if (round.announced?.[key]) {
          body = <span className="text-emerald-signal">posted</span>;
        } else if (own.posting) {
          body = <span className="text-white/55">posting…</span>;
        } else if (own.error) {
          body = (
            <span className="text-red-destructive truncate max-w-[28ch]" title={own.error}>
              failed: {own.error}
            </span>
          );
          canRetry = true;
        } else if (key === 'results' && pending && results.dueAt > now) {
          body = <span className="text-white/55">in {Math.ceil((results.dueAt - now) / 1000)}s</span>;
        } else {
          body = <span className="text-white/45">not posted</span>;
          canRetry = true;
        }
        return (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="text-white/45">{label}</span>
            {body}
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label={`Retry ${label.toLowerCase()}`}
                className="px-1.5 py-0.5 border border-white/20 text-white/65 hover:text-white-body hover:border-white/40"
              >
                Retry
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
