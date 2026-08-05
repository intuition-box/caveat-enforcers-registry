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
  stage-black: "#0b0b0b"
  signal-orange: "#ff6b3d"
  signal-orange-hover: "#ff825d"
  line-dark: "rgba(243, 240, 232, 0.16)"
  line-light: "rgba(5, 5, 5, 0.18)"
typography:
  hero-offer:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(1.85rem, 3.5vw, 3.3rem)"
    fontWeight: 640
    lineHeight: 1
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(3.4rem, 6vw, 5.8rem)"
    fontWeight: 580
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(2.4rem, 4.5vw, 4.4rem)"
    fontWeight: 580
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  section-title:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 5.2vw, 4.8rem)"
    fontWeight: 590
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  body:
    fontFamily: "DM Sans Variable, DM Sans, sans-serif"
    fontSize: "clamp(1.05rem, 1.45vw, 1.22rem)"
    fontWeight: 400
    lineHeight: 1.6
  interface:
    fontFamily: "DM Sans Variable, DM Sans, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 650
    lineHeight: 1
  field:
    fontFamily: "DM Sans Variable, DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.2
  technical:
    fontFamily: "Space Mono, monospace"
    fontSize: "0.68rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.07em"
  technical-action:
    fontFamily: "Space Mono, monospace"
    fontSize: "0.72rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.035em"
  status:
    fontFamily: "Space Mono, monospace"
    fontSize: "0.64rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.11em"
rounded:
  square: "0"
  product-control: "0.2rem"
  hero-control: "0.375rem"
spacing:
  editorial-frame: "75rem"
  page-pad: "clamp(1.25rem, 3.2vw, 4rem)"
  section-gap: "clamp(3rem, 8vw, 8rem)"
  section-block: "clamp(5.5rem, 8vw, 8rem)"
  control-x: "1.4rem"
components:
  hero-action-solid:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.interface}"
    rounded: "{rounded.hero-control}"
    padding: "0 {spacing.control-x}"
    height: "3.25rem"
  product-action-on-ink:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.technical-action}"
    rounded: "{rounded.product-control}"
    padding: "0 {spacing.control-x}"
    height: "3.25rem"
  product-action-on-paper:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.technical-action}"
    rounded: "{rounded.product-control}"
    padding: "0 {spacing.control-x}"
    height: "3.25rem"
  field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.square}"
    padding: "0.7rem 0"
    height: "3.25rem"
  status-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.status}"
    rounded: "{rounded.product-control}"
    padding: "0.5rem 1rem"
---

# Design System: Caveat Registry

## Overview

**Creative North Star: "Registry Within"**

Registry Within treats the Caveat mark as an instrument of disclosure. The visual world is quiet, physical, and exact: pure black surrounds a monumental matte-white mark, while the mark opens to expose the governed space between its planes. The opening becomes proof, action, and eventually the paper field that carries the product.

The shipped website extends that world through large editorial product chapters. Near-black and archival paper alternate across seams cut at the mark's fold angle. Full-width demonstrations resolve abstract protocol facts into interfaces people can inspect, while continuous ruled sequences keep evidence connected. Registry, detail, submission, learning, and developer routes remain operational and explicit. Registry membership, stake, support, opposition, observed code, and audit claims never become a safety badge.

**Key Characteristics:**

- Monumental Bricolage statements inside a 75rem editorial frame
- Archival paper against near-black, with one Signal Orange
- Large square product stages instead of small card collections
- Continuous ruled sequences for records, evidence, steps, and learning paths
- Space Mono reserved for technical proof, states, and labels
- Caveat-specific imagery tied to each route's job
- One cinematic hero, two authored product reveals, and otherwise still product surfaces
- One shared identity across Home, Registry, Detail, Submit, Learn, and Developers

## Colors

The palette stays intentionally narrow. Ink and archival paper carry the world, deep stage blacks hold product demonstrations, and Signal Orange marks contribution, focus, and active progression.

### Primary

- **Signal Orange:** The only chromatic accent. Use it for contribution, active progress, selection, and keyboard focus.

### Neutral

- **Ink:** The default dark field and primary text on paper.
- **Pure Black:** The cinematic first viewport and deepest field around the Caveat mark.
- **Paper:** The main light field and primary text on dark surfaces.
- **Paper Bright:** The inset filter surface and the brightest control response.
- **Graphite:** Dense secondary structure when Ink would be too absolute.
- **Muted:** Secondary copy, inactive navigation, metadata, and non-critical states.
- **Stage Black:** The inset field for translation, evidence, registry inspection, and contribution demonstrations.
- **Dark Rule:** Hairlines on Ink and Stage Black.
- **Light Rule:** Hairlines on Paper and Paper Bright.

### Named Rules

**The One Signal Rule.** Signal Orange belongs to contribution, active progress, focus, and meaningful selection. Do not use it as decoration or as a safety indicator.

**The Truth Contrast Rule.** Safety caveats and evidence limits must have the same legibility and hierarchy discipline as positive claims. Muting must never hide uncertainty.

**The Black First Rule.** The Home first viewport is pure black so the Caveat mark reads as the singular object. Paper arrives through the mark's own transformation.

## Typography

**Display Font:** Bricolage Grotesque Variable, with Arial Narrow and sans-serif fallbacks

**Body Font:** DM Sans Variable, with DM Sans and sans-serif fallbacks

**Label/Mono Font:** Space Mono, with monospace fallback

**Character:** Bricolage Grotesque gives protocol concepts a monumental, authored voice. DM Sans keeps navigation, forms, records, and explanation calm. Space Mono acts as technical proof, never as a cyber theme.

### Hierarchy

- **Hero Offer:** A compact display statement beneath the opening mark, smaller than route headings so the object remains dominant.
- **Display:** Major route statements and footer declarations, generally limited to 14 characters when copy permits.
- **Section Title:** Home chapter statements, generally limited to 14 to 18 characters.
- **Headline:** Detail sections, route modules, and product proof headings.
- **Body:** Explanations, caveats, and route introductions, generally constrained to 40 to 48 characters.
- **Interface:** Navigation, buttons, form controls, record names, and actions. Keep labels concise and sentence case.
- **Technical:** Chains, IDs, status labels, proof rails, step numbers, and schema notation. Uppercase is reserved for compact metadata.

### Named Rules

**The Three Voices Rule.** Bricolage speaks for meaning, DM Sans speaks for action and explanation, and Space Mono speaks for verifiable detail. Never exchange their roles for novelty.

**The Monument and Proof Rule.** Large type creates authority only when compact technical detail is close enough to substantiate it.

## Layout

The finished system uses a centered 75rem editorial frame. Page padding expands beyond the base inset when the viewport exceeds that frame, so Home chapters, route bands, and the footer share one left and right datum. This is the main spatial invariant.

Home is organized as large product chapters rather than a marketing card grid. Each chapter carries one statement, one explanation, and one major demonstration or continuous sequence. The translation stage, evidence ledger, registry inspector, composition sequence, contribution flow, and closing field occupy the width needed to make the product legible. Paper and Ink sections meet across seams cut at the Caveat mark's 23.6 degree fold.

Product routes use the same frame and demo-led rhythm. Their first band is at least 36rem tall on larger screens and 31rem on small screens. Route headings and summaries form an editorial split, while filters, tables, specs, forms, steppers, code, and learning chapters continue as ruled structures. Registry and detail rows are part of one sequence, not detached cards.

At 60rem, major split layouts collapse to one column. At 48rem, the base inset becomes 1.25rem, product stages stack, tables simplify their columns, steppers become two columns, and the mobile art ratio takes over. Reading order remains statement, evidence, then action.

**The Sparse Record Rule.** Do not fill open fields to make the interface feel busy. Negative space is part of the evidence hierarchy.

**The Continuous Sequence Rule.** Related records, facts, steps, and learning points share one ruled sequence. Do not break them into isolated cards.

**The Detail Continuity Rule.** Deployment detail reuses the route band, proof column, status pill, specification row, and evidence grammar. It must not introduce a separate explorer identity.

## Elevation & Depth

The product system is flat and uses no box shadows. Depth comes from black and paper field changes, one-pixel rules, clipped route imagery, scale, sticky inspection, and the material thickness exposed by the cinematic Caveat mark. Large stages use a single border and a deeper black rather than floating above the page.

The cinematic hero owns one directed motion sequence. The mark draws and fills once, separates on scroll, exposes governed rules, carries its actions in the opening, moves one plane into the header, and transforms the other into the next paper field. Reduced-motion visitors receive the resolved state without the ornamental depth passes.

Below the hero, authored reveal motion is limited to two product demonstrations: the address-to-record translation and the registry inspector. Their children rise by 1.6rem with 720ms opacity and 820ms transform timing, while stage imagery can settle from a 1.035 scale over 1100ms. All ordinary sections and product routes remain immediately legible and still. Hover, focus, menu, loading, and active-row transitions are compact interface feedback, not narrative animation.

### Named Rules

**The Flat Evidence Rule.** Records rest on the page plane. Use rules, inset stages, and tonal changes to separate them, never ambient card shadows.

**The Two Demonstrations Rule.** Outside the cinematic hero, only the translation stage and registry inspector receive authored entry motion. New sections do not inherit reveal animation by default.

**The No Glass Rule.** Do not add translucent decorative panels, glowing borders, or layered glass cards. Header blur is permitted only when the header needs contrast over the cinematic field.

## Shapes

The form language is primarily rectilinear. Product stages, route bands, fields, tables, record sequences, and evidence ledgers use square edges. Product actions and status pills have a tight 0.2rem radius. Hero actions are slightly softer at 0.375rem because they live inside the cinematic opening. Circular marks are limited to evidence nodes, state dots, and diagram endpoints.

The folded Caveat mark is the system's governing geometry. Its 23.6 degree fold determines section seams, spatial movement, boundary imagery, and the relationship between separated planes. Constraint glyphs are square technical illustrations that identify rule families without becoming decorative icons.

**The One Symbol Rule.** Use the Caveat mark and its fold as instruments of boundary and disclosure. Do not surround them with unrelated shields, locks, chains, coins, or generic crypto networks.

## Components

### Buttons

- **Hero Actions:** Paper or Pure Black with a 0.375rem radius and 3.25rem height. They belong inside the cinematic opening.
- **Product Actions:** Paper on Ink or Ink on Paper, with a 0.2rem radius, monospaced label, and 3.25rem height.
- **Ghost Actions:** Transparent with a restrained field-colored border. They invert on hover.
- **Hover / Focus:** Lift by 2px on hover and use a 2px Signal Orange focus outline with a 4px offset.
- **Signal Use:** Signal Orange does not fill routine buttons. It marks focus, contribution state, and active progression.

### Inputs / Fields

- **Style:** Transparent, square, full-width controls with one Light Rule beneath the value.
- **Containers:** Registry filters sit inside a single Paper Bright frame. Submission fields remain directly on Paper.
- **Focus:** Replace the bottom rule with Signal Orange and do not add a glow.
- **Disabled / Error:** Preserve readable contrast and use explicit adjacent copy. Do not rely on color alone.

### Status Pills

Status pills use Space Mono, uppercase metadata, a one-pixel outline, and a tight 0.2rem radius. Their state dot may be filled or open. Observed, review, support, opposition, and missing deployment remain descriptive states, never trust scores.

### Navigation

The header is 5rem tall on larger screens and 4.5rem on mobile. Brand typography uses Bricolage while route labels use DM Sans in Muted. Hover and active states move to Paper and draw one underline. On Home, the header is handed off from the moving mark. On product routes, it is immediately present. Mobile navigation opens as a full-width Ink list below the header.

### Large Product Stages

Translation, evidence, registry inspection, contribution flow, and code proof are inset product stages with square edges, one border, and no shadow. A narrow monospaced bar can label the stage. Internal regions are separated by continuous rules. Code proof uses Ink rather than introducing a separate developer palette. Each stage demonstrates one product truth at readable scale.

### Registry and Specification Rows

Registry rows, evidence items, specification facts, submission steps, and learning points form continuous sequences. Strong names use Bricolage or DM Sans, metadata uses Space Mono, and every row shares the parent field. Support and opposition remain separate. A future record must never compress evidence into one trust score.

### Record Inspector

The Home registry inspector pairs a continuous list with a sticky Paper detail pane. The active row gains one Signal Orange rule and the pane resolves its glyph, purpose, terms, chain evidence, and caveat. On narrower screens the pane stacks beneath the list and loses stickiness.

### Route Imagery

Route images are specific to the job of the page. Registry crops the Caveat channel behind search context. Submit shows the boundary opening to receive a record. Learn shows permission resolving into proof. Developers reuses the composition system to show one record across surfaces. Home uses constraint, composition, and contribution masters at product-stage scale. Images are darkened or contained so interface text remains dominant, and responsive assets preserve intentional mobile crops.

### Caveat Mark and Glyphs

The Caveat mark appears as the cinematic object, as a drawn header handoff, and as a compact navigation or footer signature. Home alone may extend its lower plane into a ruled road and place the low-poly car as a demonstration of movement without a boundary. Constraint and status glyphs appear at functional sizes inside rows and inspectors. None of these elements becomes a repeating background pattern or a route-level motif.

## Do's and Don'ts

### Do:

- **Do** align every major route and Home chapter to the 75rem editorial frame.
- **Do** use large product stages and continuous ruled sequences to explain connected evidence.
- **Do** reserve Signal Orange for contribution, active progress, focus, and meaningful selection.
- **Do** state that registry membership is a listing fact, not a safety verdict, wherever that distinction affects a decision.
- **Do** use Bricolage for meaning, DM Sans for action and explanation, and Space Mono for proof.
- **Do** separate source, release, terms schema, chain availability, support, opposition, and evidence claims so each remains inspectable.
- **Do** use Caveat-specific imagery with responsive desktop and mobile crops.
- **Do** keep ordinary route surfaces still and honor reduced-motion preferences.

### Don't:

- **Don't** use gradients, decorative glass, ambient shadows, or glow as atmosphere.
- **Don't** use generic crypto networks, orbiting nodes, shields, locks, coins, or chain-link decoration.
- **Don't** turn membership, stake, support, opposition, observed code, an audit claim, or Signal Orange into a safety badge.
- **Don't** split one ruled sequence into a grid of detached rounded cards.
- **Don't** animate ordinary sections beyond the two documented product demonstrations.
- **Don't** use Space Mono as a theme. It is reserved for technical proof.
- **Don't** duplicate the cinematic Caveat hero on ordinary product routes.
