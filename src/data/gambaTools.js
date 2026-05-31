import { Target, Gamepad2, MessageSquarePlus, Layers, Radio } from 'lucide-react';

// Canonical Gamba tool list. Single source of truth for the in-page tool tabs
// (GambaPage) and the nav dropdown (Navigation). Routes are /gamba/${id}.
export const GAMBA_TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', icon: MessageSquarePlus },
];
