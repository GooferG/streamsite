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
import { Star, X, RefreshCcw, ExternalLink } from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

function SectionLabel({ code, label }) {
  return (
    <div
      className="flex items-baseline gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 font-mono"
      >
      <span className="text-emerald-signal tabular-nums">{code}</span>
      <span>{label}</span>
    </div>
  );
}

function SuggestionRow({ suggestion, onToggle, onRemove, index }) {
  const highlighted = suggestion.status === 'highlighted';
  const tape = String(index + 1).padStart(3, '0');

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-3 border-t transition-colors duration-150 ${
        highlighted
          ? 'border-emerald-signal/30 bg-emerald-signal/5'
          : 'border-white/8 hover:bg-zinc-card/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`font-mono text-[10px] font-bold tracking-eyebrow-md tabular-nums ${
            highlighted ? 'text-emerald-signal' : 'text-white/30'
          }`}
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
              className="px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md text-emerald-signal border border-emerald-signal/40 font-mono"
      >
              PICKED
            </span>
          )}
        </div>
        <p
          className="mt-0.5 text-[11px] tracking-eyebrow-sm uppercase text-white/40 truncate font-mono"
      >
          {suggestion.twitchName}
          {suggestion.rainbetName ? (
            <span className="text-emerald-signal/60"> · {suggestion.rainbetName}</span>
          ) : null}
        </p>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => onToggle(suggestion)}
          className={`p-2 border transition-colors duration-150 ${
            highlighted
              ? 'bg-emerald-signal/15 border-emerald-signal/40 text-emerald-signal'
              : 'border-white/10 text-white/50 hover:text-emerald-signal hover:border-emerald-signal/40'
          }`}
          aria-label={highlighted ? 'Unpick suggestion' : 'Pick suggestion'}
          type="button"
        >
          <Star size={14} aria-hidden="true" />
        </button>
        <button
          onClick={() => onRemove(suggestion.id)}
          className="p-2 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150"
          aria-label="Remove suggestion"
          type="button"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function SuggestAdminTab() {
  const { twitchUser, loginWithTwitch, logout } = useTwitchAuth();
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

  const count = suggestions.length;
  const pickedCount = suggestions.filter((s) => s.status === 'highlighted').length;

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Status bar */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono"
      >
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          <span>VIEWER FEED</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/45">QUEUE</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(count).padStart(3, '0')}
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/45">PICKED</span>
        <span className="text-emerald-signal tabular-nums tracking-eyebrow-lg">
          {String(pickedCount).padStart(3, '0')}
        </span>
      </div>

      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-5 border-b border-white/8">
        <div>
          <SectionLabel code="01" label="Suggestions" />
          <h2
            className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white-body"
            style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          >
            Viewer suggestions
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Star a game to mark it as picked on the overlay.
          </p>
        </div>

        {!clearConfirm ? (
          <button
            type="button"
            onClick={() => setClearConfirm(true)}
            disabled={count === 0}
            className="inline-flex items-center gap-2 px-3 py-2 border border-white/10 text-white/60 hover:text-white-body hover:border-red-destructive/50 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={13} aria-hidden="true" />
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
                Confirm
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

      {/* Viewer auth strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 border-b border-white/8 bg-zinc-broadcast/40">
        {twitchUser ? (
          <>
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
            <div className="flex gap-2 flex-wrap">
              <a
                href="/suggest"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <ExternalLink size={13} aria-hidden="true" />
                <span
                  className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  Suggest a game
                </span>
              </a>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-2 border border-white/10 text-white/55 hover:text-white-body transition-colors duration-150"
              >
                <span
                  className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  Sign out
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-white/65">
              Log in with Twitch to submit your own, or share the link with chat.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={loginWithTwitch}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
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
                  className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  Sign in with Twitch
                </span>
              </button>
              <a
                href="/suggest"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-white/60 hover:text-white-body hover:border-white/30 transition-colors duration-150"
              >
                <ExternalLink size={13} aria-hidden="true" />
                <span
                  className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  goofer.tv/suggest
                </span>
              </a>
            </div>
          </>
        )}
      </div>

      {/* List */}
      {count === 0 ? (
        <div
          className="px-4 py-10 text-center font-mono"
      >
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/35 mb-2">
            Empty queue
          </p>
          <p className="text-sm text-white/55">
            Share{' '}
            <span className="text-white-body">goofer.tv/suggest</span>{' '}
            with chat.
          </p>
        </div>
      ) : (
        <div>
          {suggestions.map((s, i) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              onToggle={toggleHighlight}
              onRemove={removeSuggestion}
              index={i}
            />
          ))}
          <div className="border-t border-white/8" />
        </div>
      )}
    </div>
  );
}
