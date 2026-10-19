// One run only: reuse its last accepted snapshot while changing project rooms.
// The network remains authoritative; this never survives a reload or crosses runs.
let snapshot = null;
export const cachedCommons = (runId) =>
  snapshot?.runId === runId ? snapshot : null;
export function retainCommons(next) {
  if (
    next &&
    (next.runId !== snapshot?.runId || next.version >= snapshot.version)
  )
    snapshot = next;
}
