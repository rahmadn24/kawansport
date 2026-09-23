---
name: Sporty-Fresh Social Energy
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f493f'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6f7a6e'
  outline-variant: '#becabc'
  surface-tint: '#006d30'
  primary: '#00652c'
  on-primary: '#ffffff'
  primary-container: '#15803d'
  on-primary-container: '#d3ffd5'
  inverse-primary: '#79db8d'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#3f6000'
  on-tertiary: '#ffffff'
  tertiary-container: '#517b00'
  on-tertiary-container: '#deffab'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#95f8a7'
  primary-fixed-dim: '#79db8d'
  on-primary-fixed: '#00210a'
  on-primary-fixed-variant: '#005323'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#b2f746'
  tertiary-fixed-dim: '#98da27'
  on-tertiary-fixed: '#121f00'
  on-tertiary-fixed-variant: '#334f00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.05em
  stat-counter:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 28px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system powers an athletic lifestyle and community matchmaking app tailored for young Indonesian sports enthusiasts aged 18–35. The UI channels the raw kinetic energy of game day—balancing grass-court naturalism with electric neon accents, fluid sports performance metrics, and a warm communal spirit.

### Visual Style
- **Aesthetic Movement:** Modern Athletic Neo-Clean. Combines the high legibility and structure of professional tournament apps with high-contrast, energetic accents that drive immediate action.
- **Tone of Voice:** Casual, encouraging, and local Indonesian sports vernacular ("Main Bareng, Naik Level", "Ajak Main", "Sparing Seru", "Slot Tersisa").
- **Visual Weight:** Ultra-clean crisp surfaces layered with punchy high-contrast micro-surfaces, pill-shaped tags, live match status indicators, and confident high-velocity conversion elements.

## Colors
The palette captures the vitality of manicured athletic turf paired with electrifying neon accents and warm Indonesian communal warmth.

### Roles & Application
- **Primary Turf Green (`#15803D` & `#16A34A`):** Anchors navigation headers, verification badges, pitch availability states, and brand equity.
- **Conversion Orange (`#F97316`):** Dedicated exclusively to high-intent transaction points ("Gabung", "Booking Sekarang", "Ajak Main"). Never diluted with administrative actions.
- **Energy Lime (`#A3E635`):** Serves as a high-visibility accent on dark surfaces—ideal for "LIVE" match tags, active time-slots, and XP level progression.
- **Deep Night Navy (`#0B1B33`) & Dark Ink (`#0F172A`):** Deep, confident surfaces used for dark mode navigation bars, match summary cards, and high-emphasis typography.
- **Star Amber (`#F59E0B`):** Reserved for court reviews, MVP leaderboards, and tournament milestones.
- **Clean Field Tint (`#F6FAF7`) & Pure White (`#FFFFFF`):** High-clarity background surfaces that keep the interface lightweight and breathing under tropical daylight glare.

## Typography
Built exclusively on **Inter** for maximum legibility across fast-glance mobile outdoor environments (bright outdoor turf, mobile sunlight). 

- **Display & Headlines:** Heavy tracking reduction (`-0.02em` to `-0.03em`) and weights of 700 to 800 provide an athletic, bold presence.
- **Numbers & Metrics:** Use tabular figures (`font-variant-numeric: tabular-nums`) across match scores, slot counters, pricing, and clock timers to prevent layout shifts during live score updates.
- **Microcopy:** Labels use all-caps with generous letter-spacing (`0.05em`) strictly when indicating urgency (e.g., `SISA 2 SLOT`, `PENDAFTARAN DITUTUP`).

## Layout & Spacing
A rigid 8pt baseline grid governs all spacing, horizontal alignment, and vertical layout intervals.

### Form Factors
- **Mobile Handheld (360px – 428px):** Primary target viewport. Fixed 16px screen gutters, single-column feed, horizontal-scroll category carousels with negative margins (`-16px`) for edge-to-edge swiping.
- **Tablet / Large Screen (600px+):** Centered max-width shell capped at 480px for the primary mobile container, or expanding to a 2-column split (Map/Court Preview left, Slot Booking Sheet right).

### Rhythmic Rules
- Use `space-sm` (8px) between icon and text inside interactive elements.
- Use `space-md` (16px) for interior card padding and stacked feed card gaps.
- Use `space-lg` (24px) for distinct section separations (e.g., between "Jadwal Main Bareng" and "Venue Populer").
- Maintain a minimum 80px bottom clear zone (`space-xl` * 2.5) on mobile feeds to prevent floating action buttons and sticky booking bars from clipping underlying cards.

## Elevation & Depth
Depth is built through layered green-tinted ambient shadows and crisp bordering surfaces rather than heavy generic drop shadows.

- **Surface Neutral (Elevation 0):** Pure `#FFFFFF` cards resting on `#F6FAF7` canvas, framed with a 1px border of `#E2ECE5`.
- **Card Float (Elevation 1):** `box-shadow: 0 4px 16px -2px rgba(11, 27, 51, 0.06), 0 1px 2px 0 rgba(11, 27, 51, 0.04)`. Used for match cards and venue listings.
- **Interactive Hover & Drag (Elevation 2):** `box-shadow: 0 12px 24px -4px rgba(21, 128, 61, 0.12), 0 4px 8px -2px rgba(11, 27, 51, 0.05)`.
- **Sticky / Bottom Sheet (Elevation 3):** `box-shadow: 0 -8px 24px -2px rgba(11, 27, 51, 0.08)`. Anchored conversion bars and filtering sheets.
- **High-Impact Glow (Conversion CTA):** Primary orange action buttons utilize an active drop-tint: `box-shadow: 0 8px 20px -4px rgba(249, 115, 22, 0.35)`.

## Shapes
A disciplined geometric hierarchy with energetic curves reflects athletic equipment and stadium tracks:

- **Small Radius (8px / `rounded-md`):** Checkboxes, slot indicators, match time badges, thumbnail images.
- **Medium Radius (14px / `rounded-lg`):** Primary interactive cards, venue listings, input fields, and modal containers.
- **Large Radius (20px / `rounded-xl`):** Hero match summary banners, venue photo headers, and bottom-sheet drawers.
- **Full Pill (`rounded-full`):** Category filter chips, avatar frames, status pills ("Tersedia", "Penuh"), and Floating Action Buttons (FABs).

## Components

### Buttons
- **Primary Conversion CTA ("Booking", "Gabung", "Ajak Main"):** Background `#F97316`, label `#FFFFFF` in `label-lg`, height 48px, border-radius 24px (full pill). Subtle glow shadow. Active state scales to `0.98`.
- **Secondary Athletic Button:** Background `#15803D`, label `#FFFFFF`. Used for community team actions and joining chats.
- **Outline / Ghost Variant:** Border 1.5px solid `#E2ECE5`, text `#0F172A`, background `#FFFFFF`. Active state switches to `#F6FAF7`.

### Filter Pills & Chips
- Fully rounded 32px height pills. Inactive: `#FFFFFF` with 1px border `#E2ECE5` and `#0F172A` text.
- Active: `#0B1B33` background, `#FFFFFF` text, paired with an `#A3E635` dot indicator.

### Match & Sparing Cards
- Background `#FFFFFF`, border-radius 14px, 1px border `#E2ECE5`. 
- Header features sport category tag ("Futsal", "Badminton", "Mini Soccer"), date badge, and "Slot Tersisa" progress.
- Body displays venue name, host avatar cluster, and skill level indicator (e.g., "Beginner Friendly" or "Semi-Pro").

### Slot Capacity Progress Bar
- Total track: 6px height, border-radius 999px, background `#E2ECE5`.
- Active fill: `#16A34A` when slots are abundant (>40%), transitioning to `#F97316` when urgency kicks in (under 3 slots remaining).

### Inputs & Search Fields
- 48px height, 12px border radius, background `#FFFFFF`, border 1px solid `#D1E0D6`. 
- Focus state: border `#16A34A` with a 3px outer ring in `rgba(22, 163, 74, 0.15)`. Leading icons in `#64748B`.

### Floating Match Action Bar
- Docked sticky bottom bar: Background `#FFFFFF` with blur backdrop, top border 1px solid `#E2ECE5`, containing match price per slot on the left and full-width "Gabung Main" button (`#F97316`) on the right.