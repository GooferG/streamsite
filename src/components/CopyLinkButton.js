import { useRef, useState, useEffect } from 'react';
import { Check, Link as LinkIcon } from 'lucide-react';

// Calm dark copy button: readable light label, accent only on the small icon.
// `label` names what is copied ("Copy watch link") to prevent mis-paste.
export default function CopyLinkButton({
  url,
  label = 'Copy',
  className = '',
  iconClassName = 'text-emerald-signal',
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function copy() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={url}
      className={`inline-flex items-center gap-1.5 px-2.5 py-2 border border-white/20 bg-zinc-broadcast/60 text-white-body hover:border-white/40 transition-colors text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono whitespace-nowrap ${className}`}
    >
      {copied ? (
        <Check size={12} aria-hidden="true" className={iconClassName} />
      ) : (
        <LinkIcon size={12} aria-hidden="true" className={iconClassName} />
      )}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
