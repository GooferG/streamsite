import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { authedFetch } from '../utils/authedFetch';

const REDIRECT_URI =
  process.env.REACT_APP_DISCORD_REDIRECT_URI ||
  (typeof window !== 'undefined' ? `${window.location.origin}/discord-callback` : '');

const ERROR_LABELS = {
  NOT_IN_GUILD: "You need to join GooferG's Discord server before linking.",
  DISCORD_ALREADY_LINKED: 'That Discord account is already linked to a different Twitch user.',
  NOT_AUTHENTICATED: 'Sign in with Twitch first, then try linking Discord.',
  DISCORD_NOT_CONFIGURED: 'Discord linking is not set up yet — admin needs to configure it.',
  USER_NOT_FOUND: 'Your account is missing — try logging out and back in with Twitch.',
};

export default function DiscordCallbackPage() {
  const [params] = useSearchParams();
  const { twitchUser, loading: twitchLoading } = useTwitchAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('working'); // working | success | error
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (twitchLoading) return;
    const code = params.get('code');
    const err = params.get('error');

    if (err) {
      setStatus('error');
      setMessage(`Discord denied access: ${err}`);
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('Discord did not return a code.');
      return;
    }
    if (!twitchUser) {
      setStatus('error');
      setMessage('You must sign in with Twitch before linking Discord.');
      return;
    }

    (async () => {
      try {
        const res = await authedFetch('/api/discord-auth', {
          method: 'POST',
          body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMessage(ERROR_LABELS[data.error] || data.error || 'Linking failed.');
          return;
        }
        setStatus('success');
        if (data.alreadyLinked) {
          setMessage('Discord already linked. No new tickets granted.');
        } else {
          setMessage(`Discord linked! +${data.awarded} tickets.`);
        }
        setTimeout(() => navigate('/me', { replace: true }), 1800);
      } catch (e) {
        setStatus('error');
        setMessage(ERROR_LABELS[e.message] || 'Network error.');
      }
    })();
  }, [twitchLoading, twitchUser, params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-broadcast text-white-body px-6">
      <div className="text-center space-y-4 max-w-md">
        {status === 'working' && (
          <>
            <div className="w-8 h-8 border-2 border-emerald-signal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white/60">Linking your Discord…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <p className="text-emerald-signal font-bold text-lg">{message}</p>
            <p className="text-[0.6875rem] tracking-eyebrow uppercase text-white/40 font-mono">
              Redirecting to your account…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-destructive font-bold">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/me')}
              className="px-4 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/30 transition-colors duration-150"
            >
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                Back to account
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
