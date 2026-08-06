import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./ScrollStack.css";

export type ScrollStackItemProps = {
  children: ReactNode;
  itemClassName?: string;
};

export function ScrollStackItem({
  children,
  itemClassName = "",
}: ScrollStackItemProps) {
  return (
    <div
      className={["scroll-stack-card", itemClassName].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

type ScrollStackProps = {
  children: ReactNode;
  className?: string;
  /** Gap between cards, in px. */
  itemDistance?: number;
  /** Sticky offset from the top of the viewport (any CSS length). */
  stackPosition?: string;
  useWindowScroll?: boolean;
  /** Accepted for API compatibility; the pure-CSS stack ignores these. */
  itemScale?: number;
  itemStackDistance?: number;
  scaleEndPosition?: string;
  baseScale?: number;
  rotationAmount?: number;
  blurAmount?: number;
  onStackComplete?: () => void;
};

/**
 * A sticky card stack, copied to the tee from Fora (fora.so): every card is
 * `position: sticky` at the *same* top offset, so each one slides up and covers
 * the previous. It is pure CSS — no per-frame JavaScript — which, paired with
 * the page's Lenis smooth-scroll, is what makes it feel premium. The only JS is
 * a one-time z-index pass so later cards paint over earlier ones.
 */
export default function ScrollStack({
  children,
  className = "",
  itemDistance = 48,
  stackPosition = "120px",
  useWindowScroll = false,
}: ScrollStackProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>(".scroll-stack-card");
    cards.forEach((card, index) => {
      card.style.zIndex = String(index + 1);
    });
  }, []);

  const style = {
    "--stack-top": stackPosition,
    "--stack-gap": `${itemDistance}px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={[
        "scroll-stack-scroller",
        useWindowScroll ? "scroll-stack-scroller--window" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <div className="scroll-stack-inner">{children}</div>
    </div>
  );
}
