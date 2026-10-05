// Logs the camera's covers as they reach the DOM: 'camera-static' when the
// static mounts, 'camera-iris:<phase>' when the iris mounts or changes phase.
// A move with zeroed timings can mount and remove a cover between two
// assertions, so a test asks the log which cut a move used. Run the move
// outside act (act holds every render until it ends) and call stop() last.
const IDS = ['camera-static', 'camera-iris'];

export function logCovers() {
  const log = [];
  const note = (el) => {
    const id = el.getAttribute('data-testid');
    if (!IDS.includes(id)) return;
    const phase = el.getAttribute('data-phase');
    log.push(phase ? `${id}:${phase}` : id);
  };
  const read = (records) =>
    records.forEach((r) => {
      if (r.type === 'attributes') {
        note(r.target);
        return;
      }
      r.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        note(node);
        node.querySelectorAll('[data-testid]').forEach(note);
      });
    });
  const observer = new MutationObserver(read);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-phase'] });
  return {
    log,
    // The covers seen, each once: ['camera-iris'], ['camera-static'], …
    cuts: () => [...new Set(log.map((entry) => entry.split(':')[0]))],
    stop() {
      read(observer.takeRecords());
      observer.disconnect();
    },
  };
}
