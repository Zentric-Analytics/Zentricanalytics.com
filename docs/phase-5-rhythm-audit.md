# Phase 5 page-rhythm audit (pre-implementation)

This audit was completed before Phase 5 implementation. Heights are approximate content-driven ranges at common desktop widths; padding references the Phase 2 compact, standard, and large spacing roles.

## Home

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | Strategic hero / navy | 540–590px; large | Balanced, visually heavy by design | Curved white divider is sound; preserve media crop and hero identity. |
| 2 | How We Think / white | 390–450px; compact | Balanced editorial density | Natural hero transition; retain compact spacing and sticky desktop heading. |
| 3 | Core Capabilities / light gray | 320–380px; compact | Concise; mobile bottom padding is too tight | Give the CTA a complete compact-section bottom gutter. |
| 4 | Why Clients Choose / white with contained navy panel | 500–620px expanded; standard | Main structured feature; mobile collapsed state is compact | Tighten panel padding slightly without changing accordion behavior. |
| 5 | Final CTA / light photographic treatment | 260–330px; compact | Balanced | Already separates CTA from navy footer; retain. |

No consecutive full-width navy sections. The home hero media minimum heights are retained for stable image composition. The timeline item minimum height is retained only to align its icon/connector and preserve a 44px-plus interactive rhythm.

## Services

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | Technical hero / navy photograph | 640px desktop; large | Visually heavy, slightly too tall at narrow desktop | Reduce the desktop minimum height while retaining a stable workspace composition. |
| 2 | Capability cards / page light gray | 680–780px; compact | Dense but manageable; cards are content-driven | Preserve natural card heights and alignment. |
| 3 | Technology ticker / white | 330–400px; standard-to-large | Too tall for a supporting strip | Convert to compact token spacing. |
| 4 | Solution Examples / light gray | 620–760px; standard | Workspace is useful but selector/preview can feel stretched | Keep content-driven preview sizing; retain only capped selector height and sticky panel for usability. |
| 5 | Closing CTA / full-width navy | 300–360px; standard | Visually merges into navy footer | Move navy treatment into a contained panel within a compact light section. |

The selector cap is retained so a long navigation remains scrollable; the sticky preview is retained at desktop because it releases within its section and does not reserve document-flow space.

## Industries

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | Photographic hero / navy | Fixed 500–540px | Balanced but uses redundant fixed/min/max declarations | Use one responsive fixed media height; retained because the photographic crop requires stability. |
| 2 | Industry selector / white | Content-driven, 420–650px; compact | Balanced; no reserved accordion height | Retain natural expansion and light hero transition. |
| 3 | How We Help / navy | 360–450px; compact/standard | Strong emphasis; distinct from selector | Retain as the page's single full-width emphasis section. |
| 4 | Contextual CTA / photo with white contained panel | 430–560px; large | Slightly over-spaced | Reduce outer and panel padding while preserving identity and footer separation. |

No consecutive navy sections after the hero. Accordion content grows naturally and hidden content does not reserve a largest-case height.

## Careers

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | People-focused hero / navy photograph | Fixed 470–540px | Balanced; stable crop | Retain responsive fixed media height. |
| 2 | Open Roles / light gray | 560–680px; standard/large | Too tall for three roles; cards have artificial minimum height | Remove card minimum height and compact section spacing. |
| 3 | Values / white | 510–620px; large | Editorially clear but over-spaced | Use standard spacing and reduce grid gap/card padding. |
| 4 | Final careers CTA / full-width navy | 340–420px; large | Repeats Services ending and merges into footer | Use a contained navy panel within a light compact section. |

There is no separate process section in the current Phase 4 page identity; adding one would be a redesign, so it is deferred rather than introduced in Phase 5.

## About

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | Editorial heading and four-part narrative / page light gray | 600–720px; compact | Repeated cards read as one undifferentiated block | Keep one section, narrow the heading reading width, and place the narrative in a white contained panel with tighter mobile padding. |

The single-section page is intentionally concise. No marketing CTA is added because that would change its Phase 4 content strategy.

## Contact

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | Contact hero / navy | 390–480px; large | Balanced but can be more compact | Use standard/large role boundary without changing identity. |
| 2 | Form workspace / light gray | Form-driven; standard | Dense and appropriately task-led | Slightly tighten vertical padding; retain unequal column height because the form content requires it. |
| 3 | What Happens Next / white | 360–450px; standard | Slightly loose for three concise steps | Make compact and tighten row spacing. |
| 4 | Assurance CTA / navy | 220–280px; compact | Merges directly with navy footer | Put the navy content in a contained panel on a light section. |

## Apply

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | Application heading, introduction, form / page light gray | Form-driven; standard | Task-focused but global section spacing is larger than needed above the form | Use a task-page compact section modifier; preserve all form groups and logic. |

Form control minimum heights are retained for accessible touch targets and predictable input layout.

## Track Application

| Order | Section / background | Approx. height and padding | Density / assessment | Transition and decision |
| --- | --- | --- | --- | --- |
| 1 | Tracking heading and form/results / page light gray | State-driven; standard | Initial state can feel too open | Use the same task-page compact modifier and keep results in natural flow close to the form. |

No result minimum height is introduced, preventing empty-state space and layout jumps caused by reserved placeholders.

## Cross-page findings

- **Consecutive navy:** Services, Careers, and Contact end with full-width navy immediately before the navy footer. Convert those CTAs to contained navy panels in light sections.
- **Consecutive light gray:** None are mechanically stacked in the principal marketing pages; light backgrounds generally distinguish workspaces or cards.
- **Repeated white card sections:** Services cards and Careers roles are justified primary card sections. About benefits from one containing surface rather than four floating card-like regions.
- **Fixed heights:** Industries and Careers hero heights are justified media crops; Services desktop hero minimum height can be reduced. No `h-screen` usage exists in the scoped pages.
- **Abrupt widths:** Most primary sections use 72rem containers. Home's 80rem timeline panel and Industries' narrower contextual introduction are justified Phase 4 wide/reading exceptions.
- **Animation:** Reveal transforms do not reserve extra height, and reduced-motion rules restore opacity/natural flow. Sticky behavior is limited to bounded desktop sections; major animation changes remain Phase 6 work.
