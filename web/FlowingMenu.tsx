import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import "./FlowingMenu.css";

export type FlowingMenuItem = {
  link: string;
  text: string;
  description?: string;
  image?: string;
};

type FlowingMenuProps = {
  items?: FlowingMenuItem[];
  speed?: number;
  textColor?: string;
  bgColor?: string;
  marqueeBgColor?: string;
  marqueeTextColor?: string;
  borderColor?: string;
};

export default function FlowingMenu({
  items = [],
  speed = 15,
  textColor = "#ffffff",
  bgColor = "#120f17",
  marqueeBgColor = "#ffffff",
  marqueeTextColor = "#120f17",
  borderColor = "#ffffff",
}: FlowingMenuProps) {
  return (
    <div className="menu-wrap" style={{ backgroundColor: bgColor }}>
      <nav className="menu" aria-label="Caveat anatomy">
        {items.map((item) => (
          <MenuItem
            key={item.text}
            {...item}
            speed={speed}
            textColor={textColor}
            marqueeBgColor={marqueeBgColor}
            marqueeTextColor={marqueeTextColor}
            borderColor={borderColor}
          />
        ))}
      </nav>
    </div>
  );
}

type MenuItemProps = FlowingMenuItem & {
  speed: number;
  textColor: string;
  marqueeBgColor: string;
  marqueeTextColor: string;
  borderColor: string;
};

function MenuItem({
  link,
  text,
  description,
  image = "/brand/caveat-mark.png",
  speed,
  textColor,
  marqueeBgColor,
  marqueeTextColor,
  borderColor,
}: MenuItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const marqueeInnerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<gsap.core.Tween | null>(null);
  const hoverTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const [repetitions, setRepetitions] = useState(4);

  const animationDefaults = { duration: 0.6, ease: "expo.out" };

  const distMetric = (x: number, y: number, x2: number, y2: number) => {
    const xDiff = x - x2;
    const yDiff = y - y2;
    return xDiff * xDiff + yDiff * yDiff;
  };

  const findClosestEdge = (
    mouseX: number,
    mouseY: number,
    width: number,
    height: number,
  ) => {
    const top = distMetric(mouseX, mouseY, width / 2, 0);
    const bottom = distMetric(mouseX, mouseY, width / 2, height);
    return top < bottom ? "top" : "bottom";
  };

  useEffect(() => {
    const calculateRepetitions = () => {
      const content = marqueeInnerRef.current?.querySelector(
        ".marquee__part",
      ) as HTMLElement | null;
      if (!content) return;
      const width = content.offsetWidth;
      if (!width) return;
      setRepetitions(Math.max(4, Math.ceil(window.innerWidth / width) + 2));
    };

    calculateRepetitions();
    window.addEventListener("resize", calculateRepetitions);
    return () => window.removeEventListener("resize", calculateRepetitions);
  }, [text, description, image]);

  useEffect(() => {
    const setupMarquee = () => {
      const content = marqueeInnerRef.current?.querySelector(
        ".marquee__part",
      ) as HTMLElement | null;
      if (!content || !marqueeInnerRef.current || !content.offsetWidth) return;

      animationRef.current?.kill();
      animationRef.current = gsap.to(marqueeInnerRef.current, {
        x: -content.offsetWidth,
        duration: speed,
        ease: "none",
        repeat: -1,
      });
    };

    const timer = window.setTimeout(setupMarquee, 50);
    return () => {
      window.clearTimeout(timer);
      animationRef.current?.kill();
      hoverTimelineRef.current?.kill();
    };
  }, [text, description, image, repetitions, speed]);

  const handleMouseEnter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const item = itemRef.current;
    const marquee = marqueeRef.current;
    const inner = marqueeInnerRef.current;
    if (!item || !marquee || !inner) return;
    const rect = item.getBoundingClientRect();
    const edge = findClosestEdge(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    );
    hoverTimelineRef.current?.kill();
    hoverTimelineRef.current = gsap
      .timeline({ defaults: animationDefaults })
      .set(marquee, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .set(inner, { y: edge === "top" ? "101%" : "-101%" }, 0)
      .to([marquee, inner], { y: "0%" }, 0);
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const item = itemRef.current;
    const marquee = marqueeRef.current;
    const inner = marqueeInnerRef.current;
    if (!item || !marquee || !inner) return;
    const rect = item.getBoundingClientRect();
    const edge = findClosestEdge(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    );
    hoverTimelineRef.current?.kill();
    hoverTimelineRef.current = gsap
      .timeline({ defaults: animationDefaults })
      .to(marquee, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .to(inner, { y: edge === "top" ? "101%" : "-101%" }, 0);
  };

  return (
    <div className="menu__item" ref={itemRef} style={{ borderColor }}>
      <a
        className="menu__item-link"
        href={link}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ color: textColor }}
        aria-label={description ? `${text}. ${description}` : text}
      >
        <span>{text}</span>
        {description && <small>{description}</small>}
      </a>
      <div
        className="marquee"
        ref={marqueeRef}
        style={{ backgroundColor: marqueeBgColor }}
        aria-hidden="true"
      >
        <div className="marquee__inner-wrap">
          <div className="marquee__inner" ref={marqueeInnerRef}>
            {[...Array(repetitions)].map((_, index) => (
              <div
                className="marquee__part"
                key={index}
                style={{ color: marqueeTextColor }}
              >
                <span>{text}</span>
                {description && <small>{description}</small>}
                <div
                  className="marquee__img"
                  style={{ backgroundImage: `url(${image})` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
