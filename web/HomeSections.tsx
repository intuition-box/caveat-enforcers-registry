/**
 * The homepage past the hero.
 *
 * Structure follows the approved v1 mockup: numbered sections, ruled and
 * unboxed records, Space Mono carrying the technical proof, and one statement
 * per section. The first section is paper because the hero hands over a full
 * frame of it; the page then returns to near-black across a seam cut at the
 * mark's own fold angle, which is the alternation DESIGN.md calls for.
 *
 * Nothing here fabricates a registry record. Enforcer type names and their
 * descriptions are factual; anything that would be live evidence is either
 * marked as an example or reduced to the model itself.
 */
import { Link } from "react-router-dom";

/** Responsive art from the approved asset set, paper- or dark-backed to match. */
function Art({
  name,
  alt,
  ratio,
}: {
  name: string;
  alt: string;
  ratio: string;
}) {
  return (
    <figure className="art" style={{ aspectRatio: ratio }}>
      <picture>
        <source
          media="(max-width: 48rem)"
          srcSet={`/art/${name.replace("desktop", "mobile")}`}
        />
        <img src={`/art/${name}`} alt={alt} loading="lazy" decoding="async" />
      </picture>
    </figure>
  );
}

function Marker({ children }: { children: React.ReactNode }) {
  return <span className="sec__marker">{children}</span>;
}

function Arrow() {
  return <span aria-hidden="true" className="arrow" />;
}

/** 02 — the problem, on the paper the hero hands over. */
function Resolution() {
  return (
    <section className="sec sec--paper" aria-labelledby="sec-resolution">
      <header className="sec__head">
        <Marker>02</Marker>
        <h2 id="sec-resolution">
          Permission code without context is difficult to trust.
        </h2>
      </header>

      <div className="compare">
        <article className="compare__card">
          <p className="mono-label">What the wallet sees</p>
          <p className="compare__addr">0x0465…3B91</p>
          <p className="mono-sub">enforcer · unknown · terms 0x9c4b…</p>
          <p className="compare__body">
            An address, a byte string, and a signature request. Nothing here
            says what the delegate can actually do with the account.
          </p>
        </article>

        <article className="compare__card compare__card--resolved">
          <p className="mono-label">What the registry resolves</p>
          <h3>ERC-20 transfer limit</h3>
          <p className="compare__body">
            Spend up to 500 USDC from this account. No other token, no other
            amount, no expiry change.
          </p>
          <ul className="chips">
            <li>41 supporting</li>
            <li>2 counter</li>
            <li className="chips__verified">Source verified</li>
          </ul>
        </article>
      </div>

      <p className="sec__note">
        Example record — not a live listing. Signals resolve from Intuition once
        the reviewed ontology IDs are configured.
      </p>
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
  return (
    <section className="sec sec--paper" aria-labelledby="sec-anatomy">
      <div className="split split--art">
        <header className="sec__head sec__head--tight">
          <Marker>03</Marker>
          <h2 id="sec-anatomy">
            A caveat enforcer is a rule around an action.
          </h2>
          <p className="sec__lede">
            Every enforcer defines what a delegated account may do, where it may
            act, and the limits it must obey.
          </p>
        </header>
        <Art
          name="constraint-desktop-1600x1100.webp"
          alt="Technical drawing of nested boundaries around a single action."
          ratio="1600 / 1100"
        />
      </div>

      <ol className="anatomy">
        {ANATOMY.map(([title, body], i) => (
          <li key={title}>
            <span className="mono-sub">{String(i + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 04 — the evidence model, stated as a model rather than as invented counts. */
const EVIDENCE = [
  ["Supporting claims", "Attested by accounts"],
  ["Counter-claims", "Open and resolved, counted apart"],
  ["Source provenance", "Verified build and audit"],
  ["Stake behind claims", "Bonded, slashable"],
];

function Evidence() {
  return (
    <section className="sec sec--ink sec--seam" aria-labelledby="sec-evidence">
      <div className="split">
        <div>
          <header className="sec__head sec__head--tight">
            <Marker>04 / 05</Marker>
            <h2 id="sec-evidence">Trust is evidence, not a badge.</h2>
          </header>
          <p className="sec__lede">
            Type, deployment, chain, source, terms schema, evidence, and
            community signal stay separate and inspectable. Supporting claims
            and counter-claims are read side by side — the registry never
            collapses them into a single score.
          </p>
          <Link className="cta cta--ghost" to="/learn">
            Read the evidence model
          </Link>
        </div>

        <ul className="evidence">
          {EVIDENCE.map(([title, sub]) => (
            <li key={title}>
              <span className="evidence__title">{title}</span>
              <span className="mono-sub">{sub}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** 06 — reference enforcer types, carried on their own constraint glyphs. */
const TYPES = [
  [
    "ERC20TransferAmount",
    "Caps how much of one ERC-20 a delegate may move.",
    "amount-limit",
    "Amount limit",
  ],
  [
    "AllowedTargets",
    "Restricts which contract addresses a delegation can call.",
    "target-address",
    "Target address",
  ],
  [
    "AllowedMethods",
    "Restricts which function selectors may be invoked.",
    "callable-method",
    "Callable method",
  ],
  [
    "Timestamp",
    "Binds a delegation to a start and end time.",
    "time-window",
    "Time window",
  ],
];

function Preview() {
  return (
    <section className="sec sec--ink" aria-labelledby="sec-preview">
      <header className="sec__head sec__head--row">
        <div>
          <Marker>06</Marker>
          <h2 id="sec-preview">Explore without leaving the story.</h2>
        </div>
        <Link className="cta cta--ghost" to="/registry">
          Open full registry <Arrow />
        </Link>
      </header>

      <ul className="records">
        {TYPES.map(([name, body, glyph, domain]) => (
          <li key={name}>
            <img
              className="glyph"
              src={`/glyphs/${glyph}-96.png`}
              alt=""
              width={44}
              height={44}
            />
            <span className="records__name">{name}</span>
            <span className="records__body">{body}</span>
            <span className="mono-sub records__domain">{domain}</span>
          </li>
        ))}
      </ul>

      <p className="sec__note">
        Reference types from the ERC-7710 delegation framework. Live records,
        deployments, and signals resolve from Intuition.
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
    "composite-rule",
  ],
  [
    "Layer 01",
    "AllowedTargets",
    "Only the subscription contract may be called.",
    "target-address",
  ],
  [
    "Layer 02",
    "ERC20TransferAmount",
    "A 12 USDC ceiling per redemption.",
    "amount-limit",
  ],
  [
    "Layer 03",
    "Timestamp + Nonce",
    "Twelve windows, revocable in one transaction.",
    "time-window",
  ],
];

function Layers() {
  return (
    <section
      className="sec sec--paper sec--seam-up"
      aria-labelledby="sec-layers"
    >
      <div className="split split--art">
        <header className="sec__head sec__head--tight">
          <Marker>07</Marker>
          <h2 id="sec-layers">Useful permissions work in layers.</h2>
          <p className="sec__lede">
            A monthly subscription is not one rule. It is four, sharing a single
            boundary — and the registry shows why they compose.
          </p>
        </header>
        <Art
          name="composition-desktop-1600x900.webp"
          alt="Layered rules resolving into one composed boundary."
          ratio="1600 / 900"
        />
      </div>

      <ol className="layers">
        {LAYERS.map(([label, title, body, glyph]) => (
          <li key={title}>
            <img
              className="glyph"
              src={`/glyphs/${glyph}-96.png`}
              alt=""
              width={38}
              height={38}
            />
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
  [
    "A claim is written",
    "A contributor lists the enforcer with source, terms schema, and evidence.",
  ],
  [
    "The index resolves it",
    "Deployments across chains collapse into one readable record.",
  ],
  [
    "A wallet queries it",
    "The signature prompt asks the same index the site does.",
  ],
  [
    "The user reads terms",
    "Plain language beside the encoded parameters — no guessing.",
  ],
  [
    "A signature is informed",
    "Simulation runs the composed boundary before approval.",
  ],
];

function Openness() {
  return (
    <section className="sec sec--ink sec--seam" aria-labelledby="sec-open">
      <div className="split">
        <div>
          <header className="sec__head sec__head--tight">
            <Marker>08 / 09</Marker>
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

        <div className="flow">
          <Art
            name="contribution-desktop-1600x900.webp"
            alt="A contributed record entering the index."
            ratio="1600 / 900"
          />
          <p className="mono-label">One record, end to end</p>
          <ol>
            {FLOW.map(([title, body], i) => (
              <li key={title}>
                <span className="mono-sub">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** 10 — the close, on the halftone field. */
function Close() {
  return (
    <section className="sec sec--ink sec--close" aria-labelledby="sec-close">
      <div className="sec__head">
        <Marker>10</Marker>
        <h2 id="sec-close">Choose the next depth.</h2>
      </div>
      <div className="cta-row">
        <Link className="cta cta--solid" to="/registry">
          Explore registry <Arrow />
        </Link>
        <Link className="cta cta--ghost" to="/learn">
          Learn the standard
        </Link>
      </div>
    </section>
  );
}

export default function HomeSections() {
  return (
    <>
      <Resolution />
      <Anatomy />
      <Evidence />
      <Preview />
      <Layers />
      <Openness />
      <Close />
    </>
  );
}
