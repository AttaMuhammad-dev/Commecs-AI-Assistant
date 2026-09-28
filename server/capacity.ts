// Keep bursts from exhausting a free-tier project. This limit is process-local.
let inFlight = 0;
export function acquireCapacity(): (() => void) | null {
  if (inFlight >= 3) return null;
  inFlight++;
  let released = false;
  return () => { if (!released) { inFlight--; released = true; } };
}
