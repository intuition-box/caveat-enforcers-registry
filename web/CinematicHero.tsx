/**
 * The opening of the site.
 *
 * The mark strokes itself in against pure black, fills, and the offer settles
 * beneath it. On scroll the section pins and the mark comes apart: its two
 * planes slide along the axis perpendicular to their shared fold, exposing the
 * thickness that was always implied and proving the flat sheet was a solid.
 * Rules hold tension across the gap — a caveat is the rule between two parties,
 * not the absence of one. The upper plane then lifts into the header and the
 * lower plane becomes the paper of the next section, its leading edge cut at
 * the mark's own fold angle.
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MARK_H, MARK_PATHS, MARK_W } from "./CaveatMark";
import { setHeroProgress } from "./heroProgress";

gsap.registerPlugin(ScrollTrigger);

const INTRO_KEY = "caveat:hero-intro-played";

/**
 * The mark's own fold: both planes run parallel at this pitch. The separation
 * axis, the exposed thickness and the paper wipe all inherit it, so nothing
 * about the motion is an arbitrary angle.
 */
const FOLD_DEG = 23.6;
const FOLD = (FOLD_DEG * Math.PI) / 180;
const UX = Math.cos(-FOLD);
const UY = Math.sin(-FOLD);
// Perpendicular to the fold — the axis the planes separate along.
const NX = -UY;
const NY = UX;

/** The two edges that face each other across the gap. Both run right to left. */
const EDGE_UPPER = [
  { x: 172.4, y: 67.84 },
  { x: 35.95, y: 127.37 },
];
const EDGE_LOWER = [
  { x: 172.29, y: 91.84 },
  { x: 35.95, y: 151.56 },
];

const TETHERS = 7;

/** Midpoint of the lower plane's upper edge — the pivot the paper opens from. */
const ANCHOR = {
  x: (EDGE_LOWER[0].x + EDGE_LOWER[1].x) / 2,
  y: (EDGE_LOWER[0].y + EDGE_LOWER[1].y) / 2,
};

type Placement = { cx: number; cy: number; s: number };

const seg = (p: number, a: number, b: number) =>
  gsap.utils.clamp(0, 1, (p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function CinematicHero() {
  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const upperRef = useRef<SVGGElement | null>(null);
  const lowerRef = useRef<SVGGElement | null>(null);
  const upperFillRef = useRef<SVGPathElement | null>(null);
  const lowerFillRef = useRef<SVGPathElement | null>(null);
  const strokeRef = useRef<SVGGElement | null>(null);
  const gapRef = useRef<SVGGElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const footRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const upper = upperRef.current;
    const lower = lowerRef.current;
    const stroke = strokeRef.current;
    const gap = gapRef.current;
    const intro = introRef.current;
    const foot = footRef.current;
    const actions = actionsRef.current;
    if (
      !root ||
      !stage ||
      !canvas ||
      !upper ||
      !lower ||
      !stroke ||
      !gap ||
      !intro ||
      !foot ||
      !actions
    ) {
      return;
    }

    const reduced = prefersReducedMotion();
    const ctx = canvas.getContext("2d");
    const pathUpper = new Path2D(MARK_PATHS[0]);
    const pathLower = new Path2D(MARK_PATHS[1]);

    const tetherLines = Array.from(
      gap.querySelectorAll<SVGLineElement>("line.cine__tether"),
    );
    const tickLines = Array.from(
      gap.querySelectorAll<SVGLineElement>("line.cine__tick"),
    );
    const gapLabel = gap.querySelector<SVGGElement>("g.cine__label");
    const gapLabelText = gap.querySelector<SVGTextElement>("text");
    const gapLabelPlate = gap.querySelector<SVGRectElement>("rect");

    /** A bay in the rules so the label is never struck through. */
    const fitLabelPlate = () => {
      if (!gapLabelText || !gapLabelPlate) return;
      try {
        const b = gapLabelText.getBBox();
        gapLabelPlate.setAttribute("x", String(b.x - 12));
        gapLabelPlate.setAttribute("y", String(b.y - 5));
        gapLabelPlate.setAttribute("width", String(b.width + 24));
        gapLabelPlate.setAttribute("height", String(b.height + 10));
      } catch {
        /* not measurable yet; retried after fonts settle */
      }
    };

    // ---- geometry -------------------------------------------------------
    let scaleFrom = 1;
    let scaleTo = 1;
    let centerX = 0;
    let centerYFrom = 0;
    let centerYTo = 0;
    let maxSep = 0;
    let maxDepth = 0;
    // Below this the channel is narrower than the pair, so they stay in the lower field
    let actionsInGap = true;
    let slot: Placement = { cx: 0, cy: 0, s: 0.14 };

    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const fit = (hFrac: number, wFrac: number) =>
        Math.min((vh * hFrac) / MARK_H, (vw * wFrac) / MARK_W);
      scaleFrom = fit(0.26, 0.5);
      // Sized so the parted planes still clear the foot of the section.
      scaleTo = fit(0.62, 0.86);
      centerX = vw / 2;
      centerYFrom = vh * 0.43;
      centerYTo = vh * 0.44;
      maxSep = Math.min(vh * 0.115, vw * 0.115);
      maxDepth = Math.max(10, Math.min(vh, vw) * 0.026);
      actionsInGap = vw >= 640;

      // Where the upper plane is headed: the header's own brand slot. Measured
      // rather than guessed, because the slot shifts when the display face loads.
      const brand = document.querySelector<HTMLElement>(
        ".site-header .brand-mark",
      );
      if (brand) {
        const r = brand.getBoundingClientRect();
        slot = {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          s: r.width / MARK_W,
        };
      }
    };

    const place = (g: SVGGElement, p: Placement) => {
      g.setAttribute(
        "transform",
        `translate(${p.cx} ${p.cy}) scale(${p.s}) translate(${-MARK_W / 2} ${-MARK_H / 2})`,
      );
    };

    const project = (pt: { x: number; y: number }, p: Placement) => ({
      x: p.cx + (pt.x - MARK_W / 2) * p.s,
      y: p.cy + (pt.y - MARK_H / 2) * p.s,
    });

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      return dpr;
    };

    let dpr = sizeCanvas();

    /** The exposed side faces, stepped so the band reads as solid material. */
    const paintThickness = (
      upperAt: Placement,
      lowerAt: Placement,
      depth: number,
    ) => {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (depth < 0.6) return;

      const steps = Math.max(3, Math.round(depth));
      const faces: Array<[Placement, Path2D, number]> = [
        [upperAt, pathUpper, 1],
        [lowerAt, pathLower, -1],
      ];

      for (const [at, path, dir] of faces) {
        for (let k = steps; k >= 1; k--) {
          const t = k / steps;
          const d = depth * t;
          ctx.save();
          ctx.translate(at.cx + NX * d * dir, at.cy + NY * d * dir);
          ctx.scale(at.s, at.s);
          ctx.translate(-MARK_W / 2, -MARK_H / 2);
          const shade = Math.round(mix(58, 12, t));
          ctx.fillStyle = `rgb(${shade},${Math.round(shade * 0.95)},${Math.round(shade * 0.86)})`;
          ctx.fill(path);
          ctx.restore();
        }
      }
    };

    /** Rules spanning the gap: the separation is governed, not empty. */
    const paintGap = (
      upperAt: Placement,
      lowerAt: Placement,
      strength: number,
    ) => {
      gap.style.opacity = String(strength);
      if (strength <= 0.001) return;

      for (let i = 0; i < TETHERS; i++) {
        const t = (i + 0.5) / TETHERS;
        const a = project(
          {
            x: mix(EDGE_UPPER[0].x, EDGE_UPPER[1].x, t),
            y: mix(EDGE_UPPER[0].y, EDGE_UPPER[1].y, t),
          },
          upperAt,
        );
        const b = project(
          {
            x: mix(EDGE_LOWER[0].x, EDGE_LOWER[1].x, t),
            y: mix(EDGE_LOWER[0].y, EDGE_LOWER[1].y, t),
          },
          lowerAt,
        );
        const line = tetherLines[i];
        if (line) {
          line.setAttribute("x1", a.x.toFixed(1));
          line.setAttribute("y1", a.y.toFixed(1));
          line.setAttribute("x2", b.x.toFixed(1));
          line.setAttribute("y2", b.y.toFixed(1));
        }
        const tick = tickLines[i];
        if (tick) {
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          tick.setAttribute("x1", (mx - UX * 5).toFixed(1));
          tick.setAttribute("y1", (my - UY * 5).toFixed(1));
          tick.setAttribute("x2", (mx + UX * 5).toFixed(1));
          tick.setAttribute("y2", (my + UY * 5).toFixed(1));
        }
      }

      // The label annotates from the left end; the actions hold the centre.
      if (gapLabel) {
        const t = 0.88;
        const a = project(
          {
            x: mix(EDGE_UPPER[0].x, EDGE_UPPER[1].x, t),
            y: mix(EDGE_UPPER[0].y, EDGE_UPPER[1].y, t),
          },
          upperAt,
        );
        const b = project(
          {
            x: mix(EDGE_LOWER[0].x, EDGE_LOWER[1].x, t),
            y: mix(EDGE_LOWER[0].y, EDGE_LOWER[1].y, t),
          },
          lowerAt,
        );
        gapLabel.setAttribute(
          "transform",
          `translate(${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)}) rotate(${-FOLD_DEG})`,
        );
      }
    };

    /** The two actions, carried in the opening the mark makes for them. */
    const placeActions = (
      upperAt: Placement,
      lowerAt: Placement,
      strength: number,
    ) => {
      let cx: number;
      let cy: number;
      if (actionsInGap) {
        const ua = project(EDGE_UPPER[0], upperAt);
        const ub = project(EDGE_UPPER[1], upperAt);
        const la = project(EDGE_LOWER[0], lowerAt);
        const lb = project(EDGE_LOWER[1], lowerAt);
        cx = (ua.x + ub.x + la.x + lb.x) / 4;
        cy = (ua.y + ub.y + la.y + lb.y) / 4;
      } else {
        // Narrow screens: the channel cannot hold the pair, so it sits below.
        cx = window.innerWidth / 2;
        cy = window.innerHeight * 0.82;
      }
      actions.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(-50%, -50%)`;
      actions.style.opacity = String(strength);
      actions.style.visibility = strength > 0.02 ? "visible" : "hidden";
      actions.classList.toggle("is-live", strength > 0.85);
    };

    /**
     * The lower plane does not hand off to a wipe — it *is* the wipe. Anchored
     * on its own upper edge and scaled up, that edge stays at the fold angle
     * and sweeps the frame, so the paper you land on is the plane itself.
     */
    const flood = (at: Placement, t: number): Placement => {
      if (t <= 0.001) return at;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const held = project(ANCHOR, at);
      // High enough that the edge clears the top-left corner of the frame.
      const targetY = -(Math.tan(FOLD) * held.x) - 80;
      const bigS = mix(at.s, Math.max(vw, vh) / 30, t);
      const y = mix(held.y, targetY, t);
      return {
        s: bigS,
        cx: held.x - (ANCHOR.x - MARK_W / 2) * bigS,
        cy: y - (ANCHOR.y - MARK_H / 2) * bigS,
      };
    };

    const frame = (progress: number) => {
      const p = progress;
      setHeroProgress(p);

      const grow = smooth(seg(p, 0, 0.62));
      const split = smooth(seg(p, 0.15, 0.46));
      const flight = smooth(seg(p, 0.66, 0.85));
      const floodT = smooth(seg(p, 0.855, 0.97));

      const s = mix(scaleFrom, scaleTo, grow);
      const cy = mix(centerYFrom, centerYTo, grow);
      const sep = maxSep * split;

      const held: Placement = { cx: centerX, cy, s };
      const upperAt: Placement = {
        cx: held.cx - NX * sep,
        cy: held.cy - NY * sep,
        s,
      };
      let lowerAt: Placement = {
        cx: held.cx + NX * sep,
        cy: held.cy + NY * sep,
        s,
      };

      // The upper plane leaves for the header.
      if (flight > 0) {
        upperAt.cx = mix(upperAt.cx, slot.cx, flight);
        upperAt.cy = mix(upperAt.cy, slot.cy, flight);
        upperAt.s = mix(upperAt.s, slot.s, flight);
      }

      // Thickness swells with the split and collapses as the planes leave.
      const depth = maxDepth * split * (1 - smooth(seg(p, 0.58, 0.72)));
      paintThickness(upperAt, lowerAt, depth);
      const gapOpen = seg(p, 0.16, 0.34) * (1 - smooth(seg(p, 0.56, 0.68)));
      paintGap(upperAt, lowerAt, gapOpen);
      placeActions(
        upperAt,
        lowerAt,
        seg(p, 0.26, 0.42) * (1 - smooth(seg(p, 0.54, 0.64))),
      );

      lowerAt = flood(lowerAt, floodT);

      place(upper, upperAt);
      place(lower, lowerAt);
      place(stroke, held);

      // The plane lands on black, then the header takes the mark from it.
      gsap.set(upper, { opacity: 1 - seg(p, 0.85, 0.862) });

      // While the intro is still running it owns the offer's opacity.
      if (introDone) {
        gsap.set(intro, {
          opacity: 1 - seg(p, 0, 0.14),
          y: seg(p, 0, 0.14) * 26,
        });
      }

      const footIn = seg(p, 0.3, 0.44);
      const footOut = seg(p, 0.66, 0.76);
      gsap.set(foot, {
        opacity: footIn * (1 - footOut),
        y: 26 - footIn * 26 - footOut * 18,
      });
    };

    measure();
    fitLabelPlate();

    // ---- intro ----------------------------------------------------------
    const strokePaths = Array.from(stroke.querySelectorAll("path"));
    const played =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(INTRO_KEY) === "1";

    let introDone = false;
    let introTl: gsap.core.Timeline | null = null;

    const fills = [upperFillRef.current, lowerFillRef.current].filter(
      Boolean,
    ) as SVGPathElement[];

    if (reduced || played) {
      introDone = true;
      gsap.set(fills, { opacity: 1 });
      gsap.set(stroke, { opacity: 0 });
      gsap.set(intro, { opacity: 1, y: 0 });
    } else {
      strokePaths.forEach((path) => {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.set(fills, { opacity: 0 });
      gsap.set(intro, { opacity: 0, y: 18 });

      const tl = gsap.timeline({
        onComplete: () => {
          introDone = true;
          try {
            sessionStorage.setItem(INTRO_KEY, "1");
          } catch {
            /* storage unavailable, the intro simply replays */
          }
        },
      });
      introTl = tl;
      tl.to(strokePaths, {
        strokeDashoffset: 0,
        duration: 1.5,
        ease: "power2.inOut",
        stagger: 0.16,
      })
        .to(fills, { opacity: 1, duration: 0.55, ease: "power1.out" }, "-=0.45")
        .to(stroke, { opacity: 0, duration: 0.5, ease: "power1.out" }, "<")
        .to(
          intro,
          { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
          "-=0.3",
        );
    }

    frame(0);

    // ---- pinned scrub ---------------------------------------------------
    const state = { p: 0 };

    const trigger = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "+=260%",
      pin: stage,
      pinSpacing: true,
      scrub: reduced ? false : 0.6,
      onUpdate: (self) => {
        state.p = self.progress;
        if (!introDone) {
          if (self.progress <= 0.001) {
            frame(0);
            return;
          }
          introTl?.progress(1);
          introDone = true;
        }
        frame(self.progress);
      },
      onLeave: () => {
        state.p = 1;
        setHeroProgress(1);
      },
      onLeaveBack: () => {
        state.p = 0;
        frame(0);
      },
    });

    const onResize = () => {
      measure();
      dpr = sizeCanvas();
      frame(state.p);
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    // The slot moves when the display face finishes loading.
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        measure();
        fitLabelPlate();
        frame(state.p);
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      trigger.kill();
      gsap.killTweensOf([...fills, stroke, intro, foot, upper]);
    };
  }, []);

  return (
    <section className="cine" ref={rootRef} aria-labelledby="cine-title">
      <div className="cine__stage" ref={stageRef}>
        <canvas
          className="cine__thickness"
          ref={canvasRef}
          aria-hidden="true"
        />

        <svg className="cine__svg" aria-hidden="true" focusable="false">
          <g ref={upperRef}>
            <path
              ref={upperFillRef}
              d={MARK_PATHS[0]}
              fill="var(--paper)"
              className="cine__face"
            />
          </g>
          <g ref={lowerRef}>
            <path
              ref={lowerFillRef}
              d={MARK_PATHS[1]}
              fill="var(--paper)"
              className="cine__face"
            />
          </g>

          <g className="cine__gap" ref={gapRef}>
            {Array.from({ length: TETHERS }).map((_, i) => (
              <line key={`t${i}`} className="cine__tether" />
            ))}
            {Array.from({ length: TETHERS }).map((_, i) => (
              <line key={`k${i}`} className="cine__tick" />
            ))}
            <g className="cine__label">
              <rect rx="1" />
              <text textAnchor="middle" dy="0.34em">
                caveat
              </text>
            </g>
          </g>

          <g ref={strokeRef}>
            {MARK_PATHS.map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke="var(--paper)"
                strokeWidth={1.35}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            ))}
          </g>
        </svg>

        <div className="cine__intro" ref={introRef}>
          <h1 id="cine-title">Open registry for delegation rules.</h1>
          <p>
            Discover, inspect, and contribute ERC-7710 caveat enforcers through
            one shared source of truth.
          </p>
        </div>

        <div className="cine__actions" ref={actionsRef}>
          <Link className="cine__cta cine__cta--solid" to="/registry">
            Explore the registry <span aria-hidden="true" className="arrow" />
          </Link>
          <Link className="cine__cta cine__cta--ghost" to="/learn">
            Understand caveats
          </Link>
        </div>

        <div className="cine__foot" ref={footRef}>
          <div className="cine__meta">
            <span>Built on Intuition</span>
            <i />
            <span>ERC-7710</span>
            <i />
            <span>Membership is evidence, not a safety verdict</span>
          </div>
        </div>
      </div>
    </section>
  );
}
