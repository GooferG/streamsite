export default function StationID() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/8 px-4 sm:px-6 py-3 text-[0.625rem] font-bold tracking-eyebrow-lg text-white/45 font-mono">
      <span>STATION ID</span>
      <span className="text-white/20">·</span>
      <span>BROADCAST SYSTEM v1</span>
      <span className="text-white/20">·</span>
      <span>BUILT BY GOOFER</span>
      <span className="text-white/20">·</span>
      <button
        type="button"
        className="underline decoration-white/25 underline-offset-4 hover:text-white-body hover:decoration-white-body transition-colors motion-reduce:transition-none"
      >
        /tools
      </button>
    </div>
  );
}
