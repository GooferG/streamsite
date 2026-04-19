import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
  updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Star, X, RefreshCcw, MessageSquarePlus, GripVertical, Pencil, ExternalLink
} from 'lucide-react';
import { db } from '../config/firebase';

function SortableRow({ suggestion, onHighlight, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: suggestion.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-lg border flex items-center gap-3 transition-all ${
        suggestion.status === 'highlighted'
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-white/5 border-white/10'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-white/20 hover:text-white/60 cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical size={18} />
      </button>

      {suggestion.profileImageUrl && (
        <img
          src={suggestion.profileImageUrl}
          alt=""
          className="w-9 h-9 rounded-full border border-white/20 flex-shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-white">{suggestion.gameName}</p>
          {suggestion.status === 'highlighted' && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
              PICKED
            </span>
          )}
        </div>
        <p className="text-sm text-white/50">
          {suggestion.twitchName}
          {suggestion.rainbetName
            ? <span className="text-emerald-400/70"> · {suggestion.rainbetName}</span>
            : null}
        </p>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => onHighlight(suggestion)}
          className={`p-2 rounded-lg border transition-all ${
            suggestion.status === 'highlighted'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-emerald-300 hover:border-emerald-400/60'
          }`}
          title="Toggle highlight"
        >
          <Star size={16} />
        </button>
        <button
          onClick={() => onEdit(suggestion)}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-purple-400/60 transition-all"
          title="Edit suggestion"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(suggestion.id)}
          className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
          title="Delete suggestion"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function EditModal({ suggestion, onClose, onSave }) {
  const [gameName, setGameName] = useState(suggestion.gameName || '');
  const [rainbetName, setRainbetName] = useState(suggestion.rainbetName || '');
  const [twitchName, setTwitchName] = useState(suggestion.twitchName || '');
  const [status, setStatus] = useState(suggestion.status || 'pending');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!gameName.trim()) return;
    setSaving(true);
    await onSave(suggestion.id, {
      gameName: gameName.trim(),
      rainbetName: rainbetName.trim() || null,
      twitchName: twitchName.trim(),
      status,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">Edit Suggestion</h2>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-white/60 mb-1">Game / Slot Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Twitch Name</label>
            <input
              type="text"
              value={twitchName}
              onChange={(e) => setTwitchName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Rainbet Username</label>
            <input
              type="text"
              value={rainbetName}
              onChange={(e) => setRainbetName(e.target.value)}
              placeholder="optional"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            >
              <option value="pending">Pending</option>
              <option value="highlighted">Highlighted (Picked)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white font-bold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !gameName.trim()}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-bold hover:from-emerald-600 hover:to-purple-600 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSuggestions((items) => {
      const oldIndex = items.findIndex((s) => s.id === active.id);
      const newIndex = items.findIndex((s) => s.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const toggleHighlight = async (suggestion) => {
    await updateDoc(doc(db, 'suggestions', suggestion.id), {
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

  const saveEdit = async (id, fields) => {
    await updateDoc(doc(db, 'suggestions', id), fields);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
          <MessageSquarePlus size={16} />
          SUGGESTIONS
        </div>
        <h1 className="text-4xl font-black tracking-tighter">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
            Viewer Suggestions
          </span>
        </h1>
        <p className="text-white/50 mt-1">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} — drag to reorder, star to highlight as picked.
        </p>
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <a
          href="/suggest"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-purple-400/60 text-sm font-bold transition-all"
        >
          <ExternalLink size={14} />
          goofer.tv/suggest
        </a>

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
              Confirm Clear
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
        <div className="text-center py-16 text-white/40">
          No suggestions yet. Share <strong className="text-white/60">goofer.tv/suggest</strong> with chat!
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={suggestions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {suggestions.map((s) => (
                <SortableRow
                  key={s.id}
                  suggestion={s}
                  onHighlight={toggleHighlight}
                  onEdit={setEditTarget}
                  onDelete={removeSuggestion}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editTarget && (
        <EditModal
          suggestion={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}
