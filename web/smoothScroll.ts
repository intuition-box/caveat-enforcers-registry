/**
 * A single Lenis instance for the whole page, shared so route changes can reset
 * the smoothed scroll position without desyncing Lenis' internal target.
 */
import type Lenis from "lenis";

let instance: Lenis | null = null;

export function setLenis(next: Lenis | null) {
  instance = next;
}

export function scrollToTop() {
  if (instance) {
    instance.scrollTo(0, { immediate: true });
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}
