# Caveat Enforcers Brand Direction

Status: working direction for the website rebuild

## Creative premise

### Boundary Atlas

The product is a map of permission boundaries. Every enforcer is a rule with a location, a scope, a source, and a confidence signal. The visual system should make those relationships feel navigable rather than decorative.

The public landing page introduces the idea. The working surfaces let a user browse, inspect, compare, compose, submit, and attest.

## Local creative intelligence rules

1. Learn hierarchy, rhythm, spacing, color logic, type behavior, and image relationships from references. Do not copy a reference composition or brand asset.
2. Keep one stable shell and let the content create variation. A detail page should not feel like a duplicate landing page.
3. Read the visual field first. Use focal points, negative space, depth, and a clear signal path before adding decoration.
4. Recommend the next useful action. A user should always know whether to browse, inspect evidence, compare a relationship, or submit a new record.
5. Let feedback change the direction. Composability signals, support, and dispute should have visible consequences in the interface.

## Brand kit

### Palette

| Token         | Value     | Role                                                       |
| ------------- | --------- | ---------------------------------------------------------- |
| Carbon        | `#101111` | Main canvas and navigation shell                           |
| Graphite      | `#171918` | Panels, rows, and working surfaces                         |
| Chalk         | `#F1F1E9` | Primary text and high-confidence content                   |
| Signal        | `#D9FF54` | Active state, verified path, and primary action            |
| Trust blue    | `#73B9FF` | Support, developer information, and neutral network status |
| Counter coral | `#FF8477` | Dispute, conflict, and caution state                       |
| Ash           | `#9D9E97` | Secondary copy and context                                 |

Signal colors communicate state. They are not decoration or a substitute for evidence.

### Typography

- Display: Space Grotesk Variable, with a sharp open lowercase and strong numeric forms.
- Body: Inter Variable at a calmer reading width.
- Data: IBM Plex Mono for addresses, term IDs, chain IDs, codec fields, and stake values.
- Type scale: oversized editorial statement on the landing page, compact operational hierarchy inside the app.

### Mark

The mark is a central point held inside two incomplete boundaries. It should work as a small monochrome favicon, a lime active state, and a one-color downloadable lockup. The open gaps indicate that a permission boundary is inspectable and extensible, not a sealed badge.

Build the production mark as a canvas or raster asset from the approved geometry. Do not use a decorative logo that looks like a generic blockchain cube or shield.

### Image and motion language

- Primary visual: an original boundary field with a clear center, sparse orbit lines, and evidence nodes.
- Motion: slow orbital movement in the landing concept, direct transform and opacity transitions in the app, and short signal pulses for state changes.
- Interaction: pointer movement reveals depth in the boundary field; selecting a relationship brings only its connected evidence forward.
- Downloadable assets: favicon, square mark, social card, and a small loop only when it communicates a registry state. Prefer a lightweight canvas or CSS loop over a heavy GIF.
- Avoid: generic neon gradients, glass panels, random stock imagery, repetitive card walls, and motion that delays a user from reading a claim.

### Local asset kit

The first local asset pass is intentionally small and reusable:

- `public/assets/caveat-mark.svg`: open-boundary mark for the navigation and favicon.
- `public/assets/boundary-atlas-hero.webp`: optimized hero field with a clear signal path and negative space for copy.
- `public/assets/permission-anatomy.webp`: optimized explanatory visual for the relationship between a base rule, context, signal, and supporting evidence.

The artwork is grayscale-first with Signal used only for the active permission path. It can sit behind the interface without competing with claims, addresses, or transaction actions.

## Website surfaces

### `/`

Focused introduction. Explain what an enforcer is, why the registry exists, how evidence works, and why composability matters. End with two clear paths: explore the registry or read the developer standard.

### `/enforcers`

The operational browse surface. Search by name or address, filter by domain, chain, evidence, and stake, then sort by community signal. The page should feel like an instrument, not a campaign page.

### `/enforcers/:id`

The evidence surface. Show the CAIP-10 deployment, source, terms schema, all attested and counter-claims, stake per claim, chain availability, audit evidence, and usage context.

### `/composability`

The guidance surface. Start with a user goal, show curated presets, explain why the set composes, and expose the exact relationship triples and evidence behind the guidance.

### `/submit`

The contribution surface. Collect the deployment, metadata, terms codec, source, and evidence. Preflight the submission, show the transaction plan, connect the wallet, and only then allow a reviewed mainnet write.

### `/developers`

The integration surface. Explain the ontology, canonical GraphQL query, wallet picker pattern, indexer lag state, and direct onchain verification in plain language with copyable examples.

## Footer contract

The footer should make the ecosystem relationship clear without implying an endorsement that has not been granted. It will link to Intuition, the Intuition mainnet explorer surface when the exact route is confirmed, the official repository, the developer guide, and the current network status.

## Build order

1. Approve this direction and the mark geometry.
2. Create the local raster brand kit and social preview from the approved system.
3. Split the current single-page app into the routes above while preserving the live-read adapter.
4. Rebuild the shared shell, navigation, footer, and responsive tokens.
5. Add the browse, detail, composability, submit, and developer surfaces.
6. Replace preview records with live Intuition records after the ontology IDs are approved.
7. Run accessibility, reduced-motion, performance, responsive, and wallet-flow QA.

## Do not build yet

- Mainnet seed writes before the team approves the ontology and funding path.
- An audit badge that is not backed by a specific evidence atom.
- A compatibility score that hides context or counter-signal.
- A separate hardcoded database for composability relationships.
- A large asset pack before the brand mark and type system are stable.
