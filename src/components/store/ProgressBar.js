// Viewer-purple progress toward an item ("you" is the viewer's colour).
// Decorative: the shortfall is always stated in text next to it.
export default function ProgressBar({ pct, className = '' }) {
  const width = `${Math.round(Math.max(0, Math.min(1, pct || 0)) * 100)}%`;
  return (
    <span aria-hidden="true" className={`block h-1.5 overflow-hidden rounded-full bg-black/45 shadow-onair-well ${className}`}>
      <span className="block h-full rounded-full bg-gradient-to-r from-onair-viewer-deep to-onair-viewer-light" style={{ width }} />
    </span>
  );
}
