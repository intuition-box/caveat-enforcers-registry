# Visual Asset Manifest

This directory contains production-sized visual assets for the Caveat Enforcers Registry experience.

## Art

| File                                                |  Dimensions | Placement                                          | Responsive behavior                                                                                                                                             |
| --------------------------------------------------- | ----------: | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `art/hero-registry-within-v1-desktop-1672x941.webp` |  1672 × 941 | Approved Home hero                                 | Full-bleed black hero. Keep the mark centered and overlay concise copy in the lower central field. Mobile reuses the same wide source with controlled overflow. |
| `art/hero-desktop-1920x1080.webp`                   | 1920 × 1080 | Full-bleed Home hero                               | Use above 768 px. Overlay the hero copy in the quiet left region.                                                                                               |
| `art/hero-mobile-1080x1350.webp`                    | 1080 × 1350 | Full-bleed Home hero                               | Use at 768 px and below. Keep copy inside the upper-left safe region.                                                                                           |
| `art/hero-centered-v2-desktop-1920x1080.jpg`        | 1920 × 1080 | Rejected exploration                               | Do not implement. The circuit field is too dense and competes with the hero copy.                                                                               |
| `art/hero-centered-v2-mobile-1080x1350.jpg`         | 1080 × 1350 | Rejected exploration                               | Do not implement. Retained only as iteration history.                                                                                                           |
| `art/hero-open-fold-v1-desktop-1920x1080.webp`      | 1920 × 1080 | Open Fold desktop candidate                        | Oversized Caveat mark architecture, widened central headline field, and one restrained signal line. Awaiting visual approval before mobile adaptation.          |
| `art/constraint-desktop-1600x1100.webp`             | 1600 × 1100 | Home explanation and Detail header                 | Render inside a split section. Do not stretch full width on Home.                                                                                               |
| `art/constraint-mobile-1080x1080.webp`              | 1080 × 1080 | Mobile explanation                                 | Place below the explanatory copy.                                                                                                                               |
| `art/registry-header-desktop-2000x600.webp`         |  2000 × 600 | Registry header band                               | Keep shallow. The searchable interface must remain the dominant element.                                                                                        |
| `art/registry-header-mobile-900x360.webp`           |   900 × 360 | Mobile Registry header                             | Use as a compact header crop. Do not place it behind record text.                                                                                               |
| `art/composition-desktop-1600x900.webp`             |  1600 × 900 | Composition explanation                            | Static fallback for the responsive motion diagram.                                                                                                              |
| `art/composition-mobile-1080x1350.webp`             | 1080 × 1350 | Mobile composition explanation                     | Use as a vertical reading sequence.                                                                                                                             |
| `art/contribution-desktop-1600x900.webp`            |  1600 × 900 | Submit header and Home contribution call to action | On Home, show only a shallow background crop.                                                                                                                   |
| `art/contribution-mobile-1080x1080.webp`            | 1080 × 1080 | Mobile contribution call to action                 | Place beneath copy or use a shallow center crop.                                                                                                                |
| `art/learning-desktop-1600x1100.webp`               | 1600 × 1100 | Learn page and Detail anatomy                      | Use as the primary Learn illustration and a slim Detail banner.                                                                                                 |
| `art/learning-mobile-1080x1350.webp`                | 1080 × 1350 | Mobile Learn anatomy                               | Reveal layers in vertical order.                                                                                                                                |

## Constraint glyphs

Constraint glyphs are available at 24, 48, and 96 pixels in `icons/constraints/`.

The set contains:

- `token`
- `target-address`
- `amount-limit`
- `time-window`
- `recipient`
- `callable-method`
- `protocol`
- `network`
- `frequency`
- `ownership`
- `approval`
- `composite-rule`

Use 24 px in records, filters, and compact controls. Use 48 px in learning navigation. The 96 px files are source-sized presentation variants.

## Status glyphs

Status glyphs are available at 24, 48, and 96 pixels in `icons/status/`.

The set contains:

- `verified`
- `pending-review`
- `missing-deployment`
- `counter-signal`

Always pair a status glyph with a visible text label. Color must not carry status meaning alone.

## Texture

`textures/halftone-tile-512.webp` is a low-contrast atmospheric texture. Use it sparingly on empty dark surfaces at low opacity. Omit it behind record lists, forms, code, and dense mobile interfaces.

## Color roles

| Color              | Value     | Role                                                        |
| ------------------ | --------- | ----------------------------------------------------------- |
| Ink                | `#0A0A0A` | Primary dark surface and structural linework                |
| Paper              | `#F3F0E8` | Primary light surface and text on dark surfaces             |
| Graphite           | `#2A2927` | Secondary structure and quiet dividers                      |
| Signal orange      | `#FF6B3D` | Permitted action, contribution, and primary action emphasis |
| Relationship lilac | `#A99BFF` | Composition and relationship paths                          |
| Verification mint  | `#A9E5C2` | Verified records and positive evidence                      |

Use flat colors only. Do not introduce decorative gradients.

## Home visual budget

The Home page should contain one dominant hero, one medium constraint illustration, one real Registry interface preview, one composition diagram, one shallow contribution crop, and one small glyph family. Larger artwork belongs on its dedicated product or learning page.

## Source sheets

`sources/constraint-glyphs-source.webp` and `sources/status-glyphs-source.webp` preserve the high-resolution glyph families used to create the production icon sizes.

`sources/hero-open-fold-v1-source.png` preserves the original generated Open Fold desktop candidate before export.

`sources/hero-registry-within-v1-source.png` preserves the approved Registry Within hero source before WebP export.

## Review sheets

`preview/art-contact-sheet.png` and `preview/glyph-contact-sheet.png` provide quick visual checks of the complete families. They are review files and should not be loaded by the application.
