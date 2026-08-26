# Performance and quality budget

These are release gates, not aspirational metrics.

## User metrics

- Largest Contentful Paint: <= 2.5 s at the 75th percentile on mobile.
- Interaction to Next Paint: <= 200 ms at the 75th percentile.
- Cumulative Layout Shift: <= 0.1.
- Lighthouse Performance, SEO, and Accessibility: >= 95 on representative routes.

## Asset budgets

- Critical route JavaScript before optional experiences: <= 120 KB compressed.
- Initial hero image: <= 250 KB, responsive AVIF/WebP with explicit dimensions.
- Any optional 3D scene: <= 700 KB compressed for the model and textures combined.
- Third-party scripts: none by default; each requires a written conversion or operational reason.
- Fonts: two local/preloaded files maximum above the fold.

## Interaction rules

- No scroll hijacking.
- Animate `transform` and `opacity`; avoid layout animation during scroll.
- Animation must not delay links, filters, forms, or the WhatsApp action.
- Every animated experience needs reduced-motion behavior.
- Every 3D experience needs a static fallback that preserves the composition.

## Validation

Test the home, inventory, and two representative vehicle pages on a throttled mobile profile. Track
field Core Web Vitals after launch; lab scores alone are insufficient.
