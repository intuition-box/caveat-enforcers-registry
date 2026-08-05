type IntuitionLogoProps = {
  className?: string;
  size?: number;
  title?: string;
};

/** Traced as a small, scalable lockup from the supplied Intuition mark. */
export default function IntuitionLogo({
  className,
  size = 18,
  title,
}: IntuitionLogoProps) {
  const labelled = Boolean(title);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <circle
        cx="200"
        cy="200"
        r="111"
        stroke="currentColor"
        strokeWidth="18"
        strokeDasharray="643 55"
        strokeDashoffset="22"
        transform="rotate(-35 200 200)"
      />
      <circle
        cx="200"
        cy="200"
        r="142"
        stroke="currentColor"
        strokeWidth="14"
        strokeDasharray="210 30 116 30 220 30"
        strokeDashoffset="-18"
        transform="rotate(-35 200 200)"
      />
    </svg>
  );
}
