import { HOME_ZONE } from '../../utils/scheduleTime';

// Seasonal themes (spec: Themes). A theme dresses the room: its calendar and
// copy live here, its art in the room's layout under themes.<id>.
export const THEMES = {
  halloween: {
    months: [9], // October (0-based), on Goofer's Arizona calendar
    cards: [{ kicker: 'Spooky season', text: 'The couch is haunted until Halloween.' }],
  },
};

// The theme for `now`, unless `override` names one; 'none' switches themes off.
export function themeFor(now, override = null) {
  if (override === 'none') return null;
  if (override && THEMES[override]) return override;
  const month = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: HOME_ZONE }).format(now)) - 1;
  return Object.keys(THEMES).find((id) => THEMES[id].months.includes(month)) || null;
}

// ?theme=<id> previews a theme in any build; ?theme=none switches it off.
export function readThemeOverride() {
  try {
    return new URLSearchParams(window.location.search).get('theme');
  } catch {
    return null;
  }
}

export const themeArt = (layout, theme) => (theme && layout && layout.themes && layout.themes[theme]) || null;

// The room's toys plus the theme's (spec: Toys).
export const roomToys = (layout, theme) => [...((layout && layout.toys) || []), ...((themeArt(layout, theme) || {}).toys || [])];
