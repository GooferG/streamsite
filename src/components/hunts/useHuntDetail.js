import { useState } from 'react';

// Fetch-on-demand bonus detail for one hunt (/api/communityhunts?view=hunt).
// Shared by the archive rows and the latest-hunt card; loads once, on first open.
export default function useHuntDetail(huntId) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || detail || !huntId) return;
    setLoadError(null);
    try {
      const res = await fetch(`/api/communityhunts?view=hunt&id=${encodeURIComponent(huntId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.hunt) throw new Error('Failed');
      setDetail(data.hunt);
    } catch {
      setLoadError('Could not load this hunt’s bonuses.');
    }
  };

  return { open, toggle, detail, loadError };
}
