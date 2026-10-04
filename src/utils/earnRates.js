// Earning rates the store copy depends on. They mirror server defaults:
// WATCHTIME_TICKETS_PER_WINDOW, WATCHTIME_CHAT_BONUS (api/_lib/watchtime.js),
// DAILY_TICKET_AWARD and the 22 h cooldown (api/me/claim-daily.js), and
// DISCORD_LINK_TICKET_AWARD (api/discord-auth.js). Real awards always come
// from API responses; these only drive hints. Update them if those env values change.
export const WATCH_TICKETS_PER_WINDOW = 1;
export const WATCH_WINDOW_MINUTES = 5;
export const CHAT_BONUS_PER_WINDOW = 1;
export const DAILY_DROP = 10;
export const DISCORD_LINK_BONUS = 100;
export const DAILY_COOLDOWN_MS = 22 * 60 * 60 * 1000;
export const WATCH_TICKETS_PER_HOUR = (60 / WATCH_WINDOW_MINUTES) * WATCH_TICKETS_PER_WINDOW;
