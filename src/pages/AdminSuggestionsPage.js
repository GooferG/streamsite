import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Star,
  X,
  RefreshCcw,
  GripVertical,
  Pencil,
  ExternalLink,
  Check,
} from 'lucide-react';
import { db } from '../config/firebase';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

function SortableRow({ suggestion, onHighlight, onEdit, onDelete, index }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: suggestion.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const highlighted = suggestion.status === 'highlighted';
  const tape = String(index + 1).padStart(3, '0');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[auto_auto_1fr_auto] gap-3 items-center px-3 py-2.5 border-t transition-colors duration-150 ${
        highlighted
          ? 'border-emerald-signal/30 bg-emerald-signal/5'
          : 'border-white/8 hover:bg-zinc-card/40'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 text-white/25 hover:text-white/65 cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      <div className="flex items-center gap-2.5">
        <span
          className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums ${
            highlighted ? 'text-emerald-signal' : 'text-white/30'
          } font-mono`}
      >
          #{tape}
        </span>
        {suggestion.profileImageUrl && (
          <img
            src={suggestion.profileImageUrl}
            alt=""
            className="w-8 h-8 rounded-full border border-white/15 flex-shrink-0"
          />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-white-body text-sm leading-tight">
            {suggestion.gameName}
          </p>
          {highlighted && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md text-emerald-signal border border-emerald-signal/40 font-mono"
      >
              <Check size={9} aria-hidden="true" />
              PICKED
            </span>
          )}
        </div>
        <p
          className="mt-0.5 text-[10px] tracking-eyebrow-sm uppercase text-white/40 truncate font-mono"
      >
          {suggestion.twitchName}
          {suggestion.rainbetName ? (
            <span className="text-emerald-signal/60">
              {' '}· {suggestion.rainbetName}
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onHighlight(suggestion)}
          className={`p-2 border transition-colors duration-150 ${
            highlighted
              ? 'bg-emerald-signal/15 border-emerald-signal/40 text-emerald-signal'
              : 'border-white/10 text-white/50 hover:text-emerald-signal hover:border-emerald-signal/40'
          }`}
          aria-label={highlighted ? 'Unpick' : 'Pick'}
          title="Toggle highlight"
        >
          <Star size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onEdit(suggestion)}
          className="p-2 border border-white/10 text-white/50 hover:text-orange-admin hover:border-orange-admin/40 transition-colors duration-150"
          aria-label="Edit"
          title="Edit"
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(suggestion.id)}
          className="p-2 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150"
          aria-label="Delete"
          title="Delete"
        >
          <X size={13} aria-hidden="true" />
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-white/10 bg-zinc-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono"
      >
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>Edit entry</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25 transition-colors duration-150"
            aria-label="Close"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono"
      >
              <span className="text-orange-admin tabular-nums">01</span>{' '}
              Game / slot name <span className="text-emerald-signal">*</span>
            </span>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono"
      >
              <span className="text-orange-admin tabular-nums">02</span> Twitch name
            </span>
            <input
              type="text"
              value={twitchName}
              onChange={(e) => setTwitchName(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono"
      >
              <span className="text-orange-admin tabular-nums">03</span> Rainbet
              username <span className="text-white/30">· optional</span>
            </span>
            <input
              type="text"
              value={rainbetName}
              onChange={(e) => setRainbetName(e.target.value)}
              placeholder="—"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono"
      >
              <span className="text-orange-admin tabular-nums">04</span> Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputCls}
            >
              <option value="pending">Pending</option>
              <option value="highlighted">Highlighted (picked)</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
          >
            <span
              className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              Cancel
            </span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !gameName.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
          >
            <span
              className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              {saving ? 'Saving…' : 'Save'}
            </span>
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

  const pickedCount = suggestions.filter(
    (s) => s.status === 'highlighted'
  ).length;

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      {/* Slate header */}
      <header className="mb-8">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono"
      >
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>VIEWER QUEUE</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">SUG</span>
          <span className="text-white/20">·</span>
          <span className="text-white/45">TOTAL</span>
          <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
            {String(suggestions.length).padStart(3, '0')}
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/45">PICKED</span>
          <span className="text-emerald-signal tabular-nums tracking-eyebrow-lg">
            {String(pickedCount).padStart(3, '0')}
          </span>
        </div>

        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
          }}
        >
          <span className="block">Viewer</span>
          <span className="block text-orange-admin">suggestions.</span>
        </h1>

        <p className="mt-4 text-sm text-white/55 max-w-md leading-relaxed">
          Drag to reorder. Star to mark as picked on the overlay.
        </p>
      </header>

      {/* Action strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <a
          href="/suggest"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/10 text-white/65 hover:text-white-body hover:border-orange-admin/40 transition-colors duration-150"
        >
          <ExternalLink size={12} aria-hidden="true" />
          <span
            className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
            goofer.tv/suggest
          </span>
        </a>

        {!clearConfirm ? (
          <button
            type="button"
            onClick={() => setClearConfirm(true)}
            disabled={suggestions.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 border border-white/10 text-white/55 hover:text-white-body hover:border-red-destructive/50 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={12} aria-hidden="true" />
            <span
              className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              Clear all
            </span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-2 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 transition-colors duration-150"
            >
              <span
                className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                Confirm clear
              </span>
            </button>
            <button
              type="button"
              onClick={() => setClearConfirm(false)}
              className="px-3 py-2 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
            >
              <span
                className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                Cancel
              </span>
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {suggestions.length === 0 ? (
        <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
          <p
            className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono"
      >
            Empty queue
          </p>
          <p className="text-sm text-white/55">
            Share{' '}
            <span className="text-white-body">goofer.tv/suggest</span> with chat.
          </p>
        </div>
      ) : (
        <div className="border border-white/8 bg-zinc-card/30">
          <div
            className="flex items-center gap-3 px-4 py-2 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
            <span>Order</span>
            <span className="text-white/15">·</span>
            <span>Drag handle to rearrange</span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={suggestions.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {suggestions.map((s, i) => (
                  <SortableRow
                    key={s.id}
                    suggestion={s}
                    index={i}
                    onHighlight={toggleHighlight}
                    onEdit={setEditTarget}
                    onDelete={removeSuggestion}
                  />
                ))}
                <div className="border-t border-white/8" />
              </div>
            </SortableContext>
          </DndContext>
        </div>
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
