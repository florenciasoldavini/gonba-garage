# Gonba Precision design system

Gonba Garage uses a premium automotive editorial language: dark showroom surfaces, precise
metadata, oversized typography, restrained glass, and a single high-energy acid accent.

## Principles

1. **Editorial first.** Use strong hierarchy, short copy, and intentional whitespace.
2. **Mechanical precision.** Use mono typography for specifications, counters, years, and labels.
3. **Dark showroom.** Let photography and vehicle details carry the visual emphasis.
4. **Acid with restraint.** Reserve the brand color for primary actions, focus, selection, and
   important status.
5. **Transparent confidence.** Make price, condition, documentation, and interaction states clear.

## Foundations

Design tokens live in `styles/tokens.css`. Components and feature styles should consume semantic
tokens such as `--color-text-secondary` or `--radius-card`; they should not introduce a slightly
different gray, lime transparency, radius, shadow, or animation duration for each screen.

### Color roles

- Canvas and surfaces create depth without changing hue.
- Primary, secondary, tertiary, and disabled text express hierarchy.
- Subtle, default, and strong borders separate glass and opaque surfaces.
- Brand acid is used for primary actions, keyboard focus, active navigation, and selected states.
- Danger is reserved for invalid input and failed operations.

Meaning must never depend on color alone. Pair status colors with text or an icon.

### Typography

- The original Arial/Helvetica stack is the primary interface and editorial family.
- Geist Mono is reserved for metadata and technical values.
- Display tokens are fluid; body and control text remain stable and readable.
- Avoid meaningful text below `--text-micro`.
- Sentence case is the default. Uppercase is limited to short metadata labels.

### Spacing and shape

- Use the 4px spacing scale defined by `--space-*`.
- Controls use `--radius-control` or `--radius-button`.
- Standard panels and cards use `--radius-card`.
- Hero and feature surfaces use `--radius-feature`.
- Pills use `--radius-pill`; circular icon controls may use `50%`.

## Shared components

Reusable primitives live in `components/ui`.

### Button

Use `Button` for actions, `ButtonLink` for internal navigation, and `ButtonAnchor` for fragment or
external links. All accept `accent`, `glass`, `dark`, and `ghost` variants.

- Accent: one primary action per local decision area.
- Glass: secondary actions over dark or photographic surfaces.
- Dark: high-contrast action on a light or acid surface.
- Ghost: tertiary action where a filled surface would add noise.

Every state must remain visible: default, hover, focus-visible, disabled, and submitting.

### Eyebrow

Use `Eyebrow` for a short section label. It owns its decorative acid rule and accessibility
behavior. Do not reproduce its internal markup in feature components.

### Surface

The existing `glass-panel` class is the shared surface primitive until a polymorphic React wrapper
provides a concrete benefit. Glass must not be required for content legibility and should degrade to
an opaque dark surface when backdrop filtering is unavailable.

## Domain patterns

- Vehicle cards always present media, year, make/model, concise facts, price or status, and a clear
  destination.
- Specifications use consistent label/value rows and mono labels.
- Availability, reserved, and sold states must have distinct text in addition to color.
- Photography uses `4:3` for catalog cards and `16:9` for editorial or detail views unless the
  composition requires an intentional exception.

## Motion

Use the duration and easing tokens from `styles/tokens.css`.

- Controls animate color, border, background, or a maximum 2px translation.
- Cards may translate up to 4px.
- Images may scale from `1` to no more than `1.035`.
- Avoid looping decorative motion.
- All interactions must remain understandable under `prefers-reduced-motion`.

## Accessibility

- Preserve the global acid focus ring for keyboard interaction.
- Keep body text at WCAG AA contrast against its surface.
- Do not place essential information only inside photography.
- Interactive targets should be at least 44px in either dimension where practical.
- Dialogs must expose a label, restore focus, and support Escape.

## Adding a component

1. Check whether an existing primitive or domain pattern already covers the use case.
2. Use semantic tokens rather than raw visual values.
3. Define all interactive states before adding page-specific styling.
4. Keep route-specific composition beside its route and reusable primitives in `components/ui`.
5. Verify desktop, compact, keyboard, reduced-motion, and error states.
