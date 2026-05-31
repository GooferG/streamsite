import { isViewerSession } from '../authSwitch';

describe('isViewerSession', () => {
  it('false when no one is signed in', () => {
    expect(isViewerSession(null, null)).toBe(false);
    expect(isViewerSession(null, { twitchId: '123' })).toBe(false);
  });

  it('false when the signed-in user is an admin (has email)', () => {
    const admin = { uid: 'abc', email: 'luimeneghim@gmail.com' };
    expect(isViewerSession(admin, { twitchId: '123' })).toBe(false);
  });

  it('false when a viewer is signed in but no stored twitch profile', () => {
    const viewer = { uid: '123', email: null };
    expect(isViewerSession(viewer, null)).toBe(false);
  });

  it('false when stored twitch id does not match the signed-in uid', () => {
    const viewer = { uid: '123', email: null };
    expect(isViewerSession(viewer, { twitchId: '999' })).toBe(false);
  });

  it('true when a viewer is signed in and the stored id matches', () => {
    const viewer = { uid: '123', email: null };
    expect(isViewerSession(viewer, { twitchId: '123' })).toBe(true);
  });

  it('treats empty-string email as no email (viewer)', () => {
    const viewer = { uid: '123', email: '' };
    expect(isViewerSession(viewer, { twitchId: '123' })).toBe(true);
  });
});
