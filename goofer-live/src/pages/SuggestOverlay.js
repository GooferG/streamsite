import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function SuggestOverlay() {
  const [suggestions, setSuggestions] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSuggestions(snap.docs.map((d) => d.data()));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [suggestions.length]);

  return (
    <div className="w-full h-screen bg-black/80 text-white font-sans overflow-hidden flex flex-col p-4 gap-3">
      <div className="flex items-center gap-2 pb-2 border-b border-white/10">
        <span className="text-emerald-400 font-black text-lg tracking-widest uppercase">
          Game Suggestions
        </span>
        <span className="ml-auto text-white/40 text-sm">{suggestions.length}</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
        {suggestions.length === 0 && (
          <p className="text-white/30 text-sm text-center pt-4">No suggestions yet.</p>
        )}
        {suggestions.map((s) => (
          <div
            key={s.twitchId}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              s.status === 'highlighted'
                ? 'bg-emerald-500/20 border-emerald-500/60'
                : 'bg-white/5 border-white/10'
            }`}
          >
            {s.profileImageUrl && (
              <img
                src={s.profileImageUrl}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0 border border-white/20"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-black text-white truncate">{s.gameName}</p>
              <p className="text-xs text-white/50 truncate">
                {s.twitchName}
                {s.rainbetName ? ` · ${s.rainbetName}` : ''}
              </p>
            </div>
            {s.status === 'highlighted' && (
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 rounded px-2 py-0.5 flex-shrink-0">
                PICKED
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
