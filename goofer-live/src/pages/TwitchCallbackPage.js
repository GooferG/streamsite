import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

export default function TwitchCallbackPage() {
  const [searchParams] = useSearchParams();
  const { signInWithTwitchCode } = useTwitchAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const twitchError = searchParams.get('error');

    if (twitchError) {
      setError(`Twitch denied access: ${twitchError}`);
      return;
    }
    if (!code) {
      setError('No code returned from Twitch.');
      return;
    }
    signInWithTwitchCode(code)
      .then(() => navigate('/suggest', { replace: true }))
      .catch((err) => {
        console.error('Twitch login error:', err);
        setError(`Login failed: ${err?.message || 'Unknown error'}. Check console for details.`);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-red-400 font-bold">{error}</p>
          <button
            onClick={() => navigate('/suggest')}
            className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 hover:border-purple-400/60 transition-all"
          >
            Back to Suggest
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/60">Logging you in with Twitch...</p>
      </div>
    </div>
  );
}
