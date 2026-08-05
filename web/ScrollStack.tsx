import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import Lenis from "lenis";
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
    <div className={["scroll-stack-card", itemClassName].filter(Boolean).join(" ")}>
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

type CardTransform = {
  translateY: number;
  scale: number;
  rotation: number;
  blur: number;
};

const clampProgress = (value: number, start: number, end: number) => {
  if (value < start) return 0;
  if (value > end) return 1;
  return (value - start) / (end - start);
};

const parsePosition = (value: string, containerHeight: number) => {
  if (value.includes("%")) return (parseFloat(value) / 100) * containerHeight;
  return parseFloat(value);
};

export default function ScrollStack({
  children,
  className = "",
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.85,
  scaleDuration = 0.5,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = false,
  onStackComplete,
}: ScrollStackProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const cardOffsetsRef = useRef<number[]>([]);
  const endOffsetRef = useRef(0);
  const lastTransformsRef = useRef(new Map<number, CardTransform>());
  const animationFrameRef = useRef<number | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const stackCompletedRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const onStackCompleteRef = useRef(onStackComplete);

  onStackCompleteRef.current = onStackComplete;

  const getScrollData = useCallback(() => {
    if (useWindowScroll) {
      return {
        scrollTop: window.scrollY,
        containerHeight: window.innerHeight,
      };
    }

    const scroller = scrollerRef.current;
    return {
      scrollTop: scroller?.scrollTop ?? 0,
      containerHeight: scroller?.clientHeight ?? 0,
    };
  }, [useWindowScroll]);

  const getElementOffset = useCallback(
    (element: HTMLElement) => {
      if (useWindowScroll) {
        return element.getBoundingClientRect().top + window.scrollY;
      }
      return element.offsetTop;
    },
    [useWindowScroll],
  );

  const cacheLayoutOffsets = useCallback(() => {
    cardOffsetsRef.current = cardsRef.current.map((card) =>
      getElementOffset(card),
    );
    const endElement = useWindowScroll
      ? document.querySelector<HTMLElement>(".scroll-stack-end")
      : scrollerRef.current?.querySelector<HTMLElement>(".scroll-stack-end");
    endOffsetRef.current = endElement ? getElementOffset(endElement) : 0;
  }, [getElementOffset, useWindowScroll]);

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current) return;

    isUpdatingRef.current = true;
    const { scrollTop, containerHeight } = getScrollData();
    const stackPositionPx = parsePosition(stackPosition, containerHeight);
    const scaleEndPositionPx = parsePosition(scaleEndPosition, containerHeight);
    const pinEnd = endOffsetRef.current - containerHeight / 2;

    let topCardIndex = 0;
    if (blurAmount) {
      cardsRef.current.forEach((card, index) => {
        const cardTop = cardOffsetsRef.current[index] ?? getElementOffset(card);
        const triggerStart = cardTop - stackPositionPx - itemStackDistance * index;
        if (scrollTop >= triggerStart) topCardIndex = index;
      });
    }

    cardsRef.current.forEach((card, index) => {
      const cardTop = cardOffsetsRef.current[index] ?? getElementOffset(card);
      const triggerStart = cardTop - stackPositionPx - itemStackDistance * index;
      const triggerEnd = cardTop - scaleEndPositionPx;
      const scaleProgress = clampProgress(scrollTop, triggerStart, triggerEnd);
      const targetScale = baseScale + index * itemScale;
      const scale = 1 - scaleProgress * (1 - targetScale);
      const rotation = rotationAmount
        ? index * rotationAmount * scaleProgress
        : 0;
      const depthInStack = Math.max(0, topCardIndex - index);
      const blur = blurAmount ? depthInStack * blurAmount : 0;
      const pinStart = triggerStart;
      const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd;
      const translateY = isPinned
        ? scrollTop - cardTop + stackPositionPx + itemStackDistance * index
        : scrollTop > pinEnd
          ? pinEnd - cardTop + stackPositionPx + itemStackDistance * index
          : 0;
      const nextTransform: CardTransform = {
        translateY: Math.round(translateY * 100) / 100,
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
      };
      const previous = lastTransformsRef.current.get(index);
      const changed =
        !previous ||
        Math.abs(previous.translateY - nextTransform.translateY) > 0.1 ||
        Math.abs(previous.scale - nextTransform.scale) > 0.001 ||
        Math.abs(previous.rotation - nextTransform.rotation) > 0.1 ||
        Math.abs(previous.blur - nextTransform.blur) > 0.1;

      if (changed) {
        card.style.transform = `translate3d(0, ${nextTransform.translateY}px, 0) scale(${nextTransform.scale}) rotate(${nextTransform.rotation}deg)`;
        card.style.filter = nextTransform.blur ? `blur(${nextTransform.blur}px)` : "";
        lastTransformsRef.current.set(index, nextTransform);
      }

      if (index === cardsRef.current.length - 1) {
        const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true;
          onStackCompleteRef.current?.();
        } else if (!isInView && stackCompletedRef.current) {
          stackCompletedRef.current = false;
        }
      }
    });

    isUpdatingRef.current = false;
  }, [
    baseScale,
    blurAmount,
    getElementOffset,
    getScrollData,
    itemScale,
    itemStackDistance,
    rotationAmount,
    scaleEndPosition,
    stackPosition,
    useWindowScroll,
  ]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    const cards = Array.from(
      useWindowScroll
        ? document.querySelectorAll<HTMLDivElement>(".scroll-stack-card")
        : scroller.querySelectorAll<HTMLDivElement>(".scroll-stack-card"),
    );
    cardsRef.current = cards;
    lastTransformsRef.current.clear();
    cardOffsetsRef.current = [];

    const resetCards = () => {
      cards.forEach((card) => {
        card.style.transform = "translate3d(0, 0, 0) scale(1) rotate(0deg)";
        card.style.filter = "";
      });
      lastTransformsRef.current.clear();
    };

    cards.forEach((card, index) => {
      if (index < cards.length - 1) card.style.marginBottom = `${itemDistance}px`;
      card.style.willChange = "transform, filter";
      card.style.transformOrigin = "top center";
      card.style.backfaceVisibility = "hidden";
      card.style.transform = "translate3d(0, 0, 0) scale(1) rotate(0deg)";
      card.style.webkitTransform = "translate3d(0, 0, 0) scale(1) rotate(0deg)";
      card.style.perspective = "1000px";
      card.style.webkitPerspective = "1000px";
    });

    const refreshLayout = () => {
      resetCards();
      cacheLayoutOffsets();
      updateCardTransforms();
    };

    refreshLayout();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      return () => {
        cardsRef.current = [];
        lastTransformsRef.current.clear();
      };
    }

    const handleScroll = () => updateCardTransforms();
    const handleResize = () => refreshLayout();
    const scrollTarget = useWindowScroll ? window : scroller;
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    const layoutObserver = new ResizeObserver(refreshLayout);
    layoutObserver.observe(document.body);
    let layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = window.requestAnimationFrame(refreshLayout);
    });

    let lenis: Lenis | undefined;
    if (!useWindowScroll) {
      lenis = new Lenis({
        duration: 1.2,
        easing: (time: number) => Math.min(1, 1.001 - 2 ** (-10 * time)),
        smoothWheel: true,
        touchMultiplier: 2,
        infinite: false,
        wheelMultiplier: 1,
        lerp: 0.1,
        syncTouch: true,
        syncTouchLerp: 0.075,
      });
    }

    if (lenis) {
      lenis.on("scroll", handleScroll);
      lenisRef.current = lenis;
      const raf = (time: number) => {
        lenis?.raf(time);
        animationFrameRef.current = window.requestAnimationFrame(raf);
      };
      animationFrameRef.current = window.requestAnimationFrame(raf);
    }

    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      layoutObserver.disconnect();
      window.cancelAnimationFrame(layoutFrame);
      lenis?.destroy();
      lenisRef.current = null;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      stackCompletedRef.current = false;
      cardsRef.current = [];
      cardOffsetsRef.current = [];
      endOffsetRef.current = 0;
      lastTransformsRef.current.clear();
      isUpdatingRef.current = false;
    };
  }, [itemDistance, scaleDuration, updateCardTransforms, useWindowScroll]);

  return (
    <div
      className={[
        "scroll-stack-scroller",
        useWindowScroll ? "scroll-stack-scroller--window" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      ref={scrollerRef}
    >
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" />
      </div>
    </div>
  );
}
