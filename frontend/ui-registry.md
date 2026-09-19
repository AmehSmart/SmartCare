# SmartCare UI Registry

The single source of truth for how SmartCare's interface looks and behaves. Every
new screen or component must match what is documented here so the product reads as
one professional medical system.

Last updated: 2026-09-19

## Design principles (non-negotiable)

1. **Flat, clinical, calm.** No drop shadows, no gradients, no glows. Depth comes
   from borders and surface-vs-canvas contrast only.
2. **No em-dashes** in any UI copy. Use a hyphen `-` or rewrite the sentence.
3. **Borders define structure.** Cards, inputs, tables and panels separate with
   `1px solid var(--color-border)`, never elevation.
4. **Colour carries meaning, not decoration.** Teal = action, green = verified,
   amber = reveal/caution, red = deny/tamper, purple = break-glass emergency.
   Do not use these hues for anything else.
5. **Touch-first sizing.** Interactive controls are at least 44px tall.
6. **Accessibility.** Keyboard focus is always visible via the global
   `:focus-visible` outline (2px `--color-action`). Never rely on a shadow for focus.

## Colour tokens (do not hardcode hex; use the variable)

All tokens live in `src/index.css :root`. Keep this palette; do not introduce new colours.

| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#F6F8FA` | App background |
| `--color-surface` | `#FFFFFF` | Cards, panels, inputs |
| `--color-border` | `#E3E8EC` | Every structural border |
| `--color-text` | `#1A1F24` | Primary text, headings |
| `--color-text-2` | `#5B6670` | Secondary text, labels |
| `--color-text-3` | `#8A94A0` | Tertiary / timestamps |
| `--color-action` / `-hover` / `-light` | `#0B6E99` / `#095E84` / `#E6F3FA` | Primary buttons, links, active nav |
| `--color-success` / `-light` | `#1E7A4D` / `#E6F4ED` | Verified, granted, in-scope |
| `--color-warning` / `-light` | `#B26A00` / `#FEF3E2` | Sensitive reveal, caution |
| `--color-danger` / `-hover` / `-light` | `#B3261E` / `#96201A` / `#FDECEA` | Deny, tamper, destructive |
| `--color-glass` / `-hover` / `-light` | `#8A1F7A` / `#751A67` / `#F5E8F3` | Break-glass emergency only |
| `--color-gray-50…900` | see tokens | Neutral fills, table headers, chips |

Semantic pairing rule: a coloured background always uses its `-light` token with the
solid token as text/icon (e.g. `background: var(--color-success-light); color: var(--color-success)`).

## Typography

Font: `--font-sans` (Inter stack). Mono: `--font-mono` for hashes, tokens, IDs.

| Token | Size / line-height | Use |
|---|---|---|
| `--text-display` | 28 / 34 | Page hero title |
| `--text-h1` | 22 / 28 | Page title |
| `--text-h2` | 18 / 24 | Card / section title |
| `--text-body` | 16 / 24 | Body copy |
| `--text-small` | 14 / 20 | Labels, secondary |
| `--text-caption` | 12 / 16 | Eyebrows, timestamps, table headers (uppercase, `letter-spacing:.04em`) |

Headings are weight 700. Eyebrow labels: 12px, 700, uppercase, `--color-action`.

## Spacing, radii, motion

- Spacing scale (8-pt): `--sp-1`=4 … `--sp-12`=48. Use tokens, not arbitrary px.
- Radii: `--radius-sm`=6 (inputs, chips), `--radius-md`=10 (buttons, small cards),
  `--radius-lg`=14 (cards, panels), `--radius-full` (pills, avatars).
- Elevation tokens `--shadow-sm/md/lg/xl` are intentionally `none`. Do not reintroduce.
- Transitions: `--transition` (0.15s) for hover/focus, `--transition-md` (0.25s) for layout.

## Components

### Button (`components/ui/Button.jsx`)
- Props: `variant` = `primary` (default) | `secondary` | `ghost` | `danger` | `breakglass`; `size` = `md` (default) | `sm` | `lg`; `full` for full width.
- Min-height 44px. Radius `--radius-md`. Hover changes background colour only (no shadow, no transform lift).
- `primary`: `--color-action` bg, white text. `secondary`: white bg, `--color-border`, dark text. `ghost`: transparent. `danger`: `--color-danger`. `breakglass`: `--color-glass` (reserve strictly for emergency override actions).

### Pill (`components/ui/Pill.jsx`)
- Prop `tone` = `blue` (default) | `teal` | `green` | `amber` | `warning` | `red` | `purple` | `gray` | `neutral`.
- Rounded-full status label, `-light` bg + solid text. Map: green=granted/verified/in-scope, amber/warning=reveal/off-shift, red=deny/tamper/high severity, purple=break-glass, blue/teal=informational, gray/neutral=inactive.

### Card
- `background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--sp-6)`.
- Interactive cards: on hover set `border-color: var(--color-action)` (no shadow).
- Section header inside a card: title (`--text-h2`) + optional caption, separated by a bottom border.

### Input / Select / Textarea
- Full width, min-height 44px, `border: 1px solid var(--color-border)`, radius `--radius-md`, white bg.
- Focus: `border-color: var(--color-action)` and the global focus outline. Do not add a box-shadow focus ring.
- Label above field, `--text-small`, weight 700, `--color-text-2`.

### Table
- `border-collapse; width:100%`. Header row: `--color-gray-50` bg, caption-style uppercase headers in `--color-text-2`. Rows separated by bottom `--color-border`.
- Wrap in a `overflow:auto` container with a sensible `min-width` so it scrolls horizontally on mobile instead of breaking layout.

### Avatar (`components/ui/Avatar.jsx`)
- Initials in a `--radius-full` circle; sizes `sm` / default. Neutral fill, no shadow.

### SourceChip (`components/ui/SourceChip.jsx`)
- Provenance badge for data origin (e.g. HOSPITAL_VERIFIED). Bordered, flat.

### Modal (`components/ui/Modal.jsx`)
- Centered surface, `--radius-lg`, `1px solid var(--color-border)`, flat (no `--shadow-xl`). Dim the backdrop with a translucent overlay, not elevation. Header with icon + title + subtitle; footer for actions.

### BreakGlassBanner (`components/ui/BreakGlassBanner.jsx`)
- Full-width `--color-glass` banner for active emergency access. Flat. Shows reason + countdown + end-access action.

## Layout & shell

- App shell (`Dashboard.css`): `.dash` grid = fixed sidebar + `.dash-main` (Topbar + `.dash-content`) + optional `.dash-rail`. New authenticated pages reuse `.dash` / `.dash-main` / `.dash-content`.
- Sidebar collapses to an off-canvas drawer with a hamburger trigger and overlay below the mobile breakpoint.
- Page header pattern: eyebrow + `--text-display` title + one-line description on the left; contextual pill/date on the right.

## Responsiveness

- Breakpoints in use: `768px` (tablet: sidebar → drawer, multi-column → single column), and smaller phone tweaks where needed.
- Rules: single 16px side gutter on phones; no horizontal page scroll; multi-column grids collapse to 1 column; action rows stack full-width; tables scroll inside their container.
- Every page must be verified at 360px width with no overflow.

## Copy rules

- No em-dashes. Sentence case for body; Title Case only for proper nouns and buttons where already established.
- Empty values render as a single hyphen `-`, and code compares against that same `-`.
- Security language stays factual: state what the system enforces, never imply the UI made a security decision (the backend does).

## Checklist before shipping a component

- [ ] Uses colour/spacing/radius tokens, no raw hex or arbitrary px.
- [ ] No gradient, no box-shadow (elevation tokens are `none`).
- [ ] No em-dash in any string.
- [ ] Keyboard focus visible; interactive targets >= 44px.
- [ ] Works at 360px with no horizontal scroll.
- [ ] Colour meaning matches the semantic map above.
