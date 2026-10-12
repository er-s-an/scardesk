# UI/UX Pro Max — Applied (Scardesk public Pages)

**Skill:** `/home/box/.codex/skills/ui-ux-pro-max/SKILL.md`  
**Design-system input:** `docs/UI-UX-PRO-MAX-DESIGN-SYSTEM.txt`  
**Surfaces:** `docs/index.html` + `docs/styles.css` (synced to `app/desk/public/preview.html` + `styles.css`)  
**Date:** 2026-10-12 (HKT)

## Direction taken (adapt, not copy-paste)

| Pro Max recommendation | What we did |
|---|---|
| Style: **Dark Mode (OLED)** | `--color-background: #020617`, deep card `#0E0A09`, low white emission |
| Accent `#22C55E` (green) | **Overridden** to brand red `#FF2418` (red = up). No Matrix green |
| Typography Inter / Playfair / JetBrains | Kept desk pairing **Newsreader + IBM Plex Mono**; added Inter as `--sans` optional |
| Enterprise Gateway pattern | Adapted to trading-terminal mast → risk → banner → panels hierarchy |

## Rules executed (checklist)

### Accessibility (CRITICAL)
- [x] Text contrast ≥ 4.5:1 — foreground `#F8FAFC` on OLED `#020617`; muted `#A89A92` on dark cards
- [x] Visible focus rings — `:focus-visible { outline: 2px solid #FFFFFF; outline-offset: 2px }` on links, buttons, inputs
- [x] `aria-label` / `aria-pressed` on language switcher and wallet/actor groups; `role="status"` on banner; `role="note"` on risk

### Touch & interaction (CRITICAL)
- [x] Min touch targets **44×44** on buttons, lang switch, proof links, inputs
- [x] Gaps ≥ **8px** (`--gap: 8px`) between controls
- [x] `cursor: pointer` on all clickables (`a, button, [role="button"], summary`)
- [x] Hover transitions **150–300ms** (`--ease: 200ms ease`) on buttons, panels, proof links

### Animation
- [x] `prefers-reduced-motion: reduce` disables slam animation + short-circuits transitions
- [x] Stamp animation only (one key motion); not everywhere

### Layout & responsive
- [x] Breakpoints at **375 / 768 / 1024 / 1440** (`@media` blocks)
- [x] Viewport meta present; mobile-first stack for main grid under 768
- [x] No fixed px container widths that force horizontal scroll of the page

### Typography & color (semantic tokens)
- [x] CSS variables: `--color-background|foreground|card|muted|border|accent|ring|…`
- [x] Stronger type scale: `--text-xs` … `--text-2xl`; body base 16px root
- [x] Line-height 1.5 on body; serif for H1/H2, mono for data

### Style / icons
- [x] No emoji-as-icons (mark is a CSS bar; pills are text)
- [x] Red-black trading terminal identity preserved

### Product extras (requirements, not Pro Max)
- [x] Header language switcher **中文 / EN**, default **中文**, `localStorage` key `scardesk.lang`
- [x] All visible strings via `data-i18n` + inline zh/en maps
- [x] Banner lead: 只读预览 · 真交易见本机 desk (:8787) / Read-only preview · live desk is local
- [x] **链上证明** panel with program id, maxLeverage 1001, explorer links

## Not done / out of scope
- Live desk `index.html` interactive JS UI not fully re-i18n’d (preview + Pages only)
- Colosseum Submit not touched
- No leverage rollback; maxLeverage remains **1001**
- No private keys in public Pages repo
