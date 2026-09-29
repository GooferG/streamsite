import { TriangleAlert, X } from 'lucide-react';

// Operator warnings (timer failures, chat posts that didn't land). Used by the
// control room panel and pinned at the top of /admin/giveaways.
export default function WarningStrip({ warnings, onDismiss, className = '' }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div role="status" className={`space-y-1.5 ${className}`}>
      {warnings.map((w) => (
        <div
          key={w.id}
          className="flex items-start gap-2 px-3 py-2 border border-red-destructive/50 bg-red-destructive/10"
        >
          <TriangleAlert size={13} className="text-red-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="flex-1 text-xs text-white/85 leading-snug">{w.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(w.id)}
            aria-label="Dismiss warning"
            className="text-white/45 hover:text-white-body"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
