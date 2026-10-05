export default function CrashPill({ onReopen }) {
  return (
    <button
      type="button"
      data-control-room=""
      onClick={onReopen}
      className="fixed right-4 bottom-[104px] z-[65] px-3 py-2 rounded-full border border-red-destructive/60 bg-zinc-card text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-red-destructive"
    >
      Control room crashed. Reopen
    </button>
  );
}
