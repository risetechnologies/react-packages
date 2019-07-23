// When rendering on the server, we don't want to use the Tracker.
// We only do the first rendering on the server so we can get the data right away
export default (reactiveFn) => reactiveFn();
