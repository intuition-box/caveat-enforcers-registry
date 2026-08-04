/**
 * The road.
 *
 * The hero hands over a full frame of paper. Here that paper contracts into a
 * level band with black closing in above and below, and the section pins:
 * vertical scroll becomes travel to the right. A solid marble rolls the road
 * while the rails clamp inward at each enforcer, so the lane being travelled is
 * literally the permission surface — wide and unconstrained at the start, exact
 * by the end. The last beat is a refusal, because that is what an enforcer does.
 *
 * Three layers move at three speeds for depth. It is all transforms and opacity
 * driven by one scroll handler: no canvas, no simulation.
 *
 * The marble lives outside the group that contracts, or the settle would squash
 * it into an ellipse.
 */
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * The mark's fold. The road is the lower plane extended, so it keeps the angle:
 * travelling right along it goes up-screen, which reads as distance, not incline.
 * Levelling this to horizontal flattens a road into a stripe.
 */
const FOLD_DEG = 23.6;
const FOLD = (FOLD_DEG * Math.PI) / 180;
const COS = Math.cos(FOLD);
const SIN = Math.sin(FOLD);

/** Road length and lane geometry, in road units. The centreline is y = 0. */
const TRACK = 5400;
const OPEN = 150;
const RADIUS = 17;
const REFUSAL_X = 4780;

type Station = {
  x: number;
  half: number;
  name: string;
  glyph: string;
  rule: string;
  side: "above" | "below";
};

const STATIONS: Station[] = [
  {
    x: 1150,
    half: 112,
    name: "AllowedTargetsEnforcer",
    glyph: "target-address",
    rule: "Only these contracts may be called.",
    side: "below",
  },
  {
    x: 2300,
    half: 76,
    name: "ERC20TransferAmountEnforcer",
    glyph: "amount-limit",
    rule: "No more than this much may move.",
    side: "above",
  },
  {
    x: 3450,
    half: 44,
    name: "TimestampEnforcer",
    glyph: "time-window",
    rule: "Only inside this window.",
    side: "below",
  },
];

/** Lane half-width at a point, easing between clamps. */
function halfAt(x: number): number {
  let prevX = 0;
  let prevHalf = OPEN;
  for (const s of STATIONS) {
    if (x < s.x) {
      const t = gsap.utils.clamp(0, 1, (x - prevX) / (s.x - prevX));
      return prevHalf + (s.half - prevHalf) * (t * t * (3 - 2 * t));
    }
    prevX = s.x;
    prevHalf = s.half;
  }
  return prevHalf;
}

function buildRoad() {
  const step = 18;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let x = 0; x <= TRACK; x += step) {
    const h = halfAt(x);
    top.push(`${x},${(-h).toFixed(1)}`);
    // The entrance keeps the lower plane's swept edge, so the road reads as
    // that plane continuing rather than as a new shape arriving.
    const sweep = x < 900 ? Math.pow(1 - x / 900, 2.1) * 74 : 0;
    bottom.push(`${x},${(h + sweep).toFixed(1)}`);
  }
  return {
    surface: `M${top.join(" L")} L${bottom.slice().reverse().join(" L")} Z`,
    railTop: `M${top.join(" L")}`,
    railBottom: `M${bottom.join(" L")}`,
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function RoadSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const farRef = useRef<HTMLDivElement | null>(null);
  const nearRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<SVGGElement | null>(null);
  const trackRef = useRef<SVGGElement | null>(null);
  const propsRef = useRef<SVGGElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const marbleRef = useRef<SVGGElement | null>(null);
  const spinRef = useRef<SVGGElement | null>(null);
  const shadowRef = useRef<SVGEllipseElement | null>(null);
  const strayRef = useRef<SVGGElement | null>(null);

  const road = buildRoad();

  useEffect(() => {
    const el = {
      root: rootRef.current,
      stage: stageRef.current,
      far: farRef.current,
      near: nearRef.current,
      band: bandRef.current,
      track: trackRef.current,
      props: propsRef.current,
      world: worldRef.current,
      marble: marbleRef.current,
      spin: spinRef.current,
      shadow: shadowRef.current,
      stray: strayRef.current,
    };
    if (Object.values(el).some((v) => !v)) return;
    const {
      root,
      stage,
      far,
      near,
      band,
      track,
      props,
      world,
      marble,
      spin,
      shadow,
      stray,
    } = el as { [K in keyof typeof el]: NonNullable<(typeof el)[K]> };

    const reduced = prefersReducedMotion();
    const ANCHOR = 0.34;
    const cards = Array.from(
      world.querySelectorAll<HTMLElement>(".road__card"),
    );

    let vw = 0;
    let vh = 0;
    let scale = 1;
    let distance = 0;

    const measure = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      // The open lane takes about a third of the frame; black holds the rest.
      scale = gsap.utils.clamp(0.5, 1.2, (vh * 0.3) / (OPEN * 2));
      // Always keep a frame of road ahead of the marble.
      distance = TRACK - (vw * (1 - ANCHOR)) / scale - 40;
      stage.style.setProperty("--lane", `${(OPEN * scale).toFixed(1)}px`);
    };

    // Heavy things arrive a beat after the scroll that moved them.
    let shown = 0;

    const frame = (target: number) => {
      shown += (target - shown) * (reduced ? 1 : 0.16);
      const p = reduced ? target : shown;

      const settle = gsap.utils.clamp(0, 1, p / 0.1);
      const eased = settle * settle * (3 - 2 * settle);
      const run = gsap.utils.clamp(0, 1, (p - 0.08) / 0.92);

      const d = run * distance;
      const originX = vw * ANCHOR;
      const originY = vh * 0.56;
      // Travel happens in the road's own frame, then the whole road is rotated
      // to the fold angle, so moving forward moves up-screen into depth.
      const place = `translate(${originX.toFixed(1)} ${originY.toFixed(1)}) rotate(${-FOLD_DEG}) translate(${(-d * scale).toFixed(1)} 0) scale(${scale.toFixed(4)})`;

      // The handed-over paper contracts into a band. Only the road contracts.
      const openHeight = (vh * 1.6) / (OPEN * 2 * scale);
      const sy = openHeight + (1 - openHeight) * eased;
      band.setAttribute("transform", `scale(1 ${sy.toFixed(3)})`);
      band.style.transformOrigin = `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;

      track.setAttribute("transform", place);
      props.setAttribute("transform", place);
      world.style.opacity = String(gsap.utils.clamp(0, 1, (p - 0.07) / 0.07));
      // Copy rides the road but never tilts with it.
      for (const card of cards) {
        const rx = Number(card.dataset.x);
        const perp = Number(card.dataset.perp);
        const along = (rx - d) * scale;
        const off = perp * scale;
        const sx = originX + along * COS + off * SIN;
        const sy = originY - along * SIN + off * COS;
        // The road climbs to the right, so copy above it must grow up-left and
        // copy below it down-right, or the band cuts through the text.
        card.style.transform =
          `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)` +
          (perp < 0 ? " translateY(-100%)" : "");
      }

      // Depth: the distance drifts, the near edge outruns the road.
      const drift = (rate: number) => {
        const a = -d * scale * rate;
        return `translate3d(${(a * COS).toFixed(1)}px, ${(-a * SIN).toFixed(1)}px, 0)`;
      };
      far.style.transform = drift(0.26);
      near.style.transform = drift(1.55);

      // Rolling: rotation is distance over radius, not decoration.
      marble.setAttribute("transform", `translate(${d.toFixed(1)} 0)`);
      spin.setAttribute(
        "transform",
        `rotate(${((d / RADIUS) * (180 / Math.PI)).toFixed(1)})`,
      );

      // The contact patch spreads with speed and tightens at rest.
      const speed = Math.min(1, Math.abs(target - shown) * 30);
      shadow.setAttribute("rx", (RADIUS * (1.2 + speed * 0.55)).toFixed(1));
      shadow.setAttribute("ry", (RADIUS * (0.3 - speed * 0.09)).toFixed(1));
      shadow.setAttribute("opacity", (0.36 - speed * 0.13).toFixed(3));

      // A second marble leaves the lane and the rail refuses it.
      const rt = gsap.utils.clamp(0, 1, (d - REFUSAL_X + 850) / 850);
      const blocked = rt > 0.82;
      const lift = blocked ? 1 : rt / 0.82;
      const ceiling = halfAt(REFUSAL_X) - RADIUS * 0.78;
      stray.setAttribute(
        "transform",
        `translate(${REFUSAL_X} ${(-lift * ceiling).toFixed(1)})`,
      );
      stray.setAttribute(
        "opacity",
        gsap.utils.clamp(0, 1, rt * 2.6).toFixed(3),
      );
      stray.classList.toggle("is-blocked", blocked);
    };

    measure();
    frame(0);

    const state = { p: 0 };
    const trigger = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "+=340%",
      pin: stage,
      pinSpacing: true,
      scrub: reduced ? false : 0.4,
      onUpdate: (self) => {
        state.p = self.progress;
      },
    });

    // One loop keeps the easing running so the weight reads even at rest.
    let raf = 0;
    const tick = () => {
      frame(state.p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      measure();
      frame(state.p);
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      trigger.kill();
    };
  }, []);

  return (
    <section className="road" ref={rootRef} aria-labelledby="road-title">
      <div className="road__stage" ref={stageRef}>
        <h2 id="road-title" className="visually-hidden">
          How a caveat narrows what a delegation may do
        </h2>

        <div className="road__far" ref={farRef} aria-hidden="true">
          {Array.from({ length: 30 }).map((_, i) => (
            <i key={i} style={{ left: `${i * 320}px` }} />
          ))}
        </div>

        <svg className="road__svg" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="marble" cx="34%" cy="28%" r="78%">
              <stop offset="0%" stopColor="#565450" />
              <stop offset="38%" stopColor="#1b1b19" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
            <radialGradient id="marble-rim" cx="70%" cy="78%" r="46%">
              <stop offset="0%" stopColor="rgba(243,240,232,0.55)" />
              <stop offset="100%" stopColor="rgba(243,240,232,0)" />
            </radialGradient>
          </defs>

          <g ref={bandRef}>
            <g ref={trackRef}>
              <path className="road__surface" d={road.surface} />
              <path className="road__rail" d={road.railTop} />
              <path className="road__rail" d={road.railBottom} />
              {STATIONS.map((s) => (
                <line
                  key={s.name}
                  className="road__gate"
                  x1={s.x}
                  y1={-halfAt(s.x)}
                  x2={s.x}
                  y2={halfAt(s.x)}
                />
              ))}
            </g>
          </g>

          <g ref={propsRef}>
            <g className="road__stray" ref={strayRef}>
              <circle r={12} fill="url(#marble)" />
              <circle r={12} fill="url(#marble-rim)" />
            </g>

            <g ref={marbleRef}>
              <ellipse
                ref={shadowRef}
                className="road__shadow"
                cy={RADIUS + 3}
                rx={20}
                ry={5}
              />
              <circle r={RADIUS} fill="url(#marble)" />
              <g ref={spinRef}>
                <path
                  className="road__meridian"
                  d={`M0,${-RADIUS} A 7.5 ${RADIUS} 0 0 0 0 ${RADIUS} A 7.5 ${RADIUS} 0 0 0 0 ${-RADIUS}`}
                />
              </g>
              <circle r={RADIUS} fill="url(#marble-rim)" />
            </g>
          </g>
        </svg>

        <div className="road__near" ref={nearRef} aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <i key={i} style={{ left: `${i * 400}px` }} />
          ))}
        </div>

        <div className="road__world" ref={worldRef}>
          <article className="road__card" data-x="140" data-perp="-300">
            <p className="mono-label">Unconstrained</p>
            <h3>A delegation with no caveats.</h3>
            <p>
              It can do anything the account itself can do. The lane is as wide
              as the account's own authority.
            </p>
          </article>

          {STATIONS.map((s) => (
            <article
              key={s.name}
              className="road__card"
              data-x={s.x + 60}
              data-perp={s.side === "above" ? -(s.half + 200) : s.half + 110}
            >
              <img
                className="glyph"
                src={`/glyphs/${s.glyph}-96.png`}
                alt=""
                width={40}
                height={40}
              />
              <p className="mono-label">{s.name}</p>
              <p>{s.rule}</p>
            </article>
          ))}

          <article className="road__card" data-x="4060" data-perp="-300">
            <p className="mono-label">Composed</p>
            <h3>The exact boundary.</h3>
            <p>
              Three independent rules, one lane. This is the permission a wallet
              should be able to read before it is signed.
            </p>
          </article>

          <article
            className="road__card"
            data-x={REFUSAL_X + 60}
            data-perp="140"
          >
            <p className="mono-label">Reverted</p>
            <p>
              An execution outside the boundary does not fail late. The enforcer
              refuses it before state changes.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
