---
name: Caveat Registry
description: A public record system that makes delegation boundaries inspectable without turning membership into a safety claim.
colors:
  ink: "#050505"
  pure-black: "#000000"
  paper: "#f3f0e8"
  paper-bright: "#fffefa"
  graphite: "#292927"
  muted: "#a7a49d"
  signal-orange: "#ff6b3d"
  signal-orange-hover: "#ff825d"
  line-dark: "rgba(243, 240, 232, 0.16)"
  line-light: "rgba(5, 5, 5, 0.18)"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(3.8rem, 7vw, 7.2rem)"
    fontWeight: 640
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(2.4rem, 4vw, 4.2rem)"
    fontWeight: 640
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(1.8rem, 3vw, 3rem)"
    fontWeight: 640
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "DM Sans Variable, DM Sans, sans-serif"
    fontSize: "clamp(1.02rem, 1.4vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.62
  interface:
    fontFamily: "DM Sans Variable, DM Sans, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 650
    lineHeight: 1.2
  technical:
    fontFamily: "Space Mono, monospace"
    fontSize: "0.68rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.07em"
rounded:
  formula: "0.3em"
  control: "0.85rem"
  proof: "1rem"
spacing:
  page-pad: "clamp(1.25rem, 3.2vw, 4rem)"
  section-gap: "clamp(3rem, 8vw, 9rem)"
  section-block: "clamp(6rem, 10vw, 10rem)"
  control-x: "1.2rem"
  control-y: "0.88rem"
components:
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.ink}"
    typography: "{typography.interface}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.signal-orange-hover}"
    textColor: "{colors.ink}"
    typography: "{typography.interface}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "3.25rem"
  button-quiet:
    backgroundColor: "rgba(5, 5, 5, 0.58)"
    textColor: "{colors.paper}"
    typography: "{typography.interface}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "3.25rem"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.interface}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "3.25rem"
---

# Design System: Caveat Registry

## Overview

**Creative North Star: "Registry Within"**

Registry Within treats the Caveat mark as an instrument of disclosure. The visual world is quiet, physical, and exact: pure black surrounds a monumental matte-white mark, while sparse record particles become visible inside its diagonal channel. A single orange record represents contribution, the act that keeps the registry open.

The broader product alternates between near-black and warm paper surfaces. Persuasive moments can be immersive, but registry, submission, learning, developer, and future deployment detail surfaces remain legible and operational. The system communicates public evidence with restraint. It must never make registry membership, stake, support, or an audit claim feel like a safety badge.

**Key Characteristics:**

- Monumental display type and generous negative space
- Warm paper against near-black, with no intermediate decorative atmosphere
- Thin rules and compact monospaced annotations as technical proof
- Signal Orange reserved for contribution and the strongest action
- A flat, editorial product language that separates facts instead of decorating them
- One shared identity across Home, Registry, Submit, Learn, Developers, and deployment detail

## Colors

The palette is deliberately narrow: archival paper and near-black carry the product, Graphite and muted neutrals organize evidence, and Signal Orange marks contribution or a decisive action.

### Primary

- **Signal Orange:** The only chromatic accent. Use it for contribution records, primary actions, selection, and keyboard focus.

### Neutral

- **Ink:** The default dark surface and primary text on paper.
- **Pure Black:** Reserved for the first viewport and the deepest image field around the Caveat mark.
- **Paper:** The default light surface and primary text on dark surfaces.
- **Paper Bright:** A brighter reserve for small high-contrast details, not a competing page background.
- **Graphite:** A dense secondary neutral for supporting structure and future dark tonal separation.
- **Muted:** Secondary text, quiet navigation, metadata, and non-critical labels.
- **Dark Rule:** Dividers on Ink.
- **Light Rule:** Dividers on Paper.

### Named Rules

**The One Signal Rule.** Signal Orange belongs to contribution, primary action, focus, and meaningful selection. Do not use it as decoration or as a safety indicator.

**The Truth Contrast Rule.** Safety caveats and evidence limits must have the same legibility and hierarchy discipline as positive claims. Muting must never hide uncertainty.

**The Black First Rule.** The Home first viewport is pure black so the matte-white Caveat mark reads as the singular object. Warm paper begins only after that immersive opening.

## Typography

**Display Font:** Bricolage Grotesque Variable, with Arial Narrow and sans-serif fallbacks

**Body Font:** DM Sans Variable, with DM Sans and sans-serif fallbacks

**Label/Mono Font:** Space Mono, with monospace fallback

**Character:** Bricolage Grotesque gives the registry a monumental, authored voice without losing utility. DM Sans keeps navigation, actions, and explanations calm. Space Mono is technical proof, not a cyber aesthetic.

### Hierarchy

- **Display:** Heavy page statements and major route headings, balanced to compact line lengths near 12 to 13 characters where the copy allows.
- **Headline:** Registry states, section declarations, and the strongest explanatory statements beneath a page heading.
- **Title:** Sequence steps, record titles, learning modules, and developer proof headings.
- **Body:** Explanations and caveats, generally constrained to 67 characters for readable evidence review.
- **Interface:** Navigation, buttons, and text actions. Keep labels concise and sentence case.
- **Technical:** Chain data, status labels, schema notation, protocol references, and proof rails. Uppercase is permitted only for compact metadata.

### Named Rules

**The Three Voices Rule.** Bricolage speaks for meaning, DM Sans speaks for action and explanation, and Space Mono speaks for verifiable detail. Never exchange their roles for novelty.

**The Monument and Proof Rule.** Large type creates authority only when compact technical detail is close enough to substantiate it.

## Layout

The site uses a fluid page inset and wide two-column editorial grids. Major headings occupy the larger column while summaries, caveats, and actions sit in a narrower proof column. Section gaps are intentionally large so each fact group reads as an independent record rather than a dense dashboard tile.

The Home first viewport fills at least the screen height, places the Caveat mark as the primary object, centers the offer in the lower field, and closes with a thin technical proof rail. This is a Home expression, not a template for every route.

At widths up to 760px, every major grid collapses to one column. Navigation becomes a full-width disclosure below the header, paired actions stack, record metadata remains grouped, and oversized headings reduce without losing their compressed line-height. Preserve the reading order from meaning to evidence to action.

**The Sparse Record Rule.** Do not fill open fields to make the interface feel busy. Negative space is part of the evidence hierarchy.

**The Detail Continuity Rule.** A future deployment detail page must reuse the established heading, proof-column, rule, metadata, and action grammar. It must not introduce a separate explorer or dashboard identity.

## Elevation & Depth

The system is flat by default and uses no box shadows. Depth comes from black and paper field changes, fine divider lines, clipping, scale, and the physical lighting already present in the Caveat hero artwork. Header blur is a functional readability treatment over the immersive first viewport, not a decorative glass surface.

Motion is restrained and stateful. The hero settles once with a soft scale and blur reduction. Copy rises into place after the object appears. Hover motion is limited to a 2px lift or a directional arrow shift, with fast state transitions and a slower decisive easing for spatial movement.

### Named Rules

**The Flat Evidence Rule.** Records rest on the page plane. Use rules and tonal changes to separate them, never ambient card shadows.

**The No Glass Rule.** Do not add translucent decorative panels, glowing borders, or layered glass cards. The only backdrop blur belongs to the global header when readability requires it.

## Shapes

The form language combines large rectilinear fields with gently softened interactive controls. Buttons use a compact rounded rectangle, proof blocks use a slightly larger radius, and formula tokens use a radius proportional to their type size. Record lists, navigation, and editorial sections remain ruled and unboxed.

The Caveat mark is the only recurring symbolic silhouette. Its diagonal channel can contain sparse record particles or reveal information, but it must not become a generic network graph, token constellation, or decorative pattern library.

**The One Symbol Rule.** Use the Caveat mark as an instrument of boundary and disclosure. Do not surround it with unrelated shields, locks, chains, nodes, or crypto iconography.

## Components

### Buttons

- **Shape:** Gently rounded rectangle with a 3.25rem minimum height.
- **Primary:** Signal Orange with Ink text. Use for the strongest route action and contribution-related progression.
- **Hover / Focus:** Lift by 2px on hover, brighten the orange once, and use a 2px Signal Orange focus outline with a 4px offset.
- **Quiet:** Transparent dark fill with a visible Paper border on dark imagery. It may invert to Paper on hover.
- **Dark:** Ink fill with Paper text on light surfaces for a strong non-contribution action.

### Cards / Containers

- **Corner Style:** Records and content sections are not cards. Keep them square and separated by rules.
- **Background:** Use the page field directly, either Ink or Paper.
- **Shadow Strategy:** None.
- **Border:** One-pixel Light Rule or Dark Rule depending on the field.
- **Internal Padding:** Use generous vertical rhythm, typically 2rem for records and larger fluid spacing for page sections.

### Navigation

The header is 5rem tall on larger screens and 4.5rem on mobile. Brand typography uses Bricolage, while route labels use DM Sans in Muted. Hover and active states move to Paper and draw a single underline. The mobile menu opens as a full-width Ink list beneath the header, not as a floating sheet.

### Registry Rows

Each row is a ruled record with description on the left and explicit metadata on the right. Metadata labels use Space Mono and must identify what a signal means. Support and opposition remain separate when both are available. A row or future detail page must never compress multiple forms of evidence into one trust score.

### Technical Proof

Proof rails, chain metadata, formulas, and code examples use Space Mono sparingly. Code containers sit on a dense black field with a single rule and no glow. The technical layer should make sources, IDs, states, and relationships easier to verify.

### Caveat Mark

The brand mark appears compactly in navigation and monumentally on Home. In the hero, the matte-white form reveals sparse white record particles inside its diagonal channel. Exactly one Signal Orange record represents contribution. Keep the composition calm and materially believable.

## Do's and Don'ts

### Do:

- **Do** reserve Signal Orange for contribution, the strongest action, focus, and meaningful selection.
- **Do** state that registry membership is a listing fact, not a safety verdict, wherever that distinction affects a decision.
- **Do** use large Bricolage statements beside concise DM Sans explanation and Space Mono proof.
- **Do** separate source, release, terms schema, chain availability, support, opposition, and evidence claims so each remains inspectable.
- **Do** preserve the same visual grammar across Home, Registry, Submit, Learn, Developers, and deployment detail.
- **Do** keep desktop and mobile compositions spacious, ordered, and explicit.

### Don't:

- **Don't** use gradients, decorative glass, ambient shadows, or glow as atmosphere.
- **Don't** use generic crypto networks, orbiting nodes, shields, locks, coins, or chain-link decoration.
- **Don't** turn membership, stake, support, an audit claim, or Signal Orange into a safety badge.
- **Don't** place every section inside a rounded card or detach records from the page with shadows.
- **Don't** use Space Mono as a theme. It is reserved for technical proof.
- **Don't** duplicate the monumental Caveat hero treatment on ordinary product pages.
