/**
 * The homepage past the hero.
 *
 * Structure follows the approved visual system: ruled and unboxed records,
 * Space Mono carrying technical proof, and one statement per section. The
 * resolution surface follows the hero as the first full section; the proof
 * rail comes after that window so protocol context arrives after the visitor
 * has seen the registry resolve a record.
 *
 * Nothing here fabricates a registry record. Enforcer type names and their
 * descriptions are factual; anything that would be live evidence is either
 * marked as an example or reduced to the model itself.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import CardSwap, { Card } from "./CardSwap";
import FoldText from "./FoldText";
import FlowingMenu from "./FlowingMenu";
import ScrollStack, { ScrollStackItem } from "./ScrollStack";
import { CaveatMarkSvg } from "./CaveatMark";
import IntuitionLogo from "./IntuitionLogo";
import LineWaves from "./LineWaves";
import MetaMaskLogo from "./MetaMaskLogo";

function Arrow() {
  return <span aria-hidden="true" className="arrow" />;
}

function ArrowDown() {
  return (
    <span aria-hidden="true" className="flow__stack-arrow">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="M8 1.5v11M3.5 9l4.5 4.5L12.5 9" />
      </svg>
    </span>
  );
}

type CloseCardKind = "explore" | "contribute" | "learn";

/** The proof rail: protocol context first, reference material second. */
function SponsorRail() {
  return (
    <section
      className="sponsor-rail scroll-reveal"
      aria-labelledby="sponsor-title"
    >
      <div className="sponsor-rail__inner">
        <div className="sponsor-rail__copy">
          <p className="sponsor-rail__eyebrow">Open infrastructure</p>
          <h2 id="sponsor-title">One source for the boundary.</h2>
          <p>
            Built on Intuition&apos;s public graph, with the MetaMask Smart
            Accounts Kit as the first reference collection.
          </p>
        </div>

        <div className="sponsor-rail__marks" aria-label="Project foundations">
          <div className="sponsor-rail__mark">
            <IntuitionLogo size={42} title="Intuition" />
            <span>
              <strong>Intuition</strong>
              <small>Canonical graph</small>
            </span>
          </div>
          <div className="sponsor-rail__mark">
            <MetaMaskLogo size={42} title="MetaMask" />
            <span>
              <strong>MetaMask</strong>
              <small>Smart Accounts Kit</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 02 — the problem, in a live resolution surface. */
function Resolution() {
  return (
    <section
      className="resolution scroll-reveal"
      aria-labelledby="sec-resolution"
    >
      <div className="resolution-heading">
        <div className="resolution-intro">
          <header className="resolution-intro__heading">
            <p className="mono-label">02 / Resolve</p>
            <h2 id="sec-resolution">Make the boundary legible.</h2>
          </header>
          <p className="resolution-intro__lede">
            Caveat Registry turns deployed code into purpose, terms, chain
            evidence, source, and public claims without turning any signal into
            a safety badge.
          </p>
        </div>
      </div>

      <div className="sec--linewaves resolution-stage">
        <div className="line-waves__background" aria-hidden="true">
          <LineWaves
            speed={0.24}
            innerLineCount={28}
            outerLineCount={34}
            warpIntensity={0.9}
            rotation={-45}
            edgeFadeWidth={0.12}
            colorCycleSpeed={0.35}
            brightness={0.17}
            color1="#c3b1ff"
            color2="#e4d9ff"
            color3="#aaa4f0"
            enableMouseInteraction
            mouseInfluence={1.4}
          />
        </div>
        <div className="line-waves__veil" aria-hidden="true" />

        <div className="resolution-stage__inner">
          <div
            className="mac-window"
            aria-label="Illustrative registry resolution"
          >
            <div className="mac-window__chrome">
              <div className="mac-window__traffic" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <span className="mac-window__title">Caveat Registry</span>
              <span className="mac-window__mode">Illustrative record</span>
            </div>

            <div className="mac-window__body">
              <aside className="mac-window__sidebar">
                <div className="mac-window__search">
                  <span aria-hidden="true">⌕</span>
                  <code>0x0465…3B91</code>
                </div>
                <p className="mac-window__side-label">Resolution</p>
                <div className="mac-window__side-row is-active">
                  <span>ERC-20 transfer limit</span>
                  <b aria-hidden="true" />
                </div>
                <div className="mac-window__side-row">
                  <span>Terms schema</span>
                  <small>Ready</small>
                </div>
                <div className="mac-window__side-row">
                  <span>Source evidence</span>
                  <small>Separate</small>
                </div>
              </aside>

              <div className="mac-window__content">
                <div className="mac-window__content-head">
                  <span className="intuition-lockup intuition-lockup--dark">
                    <IntuitionLogo size={17} />
                    <span>Intuition 1155</span>
                  </span>
                  <span className="mono-sub">Canonical resolution</span>
                </div>

                <div className="mac-window__record-head">
                  <div>
                    <p className="mac-window__eyebrow">Enforcer deployment</p>
                    <code>0x0465…3B91</code>
                  </div>
                  <span className="mac-window__tag">ERC-7710</span>
                </div>

                <h3>ERC-20 transfer limit</h3>
                <p className="mac-window__summary">
                  Move one approved token, within the encoded amount ceiling.
                </p>

                <div className="mac-window__facts">
                  <div>
                    <span>Terms</span>
                    <strong>Token address</strong>
                    <strong>Maximum amount</strong>
                  </div>
                  <div>
                    <span>Evidence</span>
                    <strong>Source provenance</strong>
                    <strong>Support + counter-claims</strong>
                  </div>
                </div>

                <div className="mac-window__status">
                  <i aria-hidden="true" />
                  <span>
                    Observed code is deployment evidence, not a safety verdict.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="sec__note">
            Example record — not a live listing. Signals resolve from Intuition
            once the reviewed ontology IDs are configured.
          </p>
        </div>
      </div>
    </section>
  );
}

/** 03 — anatomy. */
const ANATOMY = [
  [
    "Actor",
    "The account granting authority, and the delegate acting on its behalf.",
  ],
  [
    "Action",
    "The call being authorised — a target, a selector, and its arguments.",
  ],
  ["Boundary", "The enforcer contract that refuses anything outside the rule."],
  [
    "Terms",
    "The encoded parameters that make the rule specific to this delegation.",
  ],
  ["Result", "Execution or refusal, decided before state changes."],
];

function Anatomy() {
  const anatomyItems = ANATOMY.map(([text, description]) => ({
    link: "#anatomy-flow",
    text,
    description,
    image: "/art/flow-card-cloud.png",
  }));

  return (
    <section
      className="sec sec--paper sec--chapter scroll-reveal"
      aria-labelledby="sec-anatomy"
    >
      <div className="split split--chapter">
        <header className="sec__head sec__head--tight">
          <h2 id="sec-anatomy">
            A caveat enforcer is a rule around an action.
          </h2>
          <p className="sec__lede">
            Every enforcer defines what a delegated account may do, where it may
            act, and the limits it must obey.
          </p>
        </header>
        <div className="sec__aside-stack">
          <video
            className="sec__aside-video"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src="/art/caveat-rule-loop.mp4" type="video/mp4" />
          </video>
          <p className="sec__aside">
            The registry keeps every part inspectable so a wallet, developer, or
            reviewer can understand the same boundary.
          </p>
        </div>
      </div>

      <div id="anatomy-flow" className="anatomy-flow">
        <FlowingMenu
          items={anatomyItems}
          speed={18}
          textColor="var(--ink)"
          bgColor="var(--paper)"
          marqueeBgColor="var(--ink)"
          marqueeTextColor="var(--paper)"
          borderColor="rgba(5, 5, 5, 0.18)"
        />
      </div>
    </section>
  );
}

/** 04 — the evidence model and reference types in one changing surface. */
const EVIDENCE_PANELS = [
  {
    tone: "claims",
    label: "Evidence ledger",
    cardTitle: "Separate signals",
    title: "Claims stay separate.",
    body: "Supporting and counter-claims are read side by side. The registry never collapses them into a single score.",
    rows: [
      ["Supporting", "Attested by accounts"],
      ["Counter", "Open and resolved"],
    ],
  },
  {
    tone: "terms",
    label: "Terms schema",
    cardTitle: "Rules stay specific",
    title: "Terms stay readable.",
    body: "Purpose and encoded parameters sit together, so a user can see exactly what a delegation allows before signing.",
    rows: [
      ["Purpose", "Plain-language rule"],
      ["Parameters", "Encoded boundary"],
    ],
  },
  {
    tone: "source",
    label: "Source provenance",
    cardTitle: "Source stays attached",
    title: "Evidence stays traceable.",
    body: "Deployment, build, audit, and chain context remain attached to the record instead of being replaced by a trust label.",
    rows: [
      ["Deployment", "Code observed"],
      ["Source", "Build and audit"],
    ],
  },
  {
    tone: "types",
    label: "Reference types",
    cardTitle: "Find the boundary",
    title: "Start with what it limits.",
    body: "Explore reference enforcers by action: amount, target, method, or time window.",
    rows: [
      ["Amount", "ERC20TransferAmount"],
      ["Target", "AllowedTargets"],
    ],
  },
] as const;

function Evidence() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = EVIDENCE_PANELS[activeIndex];

  return (
    <section
      className="sec sec--ink sec--seam evidence-showcase scroll-reveal"
      aria-labelledby="sec-evidence"
    >
      <div className="evidence-showcase__grid">
        <div className="evidence-showcase__copy">
          <header className="sec__head sec__head--tight">
            <h2 id="sec-evidence">Trust is evidence, not a badge.</h2>
          </header>
          <p className="sec__lede">
            Type, deployment, chain, source, terms schema, and community signal
            stay separate and inspectable.
          </p>

          <div className="cta-row">
            <Link className="cta cta--ghost" to="/learn">
              Read the evidence model
            </Link>
            <Link className="cta cta--ghost" to="/registry">
              Open full registry <Arrow />
            </Link>
          </div>
        </div>

        <div
          className="evidence-showcase__visual"
          role="group"
          aria-label="Evidence and reference type panels"
        >
          <CardSwap
            width={500}
            height={350}
            cardDistance={38}
            verticalDistance={48}
            delay={4200}
            pauseOnHover
            easing="linear"
            skewAmount={1}
            onActiveChange={setActiveIndex}
          >
            {EVIDENCE_PANELS.map((panel, index) => (
              <Card
                key={panel.tone}
                className={`evidence-card evidence-card--${panel.tone}`}
                aria-hidden="true"
              >
                <div className="evidence-card__topline">
                  <span>0{index + 1}</span>
                  <span>CAVEAT REGISTRY</span>
                </div>
                <div className="evidence-card__heading">
                  <p>{panel.label}</p>
                  <h3>{panel.cardTitle}</h3>
                </div>
                <div className="evidence-card__rows">
                  {panel.rows.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="evidence-card__footer">
                  <span>INTUITION 1155</span>
                  <span>INSPECTABLE</span>
                </div>
              </Card>
            ))}
          </CardSwap>
          <p className="evidence-showcase__hint">
            Panels change automatically · hover to pause
          </p>
        </div>
      </div>

      <div className="evidence-showcase__active" aria-live="polite">
        <div className="evidence-showcase__active-copy">
          <p className="mono-label">{active.label}</p>
          <h3>{active.title}</h3>
          <p>{active.body}</p>
        </div>
        <dl className="evidence-showcase__facts">
          {active.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="evidence-showcase__caveat">
        Membership means discoverable. It does not mean approved, audited, or
        safe.
      </p>
    </section>
  );
}

/** 07 — composition. */
const LAYERS = [
  [
    "Use case",
    "Monthly subscription",
    "One boundary assembled from four independent rules.",
  ],
  ["Target", "AllowedTargets", "Only the subscription contract may be called."],
  ["Amount", "ERC20TransferAmount", "A 12 USDC ceiling per redemption."],
  [
    "Timing",
    "Timestamp + Nonce",
    "Twelve windows, revocable in one transaction.",
  ],
];

function Layers() {
  return (
    <section
      className="sec sec--paper sec--seam-up scroll-reveal"
      aria-labelledby="sec-layers"
    >
      <div className="split split--chapter">
        <header className="sec__head sec__head--tight">
          <h2 id="sec-layers">Useful permissions work in layers.</h2>
          <p className="sec__lede">
            A monthly subscription is not one rule. It is four, sharing a single
            boundary — and the registry shows why they compose.
          </p>
        </header>
        <p className="sec__aside">
          Composition guidance explains which rules reinforce one another and
          which combinations conflict before a delegation is signed.
        </p>
      </div>

      <ol className="layers">
        {LAYERS.map(([label, title, body]) => (
          <li key={title}>
            <p className="mono-label">{label}</p>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 08 / 09 — openness, and one record end to end. */
const FLOW = [
  {
    label: "Contribute",
    title: "A claim is written",
    body: "A contributor lists the enforcer with its source contract, terms schema, deployment context, and evidence that lets someone else inspect the boundary.",
  },
  {
    label: "Resolve",
    title: "The index resolves it",
    body: "Deployments across chains resolve into one readable record, so a wallet can find an enforcer by purpose instead of chasing addresses across explorers.",
  },
  {
    label: "Query",
    title: "A wallet queries it",
    body: "The signature prompt asks the same index as the site, bringing the discovered record and its supporting signals into the approval path.",
  },
  {
    label: "Read",
    title: "The user reads terms",
    body: "Plain-language terms sit beside the encoded parameters, showing what the delegation can do, where it can act, and when it expires — no guessing.",
  },
  {
    label: "Simulate",
    title: "A signature is informed",
    body: "Simulation runs the composed boundary before approval, making the expected execution and any refusal visible before state can change.",
  },
];

function Openness() {
  return (
    <section
      className="sec sec--ink sec--seam scroll-reveal"
      aria-labelledby="sec-open"
    >
      <div className="split split--open openness__intro">
        <div>
          <span className="pull-stat">
            32
            <span className="pull-stat__label">
              enforcers live on Intuition mainnet
            </span>
          </span>
          <header className="sec__head sec__head--tight">
            <h2 id="sec-open">The registry stays open.</h2>
          </header>
          <p className="sec__lede">
            When the enforcer you need is missing, list it through the same
            public standard. Wallets and applications then query one source —
            the same record that answered your search answers the signature
            prompt.
          </p>
          <div className="cta-row">
            <Link className="cta cta--solid" to="/submit">
              List an enforcer <Arrow />
            </Link>
            <Link className="cta cta--ghost" to="/developers">
              Integration docs
            </Link>
          </div>
        </div>
      </div>

      <div className="flow flow--scroll-stack">
        <p className="flow__title">One record, end to end</p>
        <ScrollStack
          className="flow__stack"
          useWindowScroll
          itemDistance={48}
          stackPosition="6rem"
        >
          {FLOW.map(({ label, title, body }, index) => (
            <ScrollStackItem
              key={title}
              itemClassName={`flow__stack-card flow__stack-card--${index + 1} flow__stack-card--image-${index % 2 === 0 ? "right" : "left"}`}
            >
              <div className="flow__stack-copy">
                <div className="flow__stack-copy-top">
                  <span className="flow__stack-index">0{index + 1}</span>
                  <p className="flow__stack-kicker">{label}</p>
                </div>
                <div className="flow__stack-copy-body">
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
              <div className="flow__stack-media" aria-hidden="true">
                <CaveatMarkSvg className="flow__stack-logo" />
                <span className="flow__stack-media-wordmark">
                  Caveat Registry
                </span>
              </div>
              {index < FLOW.length - 1 ? <ArrowDown /> : null}
            </ScrollStackItem>
          ))}
        </ScrollStack>
      </div>
    </section>
  );
}

const CLOSE_CARDS: Array<{
  kind: CloseCardKind;
  icon: string;
  label: string;
  title: string;
  body: string;
  action: string;
  href: string;
}> = [
  {
    kind: "explore",
    icon: "/art/binoculars.svg",
    label: "Browse the record",
    title: "Explore the registry.",
    body: "Find a deployed boundary by purpose, chain, terms, and the evidence attached to it.",
    action: "Open registry",
    href: "/registry",
  },
  {
    kind: "contribute",
    icon: "/art/1506074059.svg",
    label: "Add what is missing",
    title: "Contribute a rule.",
    body: "List an enforcer with its source, terms schema, deployment context, and inspectable evidence.",
    action: "List an enforcer",
    href: "/submit",
  },
  {
    kind: "learn",
    icon: "/art/Anonymous_Open_Bible.svg",
    label: "Read the standard",
    title: "Learn the boundary.",
    body: "See how terms, deployments, support, opposition, and simulation stay separate and legible.",
    action: "Learn the standard",
    href: "/learn",
  },
];

/** 10 — the close, on the halftone field. */
function Close() {
  return (
    <section
      className="sec sec--ink sec--close close-bridge"
      aria-labelledby="sec-close"
    >
      <div className="close-bridge__head scroll-reveal">
        <h2 id="sec-close" className="close-bridge__title">
          <FoldText
            text={"Find a rule.\nOr add the one that is missing."}
            splitBy="line"
            hinge="top"
            trigger="scroll"
            duration={0.62}
            stagger={0.08}
            ease="power3.out"
            perspective={700}
            creaseShading={0.5}
            fontSize="clamp(3.4rem, 6vw, 5.8rem)"
            fontWeight={580}
            color="#f3f0e8"
          />
        </h2>
        <Link className="close-bridge__top-link" to="/registry">
          Explore registry <Arrow />
        </Link>
      </div>

      <div className="close-bridge__cards">
        {CLOSE_CARDS.map((card) => (
          <Link
            className="close-card scroll-reveal"
            data-close-card={card.kind}
            key={card.kind}
            to={card.href}
          >
            <div className="close-card__image" aria-hidden="true">
              <span className="close-card__image-label">{card.label}</span>
              <img
                className="close-card__icon"
                src={card.icon}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span className="close-card__image-corner">CAVEAT / 10</span>
            </div>
            <div className="close-card__content">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <span className="close-card__action">
                {card.action} <Arrow />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="close-bridge__handoff scroll-reveal" aria-hidden="true" />
    </section>
  );
}

export default function HomeSections() {
  return (
    <>
      <Resolution />
      <SponsorRail />
      <Anatomy />
      <Evidence />
      <Layers />
      <Openness />
      <Close />
    </>
  );
}
