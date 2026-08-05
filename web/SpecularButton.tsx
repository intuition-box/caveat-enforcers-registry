import {
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent,
} from "react";
import "./SpecularButton.css";

type SpecularButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> & {
  size?: "sm" | "md" | "lg";
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
};

type SpecularStyle = CSSProperties & {
  "--specular-x"?: string;
  "--specular-y"?: string;
  "--specular-radius"?: string;
  "--specular-tint"?: string;
  "--specular-tint-opacity"?: number;
  "--specular-blur"?: string;
  "--specular-text"?: string;
  "--specular-line"?: string;
  "--specular-base"?: string;
  "--specular-intensity"?: number;
  "--specular-size"?: string;
  "--specular-fade"?: string;
  "--specular-thickness"?: string;
  "--specular-speed"?: string;
};

export default function SpecularButton({
  size = "md",
  radius = 18,
  tint = "#ffffff",
  tintOpacity = 0.12,
  blur = 8,
  textColor = "#f5f5f5",
  lineColor = "#ffffff",
  baseColor = "#525252",
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  className,
  style,
  onPointerMove,
  onPointerLeave,
  children,
  ...buttonProps
}: SpecularButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (button && followMouse) {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const distance = Math.hypot(x - rect.width / 2, y - rect.height / 2);
      const influence = Math.max(0, 1 - distance / Math.max(proximity, 1));
      button.style.setProperty("--specular-x", `${x}px`);
      button.style.setProperty("--specular-y", `${y}px`);
      button.style.setProperty(
        "--specular-intensity",
        String(intensity * Math.max(0.12, influence)),
      );
    }
    onPointerMove?.(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    buttonRef.current?.style.setProperty(
      "--specular-intensity",
      String(intensity * 0.18),
    );
    onPointerLeave?.(event);
  };

  const mergedStyle: SpecularStyle = {
    ...style,
    "--specular-radius": `${radius}px`,
    "--specular-tint": tint,
    "--specular-tint-opacity": tintOpacity,
    "--specular-blur": `${blur}px`,
    "--specular-text": textColor,
    "--specular-line": lineColor,
    "--specular-base": baseColor,
    "--specular-intensity": intensity * 0.18,
    "--specular-size": `${shineSize}%`,
    "--specular-fade": `${shineFade}%`,
    "--specular-thickness": `${thickness}px`,
    "--specular-speed": `${speed}s`,
  };

  return (
    <button
      {...buttonProps}
      ref={buttonRef}
      className={["specular-button", `specular-button--${size}`, className]
        .filter(Boolean)
        .join(" ")}
      style={mergedStyle}
      data-follow-mouse={followMouse}
      data-auto-animate={autoAnimate}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <span className="specular-button__shine" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
}
