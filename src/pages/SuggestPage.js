import { useState, useEffect } from 'react';
import { Gamepad2, LogOut, Send, Edit2 } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Filter from 'bad-words';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

const filter = new Filter();

export default function SuggestPage() {
  const { twitchUser, loading, loginWithTwitch, logout } = useTwitchAuth();
  const [gameName, setGameName] = useState('');
  const [rainbetName, setRainbetName] = useState('');
  const [existing, setExisting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

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
    if (trimmed.length > 100) return setError('Game name must be 100 characters or less.');
    if (filter.isProfane(trimmed)) return setError('That game name contains disallowed words. Please keep it clean.');

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
      setExisting({ ...existing, gameName: trimmed, rainbetName: rainbetName.trim() || null });
      setSubmitted(true);
      setEditing(false);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-emerald-950 to-purple-950 text-white pt-16 pb-24 px-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-purple-400 font-bold">
            <Gamepad2 size={20} />
            GOOFER.TV
          </div>
          <h1 className="text-4xl font-black tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              Suggest a Game
            </span>
          </h1>
          <p className="text-white/60 text-sm">
            Logged-in viewers can suggest one slot or game for the stream.
          </p>
        </div>

        {!twitchUser ? (
          <div className="p-8 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm text-center space-y-4">
            <p className="text-white/70">Login with your Twitch account to suggest a game.</p>
            <button
              onClick={loginWithTwitch}
              className="w-full px-6 py-4 rounded-lg bg-[#9146FF] hover:bg-[#7d2ff7] text-white font-bold transition-all flex items-center justify-center gap-3"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
              </svg>
              Login with Twitch
            </button>
          </div>
        ) : (
          <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {twitchUser.profileImageUrl && (
                  <img src={twitchUser.profileImageUrl} alt="" className="w-9 h-9 rounded-full border border-white/20" />
                )}
                <div>
                  <p className="font-bold text-white">{twitchUser.displayName}</p>
                  <p className="text-xs text-purple-400">Twitch</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all"
              >
                <LogOut size={16} />
              </button>
            </div>

            {submitted && !editing ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-1">
                  <p className="text-xs text-emerald-400 font-bold uppercase tracking-wide">Your suggestion</p>
                  <p className="font-black text-white text-xl">{existing?.gameName}</p>
                  {existing?.rainbetName && (
                    <p className="text-sm text-white/60">
                      Rainbet: <span className="text-emerald-300">{existing.rainbetName}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-emerald-400/60 transition-all flex items-center justify-center gap-2 font-bold"
                >
                  <Edit2 size={16} />
                  Update Suggestion
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Game / Slot Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder="e.g. Gates of Olympus"
                    maxLength={100}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Rainbet Username <span className="text-white/40">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={rainbetName}
                    onChange={(e) => setRainbetName(e.target.value)}
                    placeholder="Your Rainbet username"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setGameName(existing?.gameName || '');
                        setRainbetName(existing?.rainbetName || '');
                        setError('');
                      }}
                      className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all font-bold"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-bold hover:from-emerald-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    {submitting ? 'Submitting...' : editing ? 'Update' : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
