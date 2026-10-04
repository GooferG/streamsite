import { Gamepad2, Layers, LayoutGrid, Radio, Swords } from 'lucide-react';

// Canonical Gamba channel list: the single source for the nav menu and side
// sheet, the in-page tuner, the hub, the home list and the Hunts monitor.
// Channel numbers follow the On Air handoff: Hub 00, tools 01–04.
export const GAMBA_TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio, channel: 1, path: '/gamba/leaderboard' },
  { id: 'hunts', label: 'Hunts', icon: Layers, channel: 2, path: '/gamba/hunts' },
  { id: 'bonus-battle', label: 'Bonus Battle', icon: Swords, channel: 3, path: '/gamba/bonus-battle' },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2, channel: 4, path: '/gamba/wheel' },
];

export const GAMBA_HUB = { id: 'hub', label: 'Hub', icon: LayoutGrid, channel: 0, path: '/gamba' };

// The hub plus every tool, in channel order.
export const GAMBA_CHANNELS = [GAMBA_HUB, ...GAMBA_TOOLS];

const pad2 = (n) => String(n).padStart(2, '0');

// "CH 02": the form used inside /gamba (tuner, hub, monitor headers).
export function channelLabel(tool) {
  return `CH ${pad2(tool.channel)}`;
}

// "4-2": the subchannel form used in the site nav, where 01–08 are pages.
export function subchannelLabel(tool, parentCode) {
  return `${Number(parentCode)}-${tool.channel}`;
}

// The channel a path is tuned to (/gamba is the hub), or null off /gamba.
export function channelForPath(pathname) {
  const [, root, id] = pathname.split('/');
  if (root !== 'gamba') return null;
  if (!id) return GAMBA_HUB;
  return GAMBA_TOOLS.find((t) => t.id === id) || null;
}
