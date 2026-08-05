# Homepage — Creative Script

Status: **proposed**. This is the design pass, not the build. Nothing here is
code. When a beat is approved it moves into `web/` and gets referenced back to
the beat number in this file.

---

## The argument

The page has to prove one thing, in order:

> You are asked to sign permissions you cannot read. A caveat is the rule that
> bounds one. This registry makes those rules legible — and keeps the evidence
> about them separable, so nothing here becomes a safety badge.

Everything below serves that sentence. If a beat does not advance it, the beat
is decoration and should be cut.

---

## The laws

Five rules the whole page obeys. They are what make it feel authored rather than
assembled.

**1. One continuous surface.** The page is not a stack of sections with
transitions between them. It is one object that keeps changing state — drawn,
split, opened, travelled, resolved. The mark never leaves and is never
re-introduced. This is the single strongest thing we have and it is the
difference between this and a template.

**2. 23.6° is law.** The mark's own fold angle, measured off the traced paths.
Every diagonal on the page is this angle: the split axis, the exposed thickness,
the road, the seam between paper and ink. No other diagonal is permitted.

**3. Monochrome.** Paper and ink. No accent colour anywhere, including status.
State is carried by **shape** — filled versus hollow, solid versus hairline —
never by hue. This is not only taste: a green "verified" pip reads as _green
means safe_, which is exactly the trust badge the product refuses to issue.

**4. Weight.** Nothing on this page snaps. Heavy things arrive a beat after the
scroll that moved them, and they overshoot by a hair. Motion is a physical
consequence, never an effect. If it could be described as "a nice animation", it
is wrong.

**5. Nothing is invented.** No fabricated record, count, or signal appears on the
page. Enforcer names and descriptions are factual. Anything illustrative is
labelled as illustrative. The page's own argument dies if we fake the evidence.

---

## The script

Nine beats. Scroll cost is given in viewport heights (vh) so the total length is
honest and reviewable.

---

### 00 — THE OBJECT

`black · time-based · ~2.4s · no scroll cost`

**State.** Pure black. Nothing else on screen.

**Motion.** The mark strokes itself in, outline first, two paths staggered. The
fill arrives under the finished outline. The offer rises into place beneath it.

**Copy.**

> Open registry for delegation rules.
> Discover, inspect, and contribute ERC-7710 caveat enforcers through one shared
> source of truth.

**Why.** Before anything is claimed, the object is _drawn_ rather than placed.
The first thing the visitor learns is that this thing was made with care. Plays
once per session.

---

### 01 — THE SPLIT

`black · pinned · 0 → 46% of the hero pin`

**State.** The mark, monumental, centred.

**Motion.** It comes apart along the axis perpendicular to its own fold. The
inner edges reveal stepped thickness — the flat sheet was a solid all along.

**Why.** The material change and the concept land in the same gesture. You do
not animate a texture; you separate an object and learn what it was made of.

---

### 02 — THE GAP

`black · pinned · 46 → 66%`

**State.** The two planes held apart. Seven rules span the opening under
tension, tick-marked, with `caveat` seated in a bay in the middle of them.

**Motion.** Rules stretch and hold. The two actions ride _inside_ the opening
the mark has made.

**Copy.** `caveat` · Explore the registry · Understand caveats

**Why.** This is the definition, stated visually before it is stated in words: a
caveat is not absence, it is the rule _between_ two parties. The gap is
governed, not empty. Putting the actions inside it means the first thing you can
click is standing in the concept.

---

### 03 — THE HANDOFF

`black · pinned · 66 → 86%`

**State.** The upper plane leaves.

**Motion.** It lifts, shrinks and lands in the header's brand slot — measured,
not guessed. At the moment it lands the header takes ownership and the lower
half strokes itself in beneath it, the same gesture the page opened with. The
bar materialises _after_ the plane has landed, never under it.

**Why.** Whole → split → whole again, smaller. The nav does not fade in on a
timer; the mark _arrives_ there. The site's chrome is built out of the thing you
just watched.

---

### 04 — THE ROAD

`black · pinned · travel · ~340vh` — **the centrepiece**

**State.** The lower plane, alone on black, receding to the upper right at 23.6°.
Its straight edge is the far shoulder; its swept edge is the near one. Black
above and below. It is not like a road; at this scale it _is_ one.

**Motion.** Vertical scroll becomes travel along the diagonal — the world slides
down-left, so you move up-right into depth. A solid black marble rolls the road:
rotation is distance over radius, with a contact patch that spreads with speed
and tightens at rest. Three layers move at three speeds — far marks drift, the
road carries, the near shoulder races.

**The stations.** The rails clamp inward at each enforcer. Each clamp carries
its constraint glyph as a paper stamp, the real enforcer name, and one plain
line:

|         |                               |                                                                                           |
| ------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| open    | _Unconstrained_               | A delegation with no caveats can do anything the account can.                             |
| clamp 1 | `AllowedTargetsEnforcer`      | Only these contracts may be called.                                                       |
| clamp 2 | `ERC20TransferAmountEnforcer` | No more than this much may move.                                                          |
| clamp 3 | `TimestampEnforcer`           | Only inside this window.                                                                  |
| narrow  | _Composed_                    | Three independent rules, one lane. The exact boundary.                                    |
| refusal | _Reverted_                    | An execution outside the boundary does not fail late. It is refused before state changes. |

**Why.** The lane width **is** the permission surface. This single move explains
what an enforcer is, why enforcers compose, and — in the last beat — that the
whole point is refusal. It is the argument of the product, told once, physically.
The narrowing doubles as perspective taper, which is why it reads as distance
rather than as a diagram.

**Note.** Because the road is depth and not incline, the marble holds a constant
screen size while the lane tapers around it. Levelling the road to horizontal
would flatten it into a stripe — do not.

---

### 05 — THE RESOLUTION

`paper · static · ~1 screen`

**State.** The road completes into paper. The page's first light surface.

**Content.** Two cards, side by side. Left: what the wallet sees — an address, a
byte string, a signature request. Right: what the registry resolves — a title, a
sentence of plain language, its signals.

**Copy.**

> Permission code without context is difficult to trust.

**Why.** Having just watched the boundary being formed, you are shown the same
permission twice: once unreadable, once readable. The comparison only works
_after_ the road, which is why it sits here and not earlier. Labelled as an
example, because it is one.

---

### 06 — THE EVIDENCE

`ink · seam at 23.6° · ~1 screen`

**Copy.**

> Trust is evidence, not a badge.

**Content.** Four signals held apart on their own ruled rows — supporting
claims, counter-claims, source provenance, stake — each with what it actually
means, and no score anywhere.

**Why.** The most important promise on the site. Presented as structure rather
than as numbers, because we do not have the numbers and would not collapse them
if we did.

---

### 07 — THE INDEX

`ink · ~1 screen`

**Copy.**

> Explore without leaving the story.

**Content.** Reference enforcer types on hairline rows, each carrying its
constraint glyph as a paper stamp on the black, its real name, its purpose, and
its constraint domain. One action out to the full registry.

**Why.** The argument has been made; now show the thing. The glyph stamps tie
the index back to the road — the same marks that clamped the lane.

---

### 08 — THE OPENING

`ink · ~1 screen`

**Copy.**

> The registry stays open.

**Content.** Why a missing enforcer is a listing and not a dead end, beside one
record end to end: a claim is written → the index resolves it → a wallet queries
it → the user reads terms → a signature is informed.

**Why.** Openness is the product's actual claim to legitimacy. It earns its place
last, once the reader has a reason to care.

---

### 09 — THE CLOSE

`ink · halftone · short`

**Copy.**

> Choose the next depth.

Two actions. Nothing else.

---

## Motion grammar

The reusable rules, so later work matches without being redesigned.

- **Lag.** Scroll-driven values ease toward their target at ~0.16 per frame.
  Heavy things arrive late; light things track.
- **Ease.** Smoothstep for state changes. No bounce, ever.
- **Reveal.** Things are _drawn_ or _uncovered_, never faded in from nothing.
  Opacity alone is the weakest possible transition and is reserved for text.
- **Reversal.** Every scroll-driven state is a pure function of progress, so
  scrubbing back up unwinds exactly. No booleans that latch.
- **Type.** Bricolage for meaning, DM Sans for action and explanation, Space Mono
  for verifiable detail. Never exchanged for novelty.

---

## Colour and status law

- Paper `#f3f0e8`, ink `#050505`, pure black for the first viewport, muted for
  secondary text. Nothing else.
- Status is shape: **filled** dot = observed, **hollow** dot = under review,
  **struck** = counter-signalled.
- Focus rings are high-contrast paper or ink, not an accent.
- This voids the One Signal Rule in `DESIGN.md`, which must be rewritten before
  this ships. It also changes Codex's eyebrow dots and active nav.

---

## Performance budget

Non-negotiable, because the whole thing is scroll-driven.

- **No canvas, no WebGL, no physics engine.** Everything is SVG geometry plus
  transforms and opacity.
- One `requestAnimationFrame` loop for the whole page, shared.
- Two pinned ScrollTriggers total — the hero and the road. Not one per section.
- Transforms only on composited properties. No layout thrash in a scroll handler.
- Target: 60fps on a four-year-old laptop. If a beat cannot hold that, the beat
  gets simpler, not the frame rate lower.

---

## Reduced motion

Not an afterthought and not a blank page. With `prefers-reduced-motion`:

- The mark is drawn already, filled, static.
- The split is shown at its open state with the rules visible — the concept
  survives without the movement.
- The road is presented as a single static frame at the narrowed lane, with all
  station labels shown at once.
- Everything else is the same page.

---

## What this is not

Written down because these are the failure modes we have already walked into
once each.

- Not a particle field. The aperture version made the mark an _absence_; it was
  cut for that reason.
- Not a stack of animated sections. One surface, changing state.
- Not a diagram. The road must read as depth, not as an explainer graphic.
- Not colour-coded. See the status law.
- Not a trust score. Ever.

---

## Total length

Roughly **9–10 screens** of scroll: ~2.6 pinned in the hero, ~3.4 pinned in the
road, then five conventional sections. That is long for a homepage and it is a
deliberate trade — the first two-thirds are a single continuous argument. If it
needs to come down, the road's station spacing is the cheapest thing to tighten.

---

## Open decisions

1. **The road's ending.** Does the lane complete into full paper and hand off to
   beat 05, or does the page continue on black from the band? Beat 05 currently
   assumes paper.
2. **Real addresses.** Codex's `data/metamask-v1.3.0.json` has 32 enforcers with
   real on-chain addresses. Do the road's stations show them, or stay on names
   and plain language only?
3. **DESIGN.md.** It still describes the deleted particle hero and the One Signal
   Rule. It needs rewriting to this script before either is authoritative.

---

## Reference

The one useful outside note: the strongest current work in this register wins on
_continuity_ rather than on effects — By-Kin and Immersive Garden's 2025 work
both read as a single surface with weighted scroll rather than as a sequence of
tricks. That is the same bet this script makes, and it is why law 1 is law 1.
