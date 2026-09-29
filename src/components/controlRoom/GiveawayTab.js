import { useControlRoom } from '../../contexts/ControlRoomContext';

// First version: status only. Task 12 replaces this with the full tool.
export default function GiveawayTab() {
  const cr = useControlRoom();
  return <p className="text-sm text-white/55">{cr.giveaway ? `Giveaway ${cr.giveaway.status}.` : 'Nothing running.'}</p>;
}
