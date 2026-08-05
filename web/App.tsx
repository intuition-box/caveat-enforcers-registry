/**
 * THESIS: Delegation boundaries become credible when the registry resolves code into inspectable evidence; this refuses the crypto badge-and-card-grid default.
 * OWN-WORLD: Warp-informed cool white, pale lavender proof fields, near-black feature surfaces, a light sans hierarchy, and a restrained Intuition / MetaMask proof rail.
 * STORY: Understand the boundary, inspect its evidence, explore real reference types, then search, contribute, learn, or integrate.
 * FIRST VIEWPORT: The approved cinematic hero remains a monumental matte mark, centered offer, two actions, and a restrained proof rail.
 * FORM: User-pinned Warp-inspired product chapters beneath an original hero; no concept-roll seed was required for this established-world extension.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { CaveatMarkSvg, MARK_H, MARK_PATHS, MARK_W } from "./CaveatMark";
import CinematicHero from "./CinematicHero";
import HomeSections from "./HomeSections";
import IntuitionLogo from "./IntuitionLogo";
import { subscribeHeroProgress } from "./heroProgress";

const githubBase = "https://github.com/intuition-box/caveat-enforcers-registry";

const RegistryPage = lazy(() =>
  import("./Pages").then((module) => ({ default: module.RegistryPage })),
);
const DetailPage = lazy(() =>
  import("./Pages").then((module) => ({ default: module.DetailPage })),
);
const SubmitPage = lazy(() =>
  import("./Pages").then((module) => ({ default: module.SubmitPage })),
);
const LearnPage = lazy(() =>
  import("./Pages").then((module) => ({ default: module.LearnPage })),
);
const ComposabilityPage = lazy(() =>
  import("./Pages").then((module) => ({ default: module.ComposabilityPage })),
);
const DevelopersPage = lazy(() =>
  import("./Pages").then((module) => ({ default: module.DevelopersPage })),
);

function ScrollReset() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

/**
 * Stage the authored homepage demonstrations, chapter bands, and closing
 * action sequence as they enter the viewport. The cinematic hero and FoldText
 * own their own timelines; this observer handles section-level continuity.
 */
function PageMotion() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const selector = ".translation, .registry-peek, .scroll-reveal";
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    document.documentElement.classList.add("motion-ready");

    const register = (element: HTMLElement) => {
      const readyClass = element.classList.contains("scroll-reveal")
        ? "scroll-reveal-ready"
        : "reveal-ready";
      if (
        element.classList.contains("reveal-ready") ||
        element.classList.contains("scroll-reveal-ready")
      ) {
        return;
      }
      element.classList.add(readyClass);
      if (reduced) {
        element.classList.add("is-visible");
      }
    };

    const revealVisible = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (element.classList.contains("is-visible")) return;
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
          element.classList.add("is-visible");
        }
      });
    };

    let frame = 0;
    const queueReveal = () => {
      if (frame || reduced) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        revealVisible();
      });
    };

    const scan = () => {
      document
        .querySelectorAll<HTMLElement>(selector)
        .forEach((element) => register(element));
      queueReveal();
    };

    scan();
    window.addEventListener("scroll", queueReveal, { passive: true });
    window.addEventListener("resize", queueReveal);
    const mutations = new MutationObserver(scan);
    mutations.observe(document.getElementById("root") ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener("scroll", queueReveal);
      window.removeEventListener("resize", queueReveal);
      if (frame) window.cancelAnimationFrame(frame);
      mutations.disconnect();
    };
  }, [pathname]);

  return null;
}

function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? "brand-mark brand-mark--vector brand-mark--compact"
          : "brand-mark brand-mark--vector"
      }
    >
      <CaveatMarkSvg />
    </span>
  );
}

/**
 * The header's mark during the handoff. Both hero planes arrive together, so
 * the navigation receives the whole mark rather than a staged reconstruction.
 */
function NavMark({ draw }: { draw: number }) {
  const arrive = draw > 0.02 ? 1 : 0;

  return (
    <span className="brand-mark brand-mark--vector brand-mark--compact">
      <svg viewBox={`0 0 ${MARK_W} ${MARK_H}`} fill="none" aria-hidden="true">
        <path d={MARK_PATHS[0]} fill="currentColor" opacity={arrive} />
        <path d={MARK_PATHS[1]} fill="currentColor" opacity={arrive} />
      </svg>
    </span>
  );
}

/**
 * On the homepage the nav is a function of hero progress: it is laid out from
 * the start so its brand slot can be measured, but stays invisible and inert
 * until the upper plane is on its way.
 */
function useHeroHandoff(isHome: boolean) {
  const [progress, setProgress] = useState(isHome ? 0 : 1);

  useEffect(() => {
    if (!isHome) {
      setProgress(1);
      return;
    }
    return subscribeHeroProgress(setProgress);
  }, [isHome]);

  return progress;
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const heroProgress = useHeroHandoff(isHome);

  // The full mark lands at 0.85; the header follows immediately underneath it.
  const reveal = isHome
    ? Math.min(1, Math.max(0, (heroProgress - 0.872) / 0.07))
    : 1;
  const markDraw = isHome
    ? Math.min(1, Math.max(0, (heroProgress - 0.842) / 0.035))
    : 1;
  const live = reveal > 0.999;

  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    ["Registry", "/registry"],
    ["Submit", "/submit"],
    ["Composability", "/composability"],
    ["Learn", "/learn"],
    ["Developers", "/developers"],
  ];

  const headerClass = [
    "site-header",
    isHome ? "site-header--cinematic" : "",
    isHome && live ? "site-header--live" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header
      className={headerClass}
      style={
        isHome ? ({ "--reveal": reveal } as React.CSSProperties) : undefined
      }
      aria-hidden={isHome && !live ? true : undefined}
    >
      <Link
        className="brand"
        to="/"
        aria-label="Caveat Registry home"
        onClick={(event) => {
          if (!isHome) return;
          event.preventDefault();
          const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          window.scrollTo({
            top: 0,
            behavior: reduced ? "auto" : "smooth",
          });
        }}
      >
        {isHome ? <NavMark draw={markDraw} /> : <Mark compact />}
        <span>Caveat Registry</span>
      </Link>

      <button
        className="menu-toggle"
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
      </button>

      <nav className={open ? "site-nav site-nav--open" : "site-nav"}>
        {links.map(([label, path]) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => (isActive ? "is-active" : undefined)}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function Arrow() {
  return <span aria-hidden="true" className="arrow" />;
}

function HomePage() {
  return (
    <main className="home-page">
      <CinematicHero />
      <HomeSections />
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="page page--dark not-found">
      <h1>This route is outside the registry.</h1>
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </main>
  );
}

function RouteLoading() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span>Opening registry surface</span>
    </main>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer scroll-reveal">
      <div className="site-footer__statement">
        <div className="site-footer__brand">
          <Mark compact />
          <span>Caveat Registry</span>
        </div>
        <p>Delegation rules should be readable before they are trusted.</p>
      </div>
      <div className="site-footer__links">
        <nav aria-label="Product navigation">
          <span>Product</span>
          <Link to="/registry">Registry</Link>
          <Link to="/submit">Submit</Link>
          <Link to="/composability">Composability</Link>
          <Link to="/learn">Learn</Link>
        </nav>
        <nav aria-label="Developer navigation">
          <span>Build</span>
          <Link to="/developers">Developers</Link>
          <a href={githubBase}>
            GitHub <Arrow />
          </a>
        </nav>
      </div>
      <div className="site-footer__base">
        <span>Caveat Registry</span>
        <span className="intuition-lockup">
          Built on <IntuitionLogo size={15} /> Intuition
        </span>
        <span>ERC-7710 open registry</span>
      </div>
    </footer>
  );
}

export default function App() {
  const location = useLocation();
  const shellClass = [
    "site-shell",
    location.pathname === "/" ? "site-shell--home" : "",
    location.pathname !== "/" ? "site-shell--route" : "",
    location.pathname.startsWith("/registry") ? "site-shell--registry" : "",
    location.pathname === "/submit" ? "site-shell--submit" : "",
    location.pathname === "/learn" ? "site-shell--learn" : "",
    location.pathname === "/developers" ? "site-shell--developers" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <ScrollReset />
      <PageMotion />
      <SiteHeader />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/registry" element={<RegistryPage />} />
          <Route path="/registry/:slug" element={<DetailPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/composability" element={<ComposabilityPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <SiteFooter />
    </div>
  );
}
