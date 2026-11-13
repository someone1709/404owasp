---
name: Aura Executive Search
colors:
  surface: '#fbf8ff'
  surface-dim: '#dbd8e6'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2ff'
  surface-container: '#efecfa'
  surface-container-high: '#e9e6f4'
  surface-container-highest: '#e3e1ef'
  on-surface: '#1b1b24'
  on-surface-variant: '#454556'
  inverse-surface: '#302f3a'
  inverse-on-surface: '#f2effd'
  outline: '#767588'
  outline-variant: '#c6c4d9'
  surface-tint: '#3a41f4'
  primary: '#282de6'
  on-primary: '#ffffff'
  primary-container: '#464efe'
  on-primary-container: '#e7e6ff'
  inverse-primary: '#bfc2ff'
  secondary: '#424bcf'
  on-secondary: '#ffffff'
  secondary-container: '#5c66e9'
  on-secondary-container: '#fffbff'
  tertiary: '#005677'
  on-tertiary: '#ffffff'
  tertiary-container: '#266f92'
  on-tertiary-container: '#d1ecff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bfc2ff'
  on-primary-fixed: '#01006e'
  on-primary-fixed-variant: '#181ade'
  secondary-fixed: '#e0e0ff'
  secondary-fixed-dim: '#bec2ff'
  on-secondary-fixed: '#00016d'
  on-secondary-fixed-variant: '#2a31b9'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#8dcef6'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#fbf8ff'
  on-background: '#1b1b24'
  surface-variant: '#e3e1ef'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '500'
    lineHeight: 42px
    letterSpacing: -0.025em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.75rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an editorial, high-performance aesthetic tailored for modern professionals, executives, and recruitment intelligence platforms. Blending Swiss-inspired editorial restraint with contemporary software minimalism, the interface projects precision, calm confidence, and focused momentum.

### Personality & Emotional Response
- **Intellectual Clarity:** Generous whitespace, refined micro-typography, and purposeful hierarchy evoke the feeling of reading a bespoke executive journal rather than a cluttered CRM.
- **Empowered Momentum:** Bold accent strokes and luminous radial glow gradients inject energy into progress tracking, turning pipeline management into an engaging visual narrative.
- **Subtle Luxury:** Translucent layered cards, delicate hairline borders, and muted cool slate/obsidian backdrops provide tactile digital craftsmanship.

### Visual Style
A hybrid of **Editorial Minimalism** and **Refined Glassmorphism**:
- Ultra-flat spatial architecture anchored by hairline separation boundaries.
- Semi-translucent elevated surfaces (`backdrop-filter: blur(20px)`) that float over soft canvas lighting.
- High-contrast geometric typography with wide-tracked display headers paired with dense, legible tabular metric arrays.

## Colors

The palette balances quiet cool neutrals with an assertive, glowing vibrant blue primary accent. Light mode utilizes a clean, cool-tinted canvas that eliminates harsh screen glare, while dark mode leverages deep obsidian with subtle tinted elevation layers.

### Palette Architecture
- **Primary (`#464efe`):** The signature vibrant blue. Reserved strictly for primary calls-to-action, active progress rings, match scores, and data-density highlights.
- **Secondary (`#464fd3`):** Muted indigo-slate used for secondary navigational elements, supportive typography, and elevated card surfaces.
- **Tertiary (`#5b9dc2`):** Steel blue used for pending states, cautionary application alerts, and secondary metric comparisons.
- **Neutral Canvas (`#777682` base tone):** Cool-tinted structural gray for high-contrast separation and balancing elements.
- **Card Surfaces:**
  - *Light Mode:* Pure white (`#FFFFFF`) with 85% alpha transparency (`rgba(255, 255, 255, 0.85)`), layered over subtle cool gradients.
  - *Dark Mode:* Charcoal slate transitioning to hover/active states with faint `1px` top rim highlights (`rgba(255, 255, 255, 0.08)`).
- **Text Hierarchy:**
  - *Primary Text:* `#111111` (Light) / `#F5F5F7` (Dark)
  - *Secondary Text:* `#4A4A4A` (Light) / `#A1A1A6` (Dark)
  - *Muted Text:* `#8E8E93` (Light) / `#636366` (Dark)

## Typography

The type system prioritizes geometric balance, pristine optical spacing, and high-density readability using Plus Jakarta Sans throughout.

- **Primary Hero Display:** Features an editorial signature styling—large, clean, uppercase or title-case headlines (e.g., `YOUR JOB MATCH`) set in light-to-medium weights with tight negative tracking (`-0.03em`).
- **Data & Numeric Presentation:** All metric numbers, percentages, match rates, and compensation tiers must enforce tabular numbers (`font-variant-numeric: tabular-nums`) to prevent layout shift and maintain alignment across comparative card decks.
- **Labels & Microcopy:** Category pill labels, metadata tags, and filter states use `label-sm` with slight uppercase styling or elevated medium weight to stand out against soft backgrounds.

## Layout & Spacing

The layout operates on a fluid responsive grid structured around a compact vertical sidebar rail, an asymmetric upper visual display area, and a horizontal multi-column match stream based on an 8pt architectural rhythm.

### Grid & Layout Structure
- **Global Structure:** A fixed-width compact utility dock (`64px` to `72px`) on the left, flanked by a fluid content dashboard.
- **Desktop (1200px+):** Fluid 12-column grid with `margin-desktop` (48px) and `gutter-desktop` (28px). Hero analytical charts span 7 columns, with secondary telemetry tiles spanning the remaining 5. Job match cards flow in a 4-column horizontal card stream.
- **Tablet (768px - 1199px):** 8-column layout. Margin shrinks to 32px. Cards reflow into a 2x2 grid. Radial analytics sit stacked above candidate lists.
- **Mobile (< 768px):** 4-column fluid layout with 16px lateral padding. The left utility rail transforms into a floating bottom pill-nav. Match cards scroll horizontally with snap points (`scroll-snap-type: x mandatory`).

## Elevation & Depth

Visual hierarchy is communicated through luminous translucency, ghost hairline borders, and subtle atmospheric blue radiance rather than heavy dropshadows.

### Layering Principles
- **Base Canvas (Level 0):** Flat background with a soft ambient radial glow positioned in the top-right analytical quad (`radial-gradient(circle at 75% 20%, rgba(70, 78, 254, 0.08) 0%, transparent 60%)`).
- **Translucent Card Tier (Level 1):** Background surfaces backed by `backdrop-filter: blur(20px)` and framed by an ultra-thin hairline border.
- **Interactive Hover & Float (Level 2):** Elevated interactive elements shift upward by `2px` with a delicate ambient shadow tinted with the primary blue hue.
- **Modal Dialogs & Overlays (Level 3):** Frosted glass canvas overlay displaying a solid modal container with deep drop shadows.

## Shapes

The shape system leverages intentional duality: ultra-rounded organic pills for status indicators, micro-tabs, and navigation docks, contrasted against moderately rounded, structured cards for dense information display.

- **Badges, Filter Chips, and Navigation Items:** Pure pill shape (`rounded-full` / `9999px`).
- **Content Cards & Data Containers:** Large curved surfaces (`24px` radius) providing modern architectural framing.
- **Icon Buttons & Action Rails:** Smooth squircle surfaces (`14px` radius) that offer a tactile, ergonomic surface.

## Components

### Buttons & Action Triggers
- **Primary Pill Button:** High-contrast background with vibrant blue (`#464efe`) or dark slate, pure white typography, pill-shaped (`border-radius: 9999px`), `12px 24px` padding. Transitions on hover with a slight scale (`1.02`) and ambient glow.
- **Secondary Ghost Pill:** Translucent surface, 1px subtle border, neutral typography.

### Badges & Filter Tabs
- **Filter Pills:** Low-profile pill containers (`height: 34px`) with a small trailing cross icon (`×`) for active filters.
- **Match Tags:** High-density chips with mini dot indicators displaying semantic status.

### Job Cards & Metric Tiles
- **Match Card Container:** Structured container with `24px` internal padding. 
- **Match Score Ring:** Integrated circular metric ring (64px - 72px diameter) showing percentage complete using the vibrant blue (`#464efe`) active value arc.

### Data Visualizations & Radial Arc Charts
- **Radial Recruitment Horizon Chart:** Large semi-circular or tiered orbital arch visualization utilizing a blue gradient fill.

### Icon Navigation Rail
- **Utility Squircle Dock:** Centered vertical strip with `44x44px` squircle icon containers with primary accent tinting on active states.