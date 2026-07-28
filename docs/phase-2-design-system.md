# Phase 2 design-system audit

This inventory records the values found before Phase 2 standardization and classifies them by purpose. It is intentionally descriptive: decorative dashboard geometry, status colors, photography overlays, and animation distances remain page-specific exceptions rather than being flattened into global tokens.

## Pre-standardization inventory

| Category | Values observed | Classification and duplication finding |
| --- | --- | --- |
| Maximum widths | `max-w-xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`; 21rem, 24rem, 42–46rem, 52rem, 56rem, 70rem, 73.75rem, 90rem, 520px, 650px, 720px | `6xl` was the predominant content width; `7xl` served global chrome and `90rem` the flagship home hero. The 70rem/73.75rem values were near-duplicate standard containers. Text-measure widths are justified, not page containers. |
| Horizontal padding | 0, 8, 10, 12, 16, 20, 24, 28, 32, 48 and 64px | Section edges predominantly used 16/24/32px. Other values were internal card/workspace padding. The 16/24/32 responsive page-padding role is now explicit. |
| Vertical section padding | 32, 36, 40, 44, 48, 56, 64, 72 and 80px, plus hero-specific asymmetric values | Equivalent sections mixed 48/56/64 and 56/64/72. Compact, standard, and large roles now distinguish these deliberately; hero composition spacing remains an exception. |
| Hero/page headings | 28, 29.12, 30, 34, 36, 38, 40, 42 and 44px; occasional Tailwind 4xl/5xl | Standard heroes had already converged around 36/40/42px, while About and generic `Section` were near-duplicates. The home hero remains a documented wide composition but uses the standard scale. |
| Section headings | 24, 28, 30, 32 and 40px | 28/30/32 is the shared hierarchy. 24px mobile overrides were inconsistent for equivalent section headers; 40px belongs only to large CTA treatment. |
| Card headings | 18, 19, 20, 22 and 24px | 18/19/20 were equivalent standard-card headings; 22/24 were large panel titles. They are represented by two roles. |
| Body and label sizes | body 14, 15, 15.2, 16 and 17px; labels/chips 12, 13, 14 and 16px | Equivalent body copy frequently alternated between 14/15px and between `0.9375rem`/16px. Shared body is 15px mobile and 16px desktop; small body remains 14px. Eyebrows are 12px and metadata 12px. Larger labels retained only where they are content, not metadata. |
| Line heights | 1, 1.08, 1.09, 1.1, 1.12, 1.2, 1.25, 1.3, 1.5, 1.55, 1.6, 1.65, 1.7; 20, 24 and 28px | 1.1–1.12 is heading rhythm, 1.25–1.3 card titles, and 1.6–1.7 body copy. Close body values are consolidated at 1.65 while compact metadata retains a tighter line. |
| Letter spacing | normal, -0.005em, -0.01em, -0.02em, -0.025em, -0.03em, -0.035em, -0.04em, -0.045em; 0.02em, 0.08em, 0.18em, 0.2em, 0.22em | Headings mostly used -0.04em and eyebrows 0.18em. Nearby values remain only for distinct card/CTA/display roles. |
| Buttons | heights 44, 48, 50 and 54px; horizontal padding 20, 22, 24, 26 and 30px; radii 12, 14 and 16px | `btn` is 50px standard, 44px compact, and primary hero CTA 54px; mobile controls use 48px. The 14px header radius was a near-duplicate retained only as the existing compact header treatment. |
| Cards | radii 16, 18, 20, 22, 24, 28px and full pills; borders `#DCE3EA`, `#E5E7EB`, `#E2E8F0`, `#CBD5E1`; shadows ranging from `0 8px 22px` to `0 24px 70px` | Equivalent cards mixed 20/22px and three border grays. Shared cards now use 20px, `#DCE3EA`, and the standard shadow. Large panels use 24px and elevated shadow. Deep workspace shadows remain intentionally stronger. |
| Icons | glyphs 16, 18, 20, 22 and 24px; containers 40, 44, 52, 56 and 60px | Roles are inline 20px, card 20px in 44px, and timeline 24px in 56px. Hero capability geometry is preserved. |
| Navy | `#0B1F3A`/`#0b1f3a`, `#0c1222`, `#102A4A`, `#123052`, `#17324e`, `#173B67`, `#1E3A5F` | The case variants and `#0c1222`/`#102A4A` were near-duplicate primary inks. Brand navy is now `#0B1F3A`; `#173B67` is the documented hover state. Dark dividers use opacity rather than a second brand navy. |
| Teal and mint | `#10B981`/`#10b981`, `#14B8A6`, `#138c8c`, `#0B7F60`, `#34B889`, `#5EE0BF`, `#7FEBD0`; mint `#EAF7F2`, `#EEF8F5`, `#F2F8F6`, `#edf8f7`, `#e1f4f2` | Primary teal is `#10B981` and mint is `#EAF7F2`. Other teals are retained only inside illustrations/gradients or where contrast requires a darker text color. Equivalent UI accents use the primary token. |
| Light surfaces | `#F7F9FC`, `#F8FAFC`, `#FAFAFA`, `#F3F6F9`, `#F7F8FA`, plus several illustration-only gray tints | Page is `#F7F9FC`, alternate surface is `#F8FAFC`, card is white. Illustration palettes remain intentionally varied. |
| Text/border grays | body `#475569`, `#526071`, `#526376`, `#64748B`, `#718096`, `#758597`; borders `#CBD5E1`, `#DCE3EA`, `#E2E8F0`, `#E5E7EB` | Primary supporting copy is `#475569`, muted copy `#64748B`, and UI border `#DCE3EA`. Darker/lighter shades within dashboard artwork remain exceptions. |
| White opacity | 3%, 5%, 7%, 8%, 10%, 12%, 14%, 15%, 18%, 20%, 30%, 35%, 70%, 72%, 75%, 78%, 80%, 82%, 85%, 90% and 100% | Dark-background semantic rules are white 100%, supporting 90%, muted 74%, divider 14%. Lower values used for fills and higher values used for artwork borders are intentional overlays. |

## Shared system after standardization

- **Containers:** `za-container` (72rem), `za-container-wide` (80rem), and `za-container-narrow` (48rem), all centered with 16/24/32px responsive gutters.
- **Spacing:** compact 48/56/64px, standard 56/64/72px, and large 64/72/80px. Card padding is 20/24/28px and gaps are 16/20/24px.
- **Typography:** standard hero/page 36/40/42px; section 28/30/32px; CTA 30/30/40px; standard card 18/18/20px; large card 22/22/24px; body 15/15/16px at 1.65; small body 14px; eyebrow and metadata 12px.
- **Buttons:** `btn-primary`, `btn-secondary`, `hero-cta-primary`, `hero-cta-secondary`, and `btn-text`, with `btn-compact` and the existing hero sizing modifier. All share motion, disabled behavior, and focus tokens.
- **Cards:** `za-card`/standard, `za-panel`/large, and `za-compact-item`; `DesignSystemCard` maps its existing layout-preserving variants to these surfaces.
- **Icons:** `za-icon-inline`, `za-icon-card`, and `za-icon-timeline`. Page-specific shapes and decorative workspace icons remain unchanged for Phase 3.
- **Forms:** `.input` supplies a 48px minimum, 12px radius, shared border, disabled treatment, invalid border, and focus ring. Contact, Apply, and Track use it without changing form behavior.
- **Focus:** the teal focus token is global; header buttons retain navy focus where the light-header context previously established it.
- **Dark surfaces:** white 100%, supporting white 90%, muted white 74%, and divider white 14%.

## Intentional exceptions

The 90rem home hero, visual dashboard widths, narrow prose measures, asymmetric hero padding, stronger hero-workspace shadow, status/error colors, image overlays, and illustration-specific neutral ramps remain unchanged because they communicate composition, state, or depth rather than an equivalent global component role. Home, Services, and Industries retain their existing hero identities. No page structure, content, interaction, imagery, or animation concept was changed.
