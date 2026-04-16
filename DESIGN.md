# Design System Document: Technical Precision & Tonal Depth

## 1. Overview & Creative North Star: "The Kinetic Architect"
Technical supervision dashboards often fall into the trap of "Data Brutalism"—rigid grids, harsh borders, and overwhelming density. This design system rejects that fatigue. Our Creative North Star is **"The Kinetic Architect."**

We treat technical data as a living, breathing structure. Instead of static boxes, we use **Tonal Layering** and **Intentional Asymmetry** to guide the eye. By leveraging high-contrast typography scales and overlapping surface tiers, we create an environment that feels authoritative enough for mission-critical operations, yet fluid enough to reduce cognitive load during long shifts.

## 2. Colors: Depth Over Definition
This system utilizes a sophisticated palette where "Navy Blue" provides the structural foundation, while "Electric Blue" and "Emerald Green" act as kinetic pulses of information.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through:
- **Background Color Shifts:** Placing a `surface-container-lowest` card on a `surface-container-low` background.
- **Tonal Transitions:** Using subtle shifts between `surface` and `surface-variant`.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-translucent materials. 
- **Base Layer:** `surface` (#f9f9ff)
- **Primary Layout Sections:** `surface-container-low` (#f1f3ff)
- **Actionable Cards:** `surface-container-lowest` (#ffffff) – this creates a "natural lift."
- **Overlays/Modals:** `surface-container-high` (#dfe8ff)

### The "Glass & Gradient" Rule
To ensure the dashboard feels premium and "active," main CTAs and hero data points should utilize a **Signature Gradient**. 
- **Primary Gradient:** Linear 135° from `secondary` (#0059bb) to `secondary_container` (#0070ea).
- **Glassmorphism:** Use `surface_container_lowest` at 70% opacity with a `20px` backdrop-blur for floating navigation or filter bars to let data "breathe" behind the interface.

## 3. Typography: Editorial Authority
We use **Inter** not just for legibility, but as a structural element. By creating high contrast between `display` and `label` tiers, we establish a clear information hierarchy.

- **Display & Headlines:** Use `display-md` and `headline-sm` for high-level KPIs. These should feel heavy and grounded (Weight: 700).
- **The Data Layer:** `body-md` is our workhorse. Ensure a line-height of 1.5x to prevent data-heavy tables from feeling cramped.
- **Labels:** `label-sm` (#44474d) should be used for secondary metadata, always in All Caps with +0.05em letter spacing to maintain a "technical" feel.

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "heavy" for a modern technical dashboard. We achieve depth through light and tone.

- **The Layering Principle:** Stack your containers. An inner data module should be `surface-container-lowest` nested inside a `surface-container-low` parent. The 2% shift in brightness is enough to define the edge without a line.
- **Ambient Shadows:** For floating elements (Modals, Popovers), use a shadow tinted with the `primary` color:
  - `box-shadow: 0 12px 32px -4px rgba(26, 43, 72, 0.08);`
- **The "Ghost Border" Fallback:** If a boundary is required for accessibility in data tables, use `outline-variant` (#c5c6ce) at **15% opacity**. Never use a 100% opaque border.

## 5. Components: Precision Primitives

### Buttons & Interaction
- **Primary:** High-energy `secondary` (#0059bb) with a subtle 2px bottom-glow using `secondary_container`.
- **Secondary:** Transparent background with a `Ghost Border` and `on_surface` text.
- **Tertiary:** Text-only, using `secondary` for the label to denote interactivity.

### Data Tables & Cards
- **The Rule of No Dividers:** Forbid the use of horizontal lines between rows. Use `8px` of vertical padding and a subtle `:hover` state change to `surface_container_low` to highlight data rows.
- **Technical Chips:** Use `secondary_fixed` for neutral states and `tertiary_fixed` for "Success/Online" states. Chips should have a `md` (0.375rem) roundedness to feel modern but stable.

### Input Fields
- **State:** Active inputs use a `secondary` glow (2px soft blur) rather than a thick border.
- **Error:** Use `error` (#ba1a1a) text with a `error_container` (#ffdad6) soft background fill behind the input.

### Dashboard Specific: The "Pulse" Component
For technical supervision, use a 4px circular dot with a CSS "ripple" animation using the `tertiary_fixed_dim` (#66df75) color to indicate real-time system health.

## 6. Do’s and Don’ts

### Do:
- **Do** use negative space as a separator. If you think you need a line, try adding `16px` of padding instead.
- **Do** use asymmetric layouts for "Overview" screens (e.g., a large 70% width graph next to a 30% vertical stack of alerts).
- **Do** leverage `surface_bright` for tooltips to make them pop against the cooler `surface` background.

### Don’t:
- **Don’t** use pure black (#000000) for text. Use `on_surface` (#081b38) to maintain the "Navy Blue" tonal harmony.
- **Don’t** use "Standard" 400ms transitions. Use a "Snappy" 200ms ease-out for a high-performance, technical feel.
- **Don’t** clutter the view. Use `surface_container_highest` to hide secondary controls until hover.