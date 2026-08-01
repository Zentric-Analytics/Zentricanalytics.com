# Phase 3 repetition inventory

This inventory records the public-page audit performed before Phase 3 edits. “Useful” means the pattern reinforces an established component role; “redundant” means it made unlike content feel as though it used the same template. Header, footer, type, color, focus, button, and container systems are intentionally excluded from removal.

| Pattern | Page | Section | Component / file | Useful consistency? | Redundant? | Phase 3 action |
| --- | --- | --- | --- | --- | --- | --- |
| Eyebrow | Home | How We Think | `src/app/page.tsx`, `SectionHeader` | Yes: names a philosophy transition | No | Keep |
| Eyebrow | Home | Core Capabilities | `src/app/page.tsx`, `SectionHeader` | Limited | Yes: heading is self-explanatory | Remove |
| Eyebrow | Home | Why Clients Choose Zentric | `src/app/page.tsx`, `SectionHeader` | Yes: introduces the delivery rationale | No | Keep |
| Eyebrow | Home | Final CTA (“Ready to Build?”) | `src/app/page.tsx`, `SectionHeader` | Limited | Yes: duplicates the conversion heading | Remove |
| Eyebrow | Services | Technologies | `src/app/services/page.tsx`, `SectionHeader` | Yes: separates the moving technology inventory | No | Keep |
| Eyebrow | Services | Solution Examples | `src/app/services/FeaturedSolutions.tsx` | No | Yes: repeats “Examples of Solutions…” | Remove |
| Eyebrow | About | Hero (“About”) | `src/app/about/page.tsx` | No | Yes: route and heading establish context | Remove |
| Eyebrow | Contact | Hero (“Contact Zentric Analytics”) | `src/app/contact/page.tsx` | No | Yes: heading and page context are explicit | Remove |
| Eyebrow | Contact | What Happens Next (“Process”) | `src/app/contact/page.tsx` | Yes: clarifies a conceptual transition | No | Keep |
| Rounded white cards | Home | How We Think | `src/app/page.tsx` | No | Yes: duplicated capability/card language | Restyle as editorial rows |
| Rounded white cards | Services | Service offerings | `src/app/services/page.tsx`, `ServicesCapabilities.module.css` | Yes: primary capability objects | No | Keep; retain compact metadata chips |
| Rounded white cards | Services | Solution workspace | `FeaturedSolutions.tsx`, `FeaturedSolutions.module.css` | Yes: represents a coded application workspace | Some nested preview surfaces are functional | Keep; defer workspace identity changes |
| Rounded white cards | Industries | Industry selector shell | `IndustriesWeServe.tsx` | Yes: anchors the hero overlap | Slightly | Simplify internal items, keep restrained outer panel |
| Rounded white cards | Industries | Final photographic CTA | `src/app/industries/page.tsx` | Yes: readable split overlay | Some cross-page CTA similarity | Keep; defer major CTA identity to Phase 4/5 |
| Rounded white cards | Careers | Open Roles | `src/app/careers/page.tsx` | Yes: primary actionable card section | No | Keep |
| Rounded white cards | Careers | Values | `src/app/careers/page.tsx` | No longer card-based after audit | No | Keep editorial divider treatment |
| Rounded white cards | Contact | Direct contact/form support | `src/app/contact/page.tsx`, `ContactForm.tsx` | Yes: groups form and direct-contact tasks | No | Keep |
| Rounded white cards | About | Company facts | `src/app/about/page.tsx` | No | Yes: generic two-column cards | Restyle as editorial divided grid |
| Mint icon boxes | Services | Capability cards | `ServicesCapabilities.module.css` | Yes: card icon variant | No | Keep |
| Mint icon boxes | Careers | Open Roles | `src/app/careers/page.tsx` | Yes: card icon variant | No | Keep |
| Mint icon boxes | Industries | Industry selectors | `IndustriesWeServe.tsx` | No | Yes: made selectors resemble service cards | Restyle as compact bare icons |
| Mint icon boxes | Industries | How We Help accordion | `OrganizationCapabilitiesReveal.tsx` | No | Yes: duplicated the selector | Restyle as compact bare icons |
| Centered CTA | Home | Core Capabilities | `src/app/page.tsx` | No | Yes: introduction is left aligned | Left-align |
| Centered CTA | Home | Final CTA | `src/app/page.tsx` | Yes: entire conversion section is centered | No | Keep |
| Centered CTA | Industries | Show More Industries | `IndustriesWeServe.tsx` | Yes on desktop because selector intro is centered; full-width mobile aids touch | No | Keep |
| Dark navy panel | Home | Hero | `src/app/page.tsx` | Yes: primary hero | No | Keep |
| Dark navy panel | Home | Why Clients Choose | `src/app/page.tsx` | Yes: one process emphasis panel | No | Keep |
| Dark navy panel | Services | Hero workspace / closing CTA | `ServicesHero.tsx`, `src/app/services/page.tsx` | Yes: distinct hero and compact project conversion roles | Slight repetition, separated by page body | Keep; defer page-rhythm work to Phase 5 |
| Dark navy panel | Industries | Hero, values, photographic CTA base | `src/app/industries/page.tsx` | Brand-consistent | Yes: three dark transitions | Keep content treatments; defer major rhythm/color redistribution to Phase 5 |
| Dark navy panel | Careers | Hero and closing CTA | `src/app/careers/page.tsx` | Yes: hero plus simple people CTA | Limited | Keep |
| Dark navy panel | Contact | Hero and assurance strip | `src/app/contact/page.tsx` | Yes: hero plus compact reassurance | Limited | Keep |
| Full-width photographic CTA | Home | Final CTA | `src/app/page.tsx` | Yes: principal brand conversion moment | No | Keep |
| Full-width photographic CTA | Industries | Final CTA | `src/app/industries/page.tsx` | Contextual industry conversion | Some image-treatment repetition | Keep split structure; defer image identity to Phase 4/5 |
| Full-width photographic CTA | Careers | None (CTA is solid navy) | `src/app/careers/page.tsx` | None | None | Keep distinction |
| Two-column card grid | Home | How We Think | `src/app/page.tsx` | Two-column responsive reading is useful | Card surfaces were redundant | Keep columns; restyle as rows/dividers |
| Two-column card grid | Services | Capability cards | `src/app/services/page.tsx` | Yes: primary service inventory | No | Keep |
| Two-column card grid | About | Company facts | `src/app/about/page.tsx` | Columns are useful | Card surfaces were redundant | Keep columns; restyle editorially |
| Accordions | Industries | Industry selector | `IndustriesWeServe.tsx` | Yes: industry-led discovery | Looked card-like | Restyle as bordered rows |
| Accordions | Industries | How We Help | `OrganizationCapabilitiesReveal.tsx` | Yes: progressive detail | Too similar to selector before Phase 3 | Keep lighter divider-only rows |
| Accordions | Home | Why Clients Choose mobile disclosure | `src/app/page.tsx` | Yes: responsive progressive disclosure | No | Keep behavior and ARIA |
| Timelines | Home | Why Clients Choose | `src/app/page.tsx` | Yes: communicates sequential process | No | Keep white circular icon variant |
| Timelines | Contact | What Happens Next | `src/app/contact/page.tsx` | Yes: numbered process | No | Keep bare icon/number treatment |
| Marquee | Home | Final CTA keyword strip | `src/app/page.tsx`, `globals.css` | Brand-level emphasis | No other home marquee | Keep with reduced-motion support |
| Marquee | Services | Technologies We Build With | `src/app/services/page.tsx`, `globals.css` | Functional technology inventory | Similar motion, different role | Keep; defer motion identity review |
| Technology chips | Services | Capability cards | `ServicesCapabilities.module.css` | Yes: compact noninteractive metadata | No | Keep |
| Technology chips | Services | Solution workspace | `FeaturedSolutions.module.css` | Yes: text metadata, visually not buttons | No | Keep |
| Show More control | Home | Why Clients Choose (mobile) | `src/app/page.tsx` | Yes: prevents compressed mobile timeline | No | Keep |
| Show More control | Industries | Industry selector | `IndustriesWeServe.tsx` | Yes: controls list length | No | Keep |
| Similar section header | Home | How We Think / Core Capabilities / Why Choose / final CTA | `src/app/page.tsx`, `SectionHeader.tsx` | Shared typography is useful | Eyebrow-heading-paragraph sequence repeated four times | Remove two decorative eyebrows; retain contextual two |
| Similar section header | Services | Technologies / Solution Examples | `src/app/services/page.tsx`, `FeaturedSolutions.tsx` | Shared hierarchy is useful | Both used category labels | Remove redundant Solution Examples label |
| Similar section header | Industries | Industries / How We Help / Why Choose | `src/app/industries/page.tsx`, `IndustriesWeServe.tsx` | Heading hierarchy is useful | Layouts already vary centered, split, and dark | Keep |
| Similar section header | Careers | Open Roles / What We Value | `src/app/careers/page.tsx` | Headings are useful | No eyebrow sequence; layouts differ | Keep |
| Similar section header | Contact | Hero / Process | `src/app/contact/page.tsx` | Process label is meaningful | Hero label is decorative | Remove hero label, keep Process |

## Deliberate deferrals

- Major page-specific CTA identities and photographic art direction belong to Phase 4 or Phase 5.
- Rebalancing the Industries page’s multiple navy transitions is a page-rhythm change and belongs to Phase 5.
- The coded Services hero and solution-preview workspaces remain intact; changing their internal product-preview surfaces would exceed repetition cleanup.
- Shared navigation, footer, typography, colors, button behavior, focus states, global containers, content, routes, hero layouts, and interaction concepts remain unchanged.
