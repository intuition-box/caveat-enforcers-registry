/**
 * The hero's scroll progress, shared with the header.
 *
 * The nav is not revealed by an event — it is a pure function of how far
 * through the hero you are, so scrubbing back up unwinds the handoff exactly.
 */
type Listener = (progress: number) => void;

let current = 0;
const listeners = new Set<Listener>();

export function setHeroProgress(progress: number) {
  if (progress === current) return;
  current = progress;
  for (const listener of listeners) listener(progress);
}

export function subscribeHeroProgress(listener: Listener) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
