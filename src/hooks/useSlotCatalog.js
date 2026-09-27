import { useEffect, useState } from 'react';
import { normalizeCatalog } from '../utils/slotCatalog';

// Loads the slot catalogue (/api/slots) once per page session and shares it
// between Slot Picker and every SlotAutocomplete. A failed load clears the
// shared promise so the next mount retries.

let catalogPromise = null;
let catalogCache = null; // normalized Slot[] once loaded

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/api/slots')
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || !Array.isArray(body.slots)) {
          throw new Error((body && body.error) || `HTTP ${res.status}`);
        }
        catalogCache = normalizeCatalog(body.slots);
        return catalogCache;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

export function __resetSlotCatalogForTests() {
  catalogPromise = null;
  catalogCache = null;
}

export default function useSlotCatalog() {
  const [state, setState] = useState(() =>
    catalogCache
      ? { slots: catalogCache, loading: false, error: null }
      : { slots: [], loading: true, error: null }
  );

  useEffect(() => {
    if (catalogCache) return undefined;
    let cancelled = false;
    loadCatalog().then(
      (slots) => {
        if (!cancelled) setState({ slots, loading: false, error: null });
      },
      (err) => {
        if (!cancelled) setState({ slots: [], loading: false, error: err.message || 'Failed' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
