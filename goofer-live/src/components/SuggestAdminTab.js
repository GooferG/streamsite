import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
  updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { Star, X, RefreshCcw, MessageSquarePlus } from 'lucide-react';
import { db } from '../config/firebase';

export default function SuggestAdminTab() {
  const [suggestions, setSuggestions] = useState([]);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const toggleHighlight = async (suggestion) => {
    const ref = doc(db, 'suggestions', suggestion.id);
    await updateDoc(ref, {
      status: suggestion.status === 'highlighted' ? 'pending' : 'highlighted',
    });
  };

  const removeSuggestion = async (id) => {
    await deleteDoc(doc(db, 'suggestions', id));
  };

  const clearAll = async () => {
    const batch = writeBatch(db);
    suggestions.forEach((s) => batch.delete(doc(db, 'suggestions', s.id)));
    await batch.commit();
    setClearConfirm(false);
  };

  return (
    <div className="p-8 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold mb-2">
            <MessageSquarePlus size={18} />
            Game Suggestions
          </div>
          <h2 className="text-3xl font-black tracking-tighter">Viewer Suggestions</h2>
          <p className="text-white/60">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} — highlight a game to mark it as picked on the overlay.
          </p>
        </div>
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            disabled={suggestions.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-red-400/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={14} />
            CLEAR ALL
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
            >
              Confirm
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-10 text-white/40">
          No suggestions yet. Share <strong className="text-white/60">goofer.tv/suggest</strong> with chat!
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-lg border flex items-center gap-4 transition-all ${
                s.status === 'highlighted'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {s.profileImageUrl && (
                <img
                  src={s.profileImageUrl}
                  alt=""
                  className="w-9 h-9 rounded-full border border-white/20 flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white">{s.gameName}</p>
                  {s.status === 'highlighted' && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                      PICKED
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/50">
                  {s.twitchName}
                  {s.rainbetName
                    ? <span className="text-emerald-400/70"> · {s.rainbetName}</span>
                    : null}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleHighlight(s)}
                  className={`p-2 rounded-lg border transition-all ${
                    s.status === 'highlighted'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-emerald-300 hover:border-emerald-400/60'
                  }`}
                >
                  <Star size={16} />
                </button>
                <button
                  onClick={() => removeSuggestion(s.id)}
                  className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
