import BroadcastTheme from './BroadcastTheme';
import CasinoTheme from './CasinoTheme';
import MinimalTheme from './MinimalTheme';

export const DEFAULT_THEME_ID = 'broadcast';

export const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: BroadcastTheme },
  { id: 'casino', label: 'Casino', Component: CasinoTheme },
  { id: 'minimal', label: 'Minimal', Component: MinimalTheme },
];
