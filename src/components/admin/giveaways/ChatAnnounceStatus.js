import { MessageSquare } from 'lucide-react';
import { useClock } from '../../../hooks/useClock';

export default function ChatAnnounceStatus({ announce }) {
  const now = useClock({ intervalMs: 500, active: announce.enabled && !announce.posted });
  let body;
  if (!announce.enabled) {
    body = <span className="text-white/35">Chat announce off</span>;
  } else if (announce.posted) {
    body = <span className="text-emerald-signal">Posted in chat</span>;
  } else if (announce.error) {
    body = (
      <>
        <span className="text-red-destructive truncate">Chat post failed: {announce.error}</span>
        <button
          type="button"
          onClick={announce.retry}
          className="ml-auto px-2 py-0.5 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/10"
        >
          Retry
        </button>
      </>
    );
  } else if (announce.posting) {
    body = <span className="text-white/55">Posting in chat…</span>;
  } else {
    const left = announce.dueAt ? Math.max(0, Math.ceil((announce.dueAt - now) / 1000)) : 0;
    body = <span className="text-white/55">Posts in chat in {left}s (after the reveal)</span>;
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-white/10 bg-zinc-broadcast/40 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
      <MessageSquare size={11} className="text-white/40 flex-shrink-0" aria-hidden="true" />
      {body}
    </div>
  );
}
