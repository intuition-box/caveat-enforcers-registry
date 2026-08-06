import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
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
  itemDistance?: number;
  itemScale?: number;
  itemStackDistance?: number;
  stackPosition?: string;
  scaleEndPosition?: string;
  baseScale?: number;
  scaleDuration?: number;
  rotationAmount?: number;
  blurAmount?: number;
  useWindowScroll?: boolean;
  onStackComplete?: () => void;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

const parsePosition = (value: string, containerHeight: number) =>
  value.includes("%")
    ? (parseFloat(value) / 100) * containerHeight
    : parseFloat(value);

/**
 * Card stack pinned with native `position: sticky` — the browser owns the pin,
 * so it stays glued to the scroll with zero lag. JS only writes a `scale()` as
 * each card is covered by the next; scale is a paint-time effect that tolerates
 * a frame of latency, so there is no positional jitter. This replaces the old
 * per-frame `translateY` pinning, which always trailed native scroll by a frame
 * and was the real source of the stutter.
 */
export default function ScrollStack({
  children,
  className = "",
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.85,
  useWindowScroll = false,
  onStackComplete,
}: ScrollStackProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tickingRef = useRef(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onStackComplete);
  onCompleteRef.current = onStackComplete;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const cards = Array.from(
      root.querySelectorAll<HTMLElement>(".scroll-stack-card"),
    );
    if (!cards.length) return undefined;

    // Native sticky pinning: each card sticks a little lower than the previous,
    // forming the stack. No per-frame position writes.
    cards.forEach((card, index) => {
      card.style.position = "sticky";
      card.style.top = `calc(${stackPosition} + ${index * itemStackDistance}px)`;
      card.style.zIndex = String(index + 1);
      card.style.transformOrigin = "top center";
      card.style.willChange = "transform";
      card.style.marginBottom =
        index < cards.length - 1 ? `${itemDistance}px` : "";
    });

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      return () => {
        cards.forEach((card) => {
          card.style.transform = "";
          card.style.position = "";
          card.style.top = "";
        });
      };
    }

    const update = () => {
      tickingRef.current = false;
      const viewport = window.innerHeight;
      const stackTop = parsePosition(stackPosition, viewport);
      const endTop = parsePosition(scaleEndPosition, viewport);

      cards.forEach((card, index) => {
        const next = cards[index + 1];
        const target = baseScale + index * itemScale;
        let progress = 0;
        if (next) {
          // As the next card rises to cover this one, recede this card from
          // scale 1 down to its target.
          const from = stackTop + card.offsetHeight * 0.85;
          const to = stackTop + index * itemStackDistance + endTop;
          const nextTop = next.getBoundingClientRect().top;
          progress = clamp01((from - nextTop) / Math.max(1, from - to));
        }
        const scale = 1 - progress * (1 - target);
        card.style.transform = `scale(${Math.round(scale * 1000) / 1000})`;
      });

      const last = cards[cards.length - 1];
      const pinnedTop = stackTop + (cards.length - 1) * itemStackDistance;
      const isSettled = last.getBoundingClientRect().top <= pinnedTop + 1;
      if (isSettled && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      } else if (!isSettled && completedRef.current) {
        completedRef.current = false;
      }
    };

    const schedule = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(update);
    };

    update();
    const scrollTarget: Window | HTMLElement = useWindowScroll ? window : root;
    scrollTarget.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      scrollTarget.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cards.forEach((card) => {
        card.style.transform = "";
        card.style.position = "";
        card.style.top = "";
        card.style.zIndex = "";
        card.style.marginBottom = "";
        card.style.willChange = "";
      });
      completedRef.current = false;
    };
  }, [
    itemDistance,
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    useWindowScroll,
  ]);

  return (
    <div
      className={[
        "scroll-stack-scroller",
        useWindowScroll ? "scroll-stack-scroller--window" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      ref={rootRef}
    >
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" />
      </div>
    </div>
  );
}
