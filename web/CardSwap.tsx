import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  MouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import { gsap } from "gsap";
import "./CardSwap.css";

type Dimension = number | string;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  customClass?: string;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { customClass, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={["card", customClass, className].filter(Boolean).join(" ")}
    />
  );
});

Card.displayName = "Card";

type Slot = {
  x: number;
  y: number;
  z: number;
  zIndex: number;
};

function makeSlot(
  index: number,
  distanceX: number,
  distanceY: number,
  total: number,
): Slot {
  return {
    x: index * distanceX,
    y: -index * distanceY,
    z: -index * distanceX * 1.5,
    zIndex: total - index,
  };
}

function placeNow(element: HTMLDivElement, slot: Slot, skew: number) {
  gsap.set(element, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: "center center",
    zIndex: slot.zIndex,
    force3D: true,
  });
}

export type CardSwapProps = {
  width?: Dimension;
  height?: Dimension;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  onActiveChange?: (index: number) => void;
  onCardClick?: (index: number) => void;
  skewAmount?: number;
  easing?: "linear" | "elastic";
  children: ReactNode;
};

export default function CardSwap({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onActiveChange,
  onCardClick,
  skewAmount = 6,
  easing = "elastic",
  children,
}: CardSwapProps) {
  const childArr = useMemo(() => Children.toArray(children), [children]);
  const refs = useMemo(
    () => childArr.map(() => ({ current: null as HTMLDivElement | null })),
    [childArr.length],
  );
  const order = useRef(
    Array.from({ length: childArr.length }, (_, index) => index),
  );
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const interval = useRef<number | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const activeChange = useRef(onActiveChange);
  const cardClick = useRef(onCardClick);

  activeChange.current = onActiveChange;
  cardClick.current = onCardClick;

  useEffect(() => {
    const elements = refs
      .map((ref) => ref.current)
      .filter(Boolean) as HTMLDivElement[];
    const total = elements.length;
    if (total === 0) return undefined;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const motion =
      easing === "elastic"
        ? {
            ease: "elastic.out(0.6,0.9)",
            durDrop: 1.5,
            durMove: 1.5,
            durReturn: 1.5,
            promoteOverlap: 0.9,
            returnDelay: 0.05,
          }
        : {
            ease: "power1.inOut",
            durDrop: 0.8,
            durMove: 0.8,
            durReturn: 0.8,
            promoteOverlap: 0.45,
            returnDelay: 0.2,
          };

    elements.forEach((element, index) => {
      placeNow(
        element,
        makeSlot(index, cardDistance, verticalDistance, total),
        skewAmount,
      );
    });
    activeChange.current?.(order.current[0] ?? 0);

    if (reducedMotion || total < 2) {
      return () => {
        timeline.current?.kill();
      };
    }

    const swap = () => {
      if (order.current.length < 2) return;

      const [front, ...rest] = order.current;
      const frontElement = refs[front].current;
      if (!frontElement) return;

      const nextTimeline = gsap.timeline();
      timeline.current = nextTimeline;

      nextTimeline.to(frontElement, {
        y: "+=500",
        duration: motion.durDrop,
        ease: motion.ease,
      });
      nextTimeline.addLabel(
        "promote",
        `-=${motion.durDrop * motion.promoteOverlap}`,
      );

      rest.forEach((index, restIndex) => {
        const element = refs[index].current;
        if (!element) return;
        const slot = makeSlot(restIndex, cardDistance, verticalDistance, total);
        nextTimeline.set(element, { zIndex: slot.zIndex }, "promote");
        nextTimeline.to(
          element,
          {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            duration: motion.durMove,
            ease: motion.ease,
          },
          `promote+=${restIndex * 0.15}`,
        );
      });

      const backSlot = makeSlot(
        total - 1,
        cardDistance,
        verticalDistance,
        total,
      );
      nextTimeline.addLabel(
        "return",
        `promote+=${motion.durMove * motion.returnDelay}`,
      );
      nextTimeline.call(
        () => {
          gsap.set(frontElement, { zIndex: backSlot.zIndex });
          order.current = [...rest, front];
          activeChange.current?.(order.current[0] ?? 0);
        },
        undefined,
        "return",
      );
      nextTimeline.to(
        frontElement,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          duration: motion.durReturn,
          ease: motion.ease,
        },
        "return",
      );
    };

    const startInterval = () => {
      if (interval.current !== null) window.clearInterval(interval.current);
      interval.current = window.setInterval(swap, delay);
    };

    startInterval();

    const node = container.current;
    const pause = () => {
      timeline.current?.pause();
      if (interval.current !== null) window.clearInterval(interval.current);
    };
    const resume = () => {
      timeline.current?.play();
      startInterval();
    };

    if (pauseOnHover && node) {
      node.addEventListener("mouseenter", pause);
      node.addEventListener("mouseleave", resume);
    }

    return () => {
      if (pauseOnHover && node) {
        node.removeEventListener("mouseenter", pause);
        node.removeEventListener("mouseleave", resume);
      }
      if (interval.current !== null) window.clearInterval(interval.current);
      timeline.current?.kill();
    };
  }, [
    cardDistance,
    delay,
    easing,
    pauseOnHover,
    refs,
    skewAmount,
    verticalDistance,
  ]);

  const rendered = childArr.map((child, index) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<CardProps>;
    const style = (element.props.style ?? {}) as CSSProperties;

    return cloneElement(element, {
      key: index,
      ref: refs[index],
      style: { width, height, ...style },
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        element.props.onClick?.(event);
        cardClick.current?.(index);
      },
    } as never);
  });

  return (
    <div
      ref={container}
      className="card-swap-container"
      style={{ width, height }}
    >
      {rendered}
    </div>
  );
}
