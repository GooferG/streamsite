import { Gamepad2, Layers, Radio, Swords } from 'lucide-react';

// Canonical Gamba tool list. Single source of truth for the in-page tool tabs
// (GambaPage) and the nav dropdown (Navigation). Routes are /gamba/${id}.
export const GAMBA_TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunts', label: 'Hunts', icon: Layers },
  { id: 'bonus-battle', label: 'Bonus Battle', icon: Swords },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
];
