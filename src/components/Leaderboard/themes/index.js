import BroadcastTheme from './BroadcastTheme';
import MinimalTheme from './MinimalTheme';

export const DEFAULT_THEME_ID = 'broadcast';

export const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: BroadcastTheme },
  { id: 'minimal', label: 'Minimal', Component: MinimalTheme },
];
