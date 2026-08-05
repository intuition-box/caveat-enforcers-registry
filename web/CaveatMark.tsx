/**
 * The Caveat mark as vector geometry.
 *
 * Traced from public/brand/caveat-mark.png with marching squares at the 0.5
 * isolevel, then simplified and fitted: every edge is a line except the single
 * swept curve on the lower plane, which is one cubic. Coordinates are
 * normalized so the mark's own bounding box starts at 0,0.
 */

export const MARK_W = 225.78;
export const MARK_H = 200.49;

export const MARK_PATHS = [
  "M171.95 0L172.4 67.84L35.95 127.37L34.95 151.3L0.46 142.84L0.04 75.84L0.95 73.97L171.95 0Z",
  "M225.37 46.84L225.54 98.84C149.65 146.27 134.05 200.58 35.95 200.17L35.95 151.56L172.29 91.84L172.47 68.84L172.95 68.2L225.37 46.84Z",
] as const;

/** Static mark, for the header, footer and anywhere outside the hero. */
export function CaveatMarkSvg({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${MARK_W} ${MARK_H}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
