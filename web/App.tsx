/**
 * DIRECTION: Registry Within. A calm, near-black product world where the Caveat mark is the physical instrument that exposes delegation records.
 * AUDIENCE: Wallet builders, delegation developers, auditors, and curious users trying to understand or contribute an enforcer.
 * JOB: Make an open registry intelligible, credible, and immediately usable without implying that registry membership equals safety.
 * FIRST VIEWPORT: A monumental matte Caveat mark contains the records; a centered one-line offer and two actions sit in the quiet lower field.
 * FORM: Multi-page product website with an immersive Persuade homepage and restrained Operate and Read surfaces.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { CaveatMarkSvg, MARK_H, MARK_PATHS, MARK_W } from "./CaveatMark";
import CinematicHero from "./CinematicHero";
import HomeSections from "./HomeSections";
import {
  DetailPage,
  DevelopersPage,
  LearnPage,
  RegistryPage,
  SubmitPage,
} from "./Pages";
import { subscribeHeroProgress } from "./heroProgress";

const githubBase = "https://github.com/intuition-box/caveat-enforcers-registry";

function ScrollReset() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
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
 * The header's mark during the handoff. The upper plane simply arrives — it has
 * just flown here from the hero — and the lower plane draws itself in beneath
 * it with the same stroke gesture the site opened with, completing the mark.
 */
function NavMark({ draw }: { draw: number }) {
  const arrive = draw > 0.02 ? 1 : 0;
  const strokeIn = Math.min(1, Math.max(0, draw / 0.62));
  const fillIn = Math.min(1, Math.max(0, (draw - 0.48) / 0.52));

  return (
    <span className="brand-mark brand-mark--vector brand-mark--compact">
      <svg viewBox={`0 0 ${MARK_W} ${MARK_H}`} fill="none" aria-hidden="true">
        <path d={MARK_PATHS[0]} fill="currentColor" opacity={arrive} />
        <path d={MARK_PATHS[1]} fill="currentColor" opacity={fillIn} />
        <path
          d={MARK_PATHS[1]}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - strokeIn}
          opacity={1 - fillIn}
        />
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

  // The plane lands on black and the mark is taken over at 0.855; only then
  // does the bar materialise under it, so nothing is ever seen through it.
  const reveal = isHome
    ? Math.min(1, Math.max(0, (heroProgress - 0.862) / 0.07))
    : 1;
  const markDraw = isHome
    ? Math.min(1, Math.max(0, (heroProgress - 0.855) / 0.11))
    : 1;
  const live = reveal > 0.999;

  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    ["Registry", "/registry"],
    ["Submit", "/submit"],
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
      <Link className="brand" to="/" aria-label="Caveat Registry home">
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
    <main>
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

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Mark compact />
        <p>An open ERC-7710 caveat enforcer registry built on Intuition.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link to="/registry">Registry</Link>
        <Link to="/submit">Submit</Link>
        <Link to="/learn">Learn</Link>
        <a href={githubBase}>
          GitHub <Arrow />
        </a>
      </nav>
    </footer>
  );
}

export default function App() {
  return (
    <div className="site-shell">
      <ScrollReset />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/registry" element={<RegistryPage />} />
        <Route path="/registry/:slug" element={<DetailPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <SiteFooter />
    </div>
  );
}
