// Single source of truth for "which identity is signed in" on the shared Firebase
// auth instance. The site has ONE auth.currentUser; admin (email/password) and
// Twitch viewer (custom token, no email) cannot coexist. These helpers keep the
// stored Twitch profile honest and warn before a login replaces the other identity.

/**
 * True iff the stored Twitch profile reflects the REAL current session.
 * A Twitch viewer signs in via custom token (no email) with uid === twitchId.
 * Any admin/staff session (email present) or a uid mismatch means the stored
 * Twitch profile is stale and should be cleared.
 *
 * @param {{uid: string, email?: string|null}|null} currentUser - auth.currentUser
 * @param {{twitchId: string}|null} storedTwitchUser - persisted Twitch profile
 */
export function isViewerSession(currentUser, storedTwitchUser) {
  if (!currentUser) return false;
  if (currentUser.email) return false; // admin/staff email account
  if (!storedTwitchUser) return false;
  return storedTwitchUser.twitchId === currentUser.uid;
}

export const SWITCH_TO_TWITCH_MSG =
  "You're signed in as Admin. Continuing with Twitch will sign you out of Admin. Continue?";

/**
 * Build the "switching to Admin" warning, naming the active Twitch viewer.
 * @param {string} [name] - the active Twitch display name
 */
export function switchToAdminMsg(name) {
  const who = name ? `${name} (Twitch)` : 'Twitch';
  return `You're signed in as ${who}. Signing in as Admin will sign you out of Twitch. Continue?`;
}

/**
 * Show a confirm() warning before a login that replaces the other identity.
 * Returns true if the user agreed to proceed (or no warning was needed).
 *
 * @param {string} message - the warning to show
 * @param {boolean} needed - whether a conflicting identity is currently active
 */
export function confirmSwitch(message, needed) {
  if (!needed) return true;
  // eslint-disable-next-line no-alert
  return window.confirm(message);
}
