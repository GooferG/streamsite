import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Plus, Trash2, AlertCircle } from 'lucide-react';
import { authedFetch } from '../utils/authedFetch';
import { useAuth } from '../contexts/AuthContext';

function Avatar({ url, name, size = 36 }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="rounded-full border border-white/15"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="rounded-full border border-white/15 bg-zinc-card flex items-center justify-center font-mono font-bold text-white/60"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

export default function AdminModeratorsPage() {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [mods, setMods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [twitchName, setTwitchName] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/moderators', { method: 'GET' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load.');
      } else {
        setMods(data.mods || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner]);

  const add = async (e) => {
    e.preventDefault();
    const name = twitchName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/moderators', {
        method: 'POST',
        body: JSON.stringify({ twitchName: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'TWITCH_USER_NOT_FOUND') {
          setError(`No Twitch user named "${name}".`);
        } else if (data.error === 'ALREADY_MODERATOR') {
          setError(`${name} is already a moderator.`);
        } else {
          setError(data.error || 'Failed to add.');
        }
      } else {
        setTwitchName('');
        await load();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (mod) => {
    const ok = window.confirm(
      `Remove @${mod.twitchName} from moderators? They'll lose admin access immediately.`
    );
    if (!ok) return;
    setRemovingId(mod.twitchId);
    setError(null);
    try {
      const res = await authedFetch(
        `/api/admin/moderators?twitchId=${encodeURIComponent(mod.twitchId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to remove.');
      } else {
        await load();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="px-4 py-3 border border-red-destructive/40 bg-red-destructive/5 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/80">
            This page is owner-only. Moderators can't manage other moderators.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/50 hover:text-white-body font-mono mb-3"
        >
          <ArrowLeft size={11} aria-hidden="true" />
          Back to hub
        </button>
        <div className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-orange-admin font-mono mb-2">
          <ShieldCheck size={11} aria-hidden="true" />
          <span>Module MOD</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white-body">Moderators</h1>
        <p className="mt-1 text-sm text-white/55 max-w-lg">
          People you trust to help run giveaways, fulfill redemptions, and manage hunts. Mods can't
          access the store catalog, the database wipe, or this page.
        </p>
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 border border-red-destructive/40 bg-red-destructive/10 flex items-start gap-2">
          <AlertCircle size={13} className="text-red-destructive flex-shrink-0 mt-0.5" />
          <span className="text-[0.75rem] text-red-destructive/90">{error}</span>
        </div>
      )}

      {/* Add form */}
      <form
        onSubmit={add}
        className="mb-6 border border-white/10 bg-zinc-card/30 p-4 flex items-end gap-3"
      >
        <label className="flex-1 block">
          <div className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
            Twitch username
          </div>
          <input
            type="text"
            value={twitchName}
            onChange={(e) => setTwitchName(e.target.value)}
            placeholder="theirloginname"
            autoComplete="off"
            className="w-full px-3 py-2 bg-zinc-broadcast/60 border border-white/10 text-sm text-white-body focus:border-orange-admin/60 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={adding || !twitchName.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
        >
          <Plus size={13} aria-hidden="true" />
          <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            {adding ? 'Adding…' : 'Add mod'}
          </span>
        </button>
      </form>

      {/* List */}
      <section className="border border-white/10 bg-zinc-card/30">
        <header className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white-body font-mono">
            Active moderators
          </span>
          <span className="text-[0.625rem] font-mono text-white/45 tabular-nums">
            {loading ? '…' : mods.length}
          </span>
        </header>
        <div>
          {loading ? (
            <p className="p-6 text-center text-[0.6875rem] font-mono uppercase tracking-eyebrow text-white/40">
              Loading…
            </p>
          ) : mods.length === 0 ? (
            <p className="p-6 text-center text-sm text-white/45 italic">
              No moderators yet. Add one above.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {mods.map((m) => (
                <li key={m.twitchId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar url={m.profileImageUrl} name={m.displayName || m.twitchName} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white-body truncate">
                      {m.displayName || m.twitchName}
                    </div>
                    <div className="text-[0.6875rem] text-white/45 font-mono truncate">
                      @{m.twitchName} <span className="text-white/25">· id {m.twitchId}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    disabled={removingId === m.twitchId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-destructive/40 text-red-destructive hover:bg-red-destructive/10 transition-colors duration-150 disabled:opacity-50"
                  >
                    <Trash2 size={11} aria-hidden="true" />
                    <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                      {removingId === m.twitchId ? 'Removing…' : 'Remove'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
