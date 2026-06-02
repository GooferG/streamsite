import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { RadioTower } from 'lucide-react';
import { db } from '../config/firebase';
import { computeBattle } from '../utils/battleCalc';
import { BattleBoard, FinishedScreen } from '../components/BonusBattle';

export default function BattlePage() {
  const { ownerId } = useParams();
  const [battle, setBattle] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    const unsubBattle = onSnapshot(
      doc(db, 'bonus_battles', ownerId),
      (snap) => {
        setLoading(false);
        if (snap.exists()) {
          setBattle({ id: snap.id, ...snap.data() });
          setMissing(false);
        } else {
          setBattle(null);
          setMissing(true);
        }
      },
      (err) => {
        console.error('battle live sub error:', err);
        setLoading(false);
      }
    );
    const playersQ = query(
      collection(db, 'bonus_battles', ownerId, 'players'),
      orderBy('order', 'asc')
    );
    const unsubPlayers = onSnapshot(playersQ, (snap) =>
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubBattle();
      unsubPlayers();
    };
  }, [ownerId]);

  const derived = computeBattle(players, {
    rakePct: battle?.rakePct ?? 10,
    entryFee: battle?.entryFee ?? 0,
  });

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono text-emerald-signal">
          <RadioTower size={14} className="motion-safe:animate-pulse" />
          {battle?.title || 'Bonus Battle'} · Live
        </div>
        {loading && <p className="text-white/50 font-mono text-sm">Connecting…</p>}
        {!loading && missing && (
          <p className="text-white/60 font-mono text-sm">No live battle right now.</p>
        )}
        {!loading && battle && battle.phase === 'finished' && (
          <FinishedScreen battle={battle} players={players} derived={derived} interactive={false} />
        )}
        {!loading && battle && battle.phase !== 'finished' && (
          <BattleBoard battle={battle} players={players} derived={derived} interactive={false} />
        )}
      </div>
    </div>
  );
}
