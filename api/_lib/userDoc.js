// The fields every users/{twitchId} doc starts with. Pure (no firebase-admin)
// so it can be unit tested; `now` is the server timestamp sentinel.
//
// A user doc can exist before its owner ever logs in: a prediction settle
// credits winners' tickets with set+merge. Login fills in whatever is missing
// and never overwrites a field that's already there.
export function missingStarterFields(data, twitchId, now) {
  const starter = {
    twitchId,
    tickets: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
    createdAt: now,
  };
  const have = data || {};
  return Object.fromEntries(Object.entries(starter).filter(([key]) => !(key in have)));
}
