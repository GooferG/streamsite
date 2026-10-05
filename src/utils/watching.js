// "Inside the TV" (the watch dialog) is a history flag on the page, valid only
// while the channel is live. One rule for the couch and the home menu button.
export const isWatching = (location, live) => !!live && !!(location && location.state && location.state.watch);
