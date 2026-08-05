/**
 * A macOS-style browser window shell used to frame a visualization as a
 * polished product surface. Chrome only — the framed content is passed as
 * children.
 */
import type { ReactNode } from "react";

export default function BrowserFrame({
  title,
  label,
  tone = "ink",
  children,
}: {
  title: string;
  label?: string;
  tone?: "ink" | "paper";
  children: ReactNode;
}) {
  return (
    <figure className={`browser-frame browser-frame--${tone}`}>
      <div className="browser-frame__bar">
        <span className="browser-frame__lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-frame__title">{title}</span>
        {label ? (
          <span className="browser-frame__label">{label}</span>
        ) : (
          <span className="browser-frame__label" aria-hidden="true" />
        )}
      </div>
      <div className="browser-frame__body">{children}</div>
    </figure>
  );
}
