import { useState, useEffect } from 'react';
import { LogOut, Send, Edit2, X, Check } from 'lucide-react';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { Filter } from 'bad-words';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useNowTimestamp, formatTimecode } from '../utils/timecode';

const filter = new Filter();

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-4 py-3 text-sm text-white-body placeholder:text-white/25 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

function StatusBar({ label, value, tone = 'emerald' }) {
  const color =
    tone === 'orange'
      ? 'text-orange-admin bg-orange-admin'
      : 'text-emerald-signal bg-emerald-signal';
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono"
      >
      <span className={`inline-flex items-center gap-2 ${color.split(' ')[0]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${color.split(' ')[1]}`} />
        <span>{label}</span>
      </span>
      {value && (
        <>
          <span className="text-white/15">·</span>
          <span className="text-white/45">CHANNEL</span>
          <span className="text-white/70 tracking-eyebrow-lg">{value}</span>
        </>
      )}
    </div>
  );
}

function SuggestionRow({ suggestion, index, isMine }) {
  const highlighted = suggestion.status === 'highlighted';
  const tape = String(index + 1).padStart(3, '0');

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-2.5 border-t transition-colors duration-150 ${
        highlighted
          ? 'border-emerald-signal/30 bg-emerald-signal/5'
          : isMine
            ? 'border-white/12 bg-zinc-card/30'
            : 'border-white/8'
      }`}
    >
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
            className="w-7 h-7 rounded-full border border-white/15 flex-shrink-0"
          />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-white-body text-sm leading-tight truncate">
            {suggestion.gameName}
          </p>
          {isMine && (
            <span
              className="px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md text-white/55 border border-white/20 font-mono"
      >
              YOU
            </span>
          )}
        </div>
        <p
          className="mt-0.5 text-[10px] tracking-eyebrow-sm uppercase text-white/40 truncate font-mono"
      >
          {suggestion.twitchName}
          {suggestion.rainbetName ? (
            <span className="text-emerald-signal/60"> · {suggestion.rainbetName}</span>
          ) : null}
        </p>
      </div>

      {highlighted && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md text-emerald-signal border border-emerald-signal/40 flex-shrink-0 font-mono"
      >
          <Check size={9} aria-hidden="true" />
          PICKED
        </span>
      )}
    </div>
  );
}

export default function SuggestPage() {
  const { twitchUser, loading, loginWithTwitch, logout } = useTwitchAuth();
  const [gameName, setGameName] = useState('');
  const [rainbetName, setRainbetName] = useState('');
  const [existing, setExisting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [allSuggestions, setAllSuggestions] = useState([]);
  const now = useNowTimestamp();

  useEffect(() => {
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAllSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!twitchUser) return;
    const ref = doc(db, 'suggestions', twitchUser.twitchId);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setExisting(data);
        setGameName(data.gameName);
        setRainbetName(data.rainbetName || '');
        setSubmitted(true);
      }
    });
  }, [twitchUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = gameName.trim();
    if (!trimmed) return setError('Game name is required.');
    if (trimmed.length > 100)
      return setError('Game name must be 100 characters or less.');
    if (filter.isProfane(trimmed))
      return setError('That game name contains disallowed words. Please keep it clean.');

    setSubmitting(true);
    try {
      const ref = doc(db, 'suggestions', twitchUser.twitchId);
      await setDoc(ref, {
        twitchId: twitchUser.twitchId,
        twitchName: twitchUser.displayName,
        profileImageUrl: twitchUser.profileImageUrl || null,
        rainbetName: rainbetName.trim() || null,
        gameName: trimmed,
        status: existing?.status || 'pending',
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setExisting({
        ...existing,
        gameName: trimmed,
        rainbetName: rainbetName.trim() || null,
      });
      setSubmitted(true);
      setEditing(false);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'suggestions', twitchUser.twitchId));
      setExisting(null);
      setSubmitted(false);
      setGameName('');
      setRainbetName('');
    } catch {
      setError('Failed to remove suggestion.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-broadcast">
        <span
          className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
          Tuning…
        </span>
      </div>
    );
  }

  const pickedCount = allSuggestions.filter(
    (s) => s.status === 'highlighted'
  ).length;

  return (
    <div className="relative min-h-screen pt-20 pb-20 px-4 sm:px-6 bg-zinc-broadcast text-white-body">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden z-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
        }}
      />

      <div className="relative z-10 max-w-md mx-auto space-y-5">
        {/* Slate header */}
        <header>
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono"
      >
            <span className="inline-flex items-center gap-2">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              </span>
              <span className="text-emerald-signal">VIEWER FEED</span>
            </span>
            <span className="text-white/20">·</span>
            <span>GOOFER.TV</span>
            <span className="text-white/20">·</span>
            <span className="text-white/30 tabular-nums">{formatTimecode(now)}</span>
          </div>

          <h1
            className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.5rem, 9vw, 3.5rem)',
            }}
          >
            <span className="block">Suggest a</span>
            <span className="block text-emerald-signal">game.</span>
          </h1>

          <p className="mt-4 text-sm text-white/60 leading-relaxed">
            Log in with Twitch to drop one slot or game onto the broadcast queue.
          </p>
        </header>

        {/* Auth gate */}
        {!twitchUser ? (
          <div className="border border-white/8 bg-zinc-card/30">
            <StatusBar label="Access required" value="GG-VIEWER" tone="orange" />
            <div className="px-5 py-6 space-y-4">
              <p className="text-sm text-white/70">
                Sign in with your Twitch account to drop a suggestion. One entry
                per viewer.
              </p>
              <button
                type="button"
                onClick={loginWithTwitch}
                className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                </svg>
                <span
                  className="text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  Sign in with Twitch
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-white/8 bg-zinc-card/30">
            <StatusBar
              label={submitted && !editing ? 'Logged' : 'Compose'}
              value={twitchUser.displayName?.toUpperCase()}
            />

            {/* Viewer identity strip */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 bg-zinc-broadcast/40">
              <div className="flex items-center gap-3 min-w-0">
                {twitchUser.profileImageUrl && (
                  <img
                    src={twitchUser.profileImageUrl}
                    alt=""
                    className="w-9 h-9 rounded-full border border-white/15 flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white-body truncate">
                    {twitchUser.displayName}
                  </p>
                  <p
                    className="text-[10px] font-bold tracking-eyebrow-md uppercase text-emerald-signal/80 font-mono"
      >
                    Twitch · Authenticated
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="p-2 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25 transition-colors duration-150"
                aria-label="Sign out"
              >
                <LogOut size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Body — submitted view */}
            {submitted && !editing ? (
              <div className="px-4 py-5 space-y-4">
                <div>
                  <p
                    className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal mb-2 font-mono"
      >
                    Your entry
                  </p>
                  <p className="text-2xl font-black text-white-body tracking-tight leading-tight">
                    {existing?.gameName}
                  </p>
                  {existing?.rainbetName && (
                    <p
                      className="mt-1 text-[11px] tracking-eyebrow uppercase text-white/45 font-mono"
      >
                      Rainbet ·{' '}
                      <span className="text-emerald-signal/80">{existing.rainbetName}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/70 hover:text-white-body hover:border-emerald-signal/40 transition-colors duration-150"
                  >
                    <Edit2 size={13} aria-hidden="true" />
                    <span
                      className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                      Update
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-2 px-3 py-2.5 border border-red-destructive/40 text-red-destructive hover:bg-red-destructive/10 transition-colors duration-150"
                  >
                    <X size={13} aria-hidden="true" />
                    <span
                      className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                      Remove
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-4 py-5 space-y-4">
                <label className="block">
                  <span
                    className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono"
      >
                    Game / slot name{' '}
                    <span className="text-emerald-signal">*</span>
                  </span>
                  <input
                    type="text"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder="Gates of Olympus"
                    maxLength={100}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span
                    className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono"
      >
                    Rainbet username{' '}
                    <span className="text-white/30">· optional</span>
                  </span>
                  <input
                    type="text"
                    value={rainbetName}
                    onChange={(e) => setRainbetName(e.target.value)}
                    placeholder="Your Rainbet username"
                    className={inputCls}
                  />
                </label>

                {error && (
                  <p
                    className="text-[11px] font-bold tracking-eyebrow uppercase text-red-destructive font-mono"
      >
                    {error}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setGameName(existing?.gameName || '');
                        setRainbetName(existing?.rainbetName || '');
                        setError('');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
                    >
                      <span
                        className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                        Cancel
                      </span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
                  >
                    <Send size={13} aria-hidden="true" />
                    <span
                      className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                      {submitting ? 'Sending…' : editing ? 'Update' : 'Submit'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* All suggestions feed */}
        {allSuggestions.length > 0 && (
          <div className="border border-white/8 bg-zinc-card/30">
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono"
      >
              <span className="text-white/55">Queue</span>
              <span className="text-white/15">·</span>
              <span className="text-white/45">TOTAL</span>
              <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
                {String(allSuggestions.length).padStart(3, '0')}
              </span>
              <span className="text-white/15">·</span>
              <span className="text-white/45">PICKED</span>
              <span className="text-emerald-signal tabular-nums tracking-eyebrow-lg">
                {String(pickedCount).padStart(3, '0')}
              </span>
            </div>
            <div>
              {allSuggestions.map((s, i) => (
                <SuggestionRow
                  key={s.id}
                  suggestion={s}
                  index={i}
                  isMine={twitchUser && s.twitchId === twitchUser.twitchId}
                />
              ))}
              <div className="border-t border-white/8" />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer
          className="pt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10px] uppercase tracking-eyebrow-lg text-white/30 font-mono"
      >
          <span>END OF FEED</span>
          <span className="text-white/15">·</span>
          <span className="text-emerald-signal/70 tabular-nums">
            {formatTimecode(now)}
          </span>
        </footer>
      </div>
    </div>
  );
}
