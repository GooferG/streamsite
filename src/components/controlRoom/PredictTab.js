import { useControlRoom } from '../../contexts/ControlRoomContext';

// First version: status only. Task 13 replaces this with the full tool.
export default function PredictTab() {
  const cr = useControlRoom();
  return <p className="text-sm text-white/55">{cr.activeRound ? `Round ${cr.activeRound.status}.` : 'No round running.'}</p>;
}
