import { useState } from 'react';
import { Link as LinkIcon, Trash2 } from 'lucide-react';
import CopyLinkButton from './CopyLinkButton';

const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3.5 py-2.5 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

// Owner controls for the password-gated public suggestion link.
// Extracted from SuggestionsPanel so the share bar and the panel can share it.
export default function HuntLinkControls({
  linkId,
  linkOpen,
  linkBusy,
  linkError,
  linkRequiresPassword,
  onCreateLink,
  onToggleLink,
  onDeleteLink,
}) {
  const [opening, setOpening] = useState(false);
  const [pw, setPw] = useState('');
  const [requirePw, setRequirePw] = useState(false); // OFF by default
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const url = linkId ? `${window.location.origin}/hunt-suggest/${linkId}` : null;

  if (!linkId) {
    return (
      <div className="border border-white/8 bg-zinc-broadcast/40 p-3 space-y-2">
        {!opening ? (
          <button
            type="button"
            onClick={() => setOpening(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-purple-gamba/40 text-purple-bright hover:bg-purple-gamba/15 transition-colors duration-150"
          >
            <LinkIcon size={13} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              Collect via link
            </span>
          </button>
        ) : (
          <>
            <p className="text-[11px] text-white/55 leading-snug">
              Share the link and anyone with it can submit picks straight into
              this list. Add a password if you want to gate it.
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requirePw}
                onChange={(e) => setRequirePw(e.target.checked)}
                className="accent-purple-gamba w-3.5 h-3.5"
              />
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono text-white/70">
                Require a password
              </span>
            </label>
            {requirePw && (
              <input
                type="text"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Set a password (min 8 chars)"
                className={`w-full ${inputCls}`}
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onCreateLink(requirePw ? pw : '')}
                disabled={linkBusy || (requirePw && pw.trim().length < 8)}
                className="flex-1 px-3 py-2.5 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors duration-150 disabled:opacity-40"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {linkBusy ? 'Creating…' : 'Create link'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpening(false);
                  setPw('');
                  setRequirePw(false);
                }}
                className="px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Cancel
                </span>
              </button>
            </div>
            {linkError && <p className="text-red-destructive text-[11px]">{linkError}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border border-purple-gamba/30 bg-purple-gamba/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              linkOpen ? 'bg-emerald-signal animate-pulse' : 'bg-white/30'
            }`}
          />
          <span className={linkOpen ? 'text-emerald-signal' : 'text-white/50'}>
            {linkOpen ? 'Collecting' : 'Closed'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onToggleLink(!linkOpen)}
          disabled={linkBusy}
          className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 transition-colors disabled:opacity-40"
        >
          {linkOpen ? 'Close' : 'Re-open'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className={`flex-1 min-w-0 ${inputCls} text-[11px]`}
        />
        <CopyLinkButton url={url} label="Copy collect link" iconClassName="text-purple-bright" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-white/40 font-mono">
          {linkRequiresPassword
            ? '🔒 Password protected · recreate to change'
            : '🔓 Open · anyone with the link can submit'}
        </p>
        {confirmingDelete ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onDeleteLink();
                setConfirmingDelete(false);
              }}
              disabled={linkBusy}
              className="px-2 py-1 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive text-[9px] font-bold tracking-eyebrow-md uppercase font-mono disabled:opacity-40"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-2 py-1 border border-white/10 text-white/50 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold tracking-eyebrow-md uppercase font-mono text-white/40 hover:text-red-destructive transition-colors"
          >
            <Trash2 size={11} aria-hidden="true" />
            Kill link
          </button>
        )}
      </div>
      {linkError && <p className="text-red-destructive text-[11px]">{linkError}</p>}
    </div>
  );
}
