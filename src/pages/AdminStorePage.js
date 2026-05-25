import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { Plus, Pencil, Trash2, X, Check, Image as ImageIcon } from 'lucide-react';
import { db } from '../config/firebase';
import { authedFetch } from '../utils/authedFetch';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

const EMPTY_FORM = {
  name: '',
  description: '',
  cost: 100,
  kind: 'virtual',
  stock: '',
  imageUrl: '',
  active: true,
  sortOrder: 0,
};

function ItemForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Name required');
    const cost = Number(form.cost);
    if (!Number.isInteger(cost) || cost <= 0) return setError('Cost must be a positive whole number');
    if (form.stock !== '' && form.stock !== null) {
      const s = Number(form.stock);
      if (!Number.isInteger(s) || s < 0) return setError('Stock must be a non-negative integer or blank');
    }
    await onSave({
      ...form,
      cost,
      stock: form.stock === '' || form.stock === null ? null : Number(form.stock),
      sortOrder: Number(form.sortOrder) || 0,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-white/10 bg-zinc-card"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            {initial?.id ? 'Edit item' : 'New item'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <label className="block">
            <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">01</span> Name <span className="text-emerald-signal">*</span>
            </span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">02</span> Description
            </span>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className={inputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                <span className="text-orange-admin tabular-nums">03</span> Cost <span className="text-emerald-signal">*</span>
              </span>
              <input
                type="number"
                min="1"
                value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                <span className="text-orange-admin tabular-nums">04</span> Kind <span className="text-emerald-signal">*</span>
              </span>
              <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className={inputCls}>
                <option value="virtual">Virtual · auto-grant</option>
                <option value="stream">Stream · admin queue</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                <span className="text-orange-admin tabular-nums">05</span> Stock <span className="text-white/30">· blank = unlimited</span>
              </span>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
                placeholder="—"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                <span className="text-orange-admin tabular-nums">06</span> Sort order
              </span>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">07</span> Image URL <span className="text-white/30">· optional</span>
            </span>
            <input
              value={form.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
            />
            <span className="text-[11px] font-bold tracking-eyebrow uppercase text-white/70 font-mono">
              Active · visible in store
            </span>
          </label>
          {error && (
            <p className="text-[11px] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
          >
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              Cancel
            </span>
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
          >
            <Check size={13} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              {saving ? 'Saving…' : 'Save'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminStorePage() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'store_items'), orderBy('sortOrder', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const save = async (form) => {
    setSaving(true);
    try {
      const isEdit = editing?.id;
      const res = await authedFetch('/api/admin/store-items', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(isEdit ? { id: editing.id, ...form } : form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Save failed: ${data.error || res.status}`);
        return;
      }
      setEditing(null);
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const res = await authedFetch(`/api/admin/store-items?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Delete failed: ${data.error || res.status}`);
    }
    setConfirmingDelete(null);
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>STORE CATALOG</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">STR</span>
          <span className="text-white/20">·</span>
          <span className="text-white/45">ITEMS</span>
          <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
            {String(items.length).padStart(3, '0')}
          </span>
        </div>
        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
          }}
        >
          <span className="block">Store</span>
          <span className="block text-orange-admin">catalog.</span>
        </h1>
      </header>

      <div className="flex items-center justify-end mb-6">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150"
        >
          <Plus size={13} aria-hidden="true" />
          <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
            New item
          </span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono">
            Empty catalog
          </p>
          <p className="text-sm text-white/55">Create the first item to populate the store.</p>
        </div>
      ) : (
        <div className="border border-white/8 bg-zinc-card/30">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0"
            >
              <div className="w-12 h-12 border border-white/10 bg-zinc-broadcast/40 flex items-center justify-center overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={14} className="text-white/30" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-white-body text-sm">{item.name}</p>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono border ${
                      item.kind === 'stream'
                        ? 'text-orange-admin border-orange-admin/40'
                        : 'text-emerald-signal border-emerald-signal/40'
                    }`}
                  >
                    {item.kind}
                  </span>
                  {!item.active && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase text-white/40 border border-white/15 font-mono">
                      hidden
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
                  Cost <span className="text-emerald-signal/80">{item.cost}</span> · Stock{' '}
                  <span className="text-white/60">
                    {item.stock === null || item.stock === undefined ? '∞' : item.stock}
                  </span>{' '}
                  · Sort <span className="text-white/60 tabular-nums">{item.sortOrder ?? 0}</span>
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditing(item);
                  }}
                  className="p-2 border border-white/10 text-white/50 hover:text-orange-admin hover:border-orange-admin/40 transition-colors duration-150"
                  aria-label="Edit"
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                {confirmingDelete === item.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="px-2 py-2 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(null)}
                      className="p-2 border border-white/10 text-white/55 hover:text-white-body"
                      aria-label="Cancel"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(item.id)}
                    className="p-2 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150"
                    aria-label="Delete"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ItemForm
          initial={editing}
          saving={saving}
          onSave={save}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
