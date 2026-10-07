# Task ID: 5 — Command Palette Builder

**Agent:** Command Palette Builder
**Files touched:**
- `src/components/shell/command-palette.tsx` (NEW — 380 lines)
- `src/components/shell/app-shell.tsx` (EDITED — added import + rendered `<CommandPalette />` before closing `</div>` of shell root)

**Other agents' files I read (for context, did NOT edit):**
- `/home/z/my-project/worklog.md` (full history — Tasks 1, 6, 7, 7-UI, 8, 8-UI, 9)
- `src/lib/auth-context.tsx` (useApp shape, ModuleKey union)
- `src/app/globals.css` (design system tokens)
- `src/app/api/organization/tree/route.ts` (response shape `{ groups: [{ subsidiaries: [{ businessUnits: [{ projects: [...] }] }] }] }`)
- `src/components/shell/app-shell.tsx` (placement target)

## What was built

A premium **Cmd+K / Ctrl+K global Command Palette** that opens a glass-strong overlay from anywhere in the authenticated MEIL ESG shell.

### Trigger
- Global `keydown` listener bound to `window` from inside `<CommandPalette />` (mounted once inside `AppShell`).
- `(e.metaKey || e.ctrlKey) && e.key === 'k'` → `preventDefault()` + toggle `open` state.
- `Escape` (when open) → close + clear query + reset selection.
- Body scroll lock (`document.body.style.overflow = 'hidden'`) is applied while the palette is open and restored on close.

### Overlay & panel
- Full-screen backdrop: `position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,0.3); backdrop-filter: blur(6px)`.
- Clicking the backdrop (mousedown where `e.target === e.currentTarget`) closes the palette.
- Centered panel: `glass-strong glass-shimmer w-full max-w-2xl rounded-3xl overflow-hidden`, positioned `pt-[12vh]`.
- framer-motion entrance: backdrop fades (opacity 0 → 1); panel scales + fades + slides up (`initial={opacity:0, scale:0.96, y:-8}` → `animate={opacity:1, scale:1, y:0}` → exit reverses). `ease=[0.22,1,0.36,1]`, `duration: 0.22`.

### Search input row
- `border-b border-slate-200/60 p-4` flex row.
- Left: 9×9 rounded-xl gradient tile (`from-blue-500 to-cyan-500`) with a `Search` lucide icon — the gradient accent called out in the spec.
- Input: `flex-1 bg-transparent text-base text-slate-800 outline-none`, `placeholder="Search modules, projects, actions, or jump to…"`, `aria-label="Command palette search"`, `autoComplete="off"`, `spellCheck={false}`. Autofocus via `useRef` + setTimeout(focus, 30ms) inside an effect that only runs when `open` becomes true.
- Clear button (X) only renders when `query` is non-empty; clicking it resets `query` + `selectedIndex` and refocuses the input.
- Right-side `kbd` badge reading "esc" as a persistent hint.

### Results list
- Container: `max-h-96 overflow-y-auto scroll-elegant p-2`.
- Three groups (in fixed order): **Navigation**, **Quick Actions**, **Recent Projects**.
- Group headers: sticky `top-0` `bg-white/75 backdrop-blur-sm` with uppercase `text-[10px] font-bold tracking-wider text-slate-400`.
- **Navigation** (10 modules, each with icon + label + description + `G <letter>` shortcut hint):
  | Module | Shortcut |
  | --- | --- |
  | Overview | G O |
  | My Project | G P |
  | Data Entry | G D |
  | Evidence | G E |
  | Submissions | G S |
  | Reports | G R |
  | Analytics | G A |
  | Audit & Trace | G T |
  | BRSR | G B |
  | Admin | G M |
- **Quick Actions** (5):
  | Label | Action |
  | --- | --- |
  | Enter new Energy data | `go('data-entry', 'energy')` |
  | Enter new Water data | `go('data-entry', 'water')` |
  | Generate BRSR Report | `go('brsr')` |
  | View Audit Trail | `go('audit')` |
  | Check Data Quality | `go('overview')` |
- **Recent Projects**: live-fetched from `GET /api/organization/tree` on mount (cancelled-safe). Flattens `groups → subsidiaries → businessUnits → projects`, takes the first 5, renders `projectName` + `projectCode · location`. Click → `go('my-project')`.

### Filtering
- `useMemo` rebuilds the flat item list whenever `query`, `projects`, or `go` changes.
- Case-insensitive substring match on label/description (and `location` for projects).
- Empty state: centered "No results found" + "Try a different keyword or module name." with a `Search` icon tile.
- The flat list drives both rendering and keyboard navigation — a single source of truth.

### Keyboard navigation
- ↑ / ↓ arrows move the `selectedIndex` (wrap-around modulo `items.length`); `preventDefault()` so they don't move the cursor inside the input.
- Enter activates `items[safeIndex]` — calls the item's `run()` and closes the palette.
- `safeIndex = ((selectedIndex % items.length) + items.length) % items.length` ensures the index never goes out-of-bounds when the result set shrinks (e.g., after typing a filter). This avoids needing a `setState`-in-effect clamp (which would trip the `react-hooks/set-state-in-effect` lint rule observed in earlier work).
- The selected row scrolls into view via `el.scrollIntoView({ block: 'nearest' })` whenever `safeIndex` changes.
- `onMouseMove` on each row sets `selectedIndex` so hover + keyboard stay in sync.

### Selected row styling
- `bg-blue-50 ring-2 ring-blue-200 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]` — the blue glow called out in the spec.
- The row's icon tile flips to `bg-gradient-to-br from-blue-500 to-cyan-500 text-white` when selected.
- An `ArrowRight` lucide icon shows on the trailing edge of the selected row.

### Footer hint bar
- `border-t border-slate-200/60 bg-white/60 px-4 py-2.5 text-[11px] text-slate-500`.
- Three kbd groups: `↓ ↑ navigate`, `↵ select`, `esc close` — each kbd is a small bordered pill (`border border-slate-200 bg-slate-50 px-1`).
- Right side (hidden on mobile): `Recycle` icon + `MEIL · Command Palette` mono caption.

### Staggered entrance
- The results container is a `motion.div` with `variants={{ hidden:{}, show:{ transition:{ staggerChildren: 0.025 }}}}` and `initial="hidden" animate="show"`.
- Each item is a `motion.button` with `variants={{ hidden:{opacity:0, y:6}, show:{opacity:1, y:0} }}` — they fade-up in sequence when the palette opens. Filtering does NOT re-trigger the entrance for items that stayed mounted (their key is stable).

### Wiring into AppShell
- Imported `CommandPalette` at the top of `src/components/shell/app-shell.tsx`.
- Rendered `<CommandPalette />` immediately before the closing `</div>` of the shell's root div (i.e., as the last child of `<div className="relative flex min-h-screen flex-col">`). Because `AppShell` is only mounted when a user is logged in (see `src/app/page.tsx`), the palette is automatically only available when authenticated — no extra guard needed.

## Lint + TypeScript

- `cd /home/z/my-project && bun run lint 2>&1 | tail -10` → **clean** (`$ eslint .` returns 0 with zero output).
- `cd /home/z/my-project && bunx tsc --noEmit 2>&1 | grep -E "command-palette|app-shell" | head -10` → **empty** (no errors in my two files).
- The only remaining TS errors in the project are pre-existing in other agents' files (`examples/`, `skills/`, `src/components/modules/brsr.tsx` Task 8-UI).

## agent-browser verification

1. `agent-browser open http://localhost:3000` — already authenticated as Arjun Mehta (Super Admin).
2. `agent-browser press "Control+k"` → palette opens; `agent-browser snapshot -i` confirms:
   - `textbox "Command palette search"` (the search input).
   - All 10 Navigation items with `G O` / `G P` / `G D` / `G E` / `G S` / `G R` / `G A` / `G T` / `G B` / `G M` shortcut hints.
   - All 5 Quick Actions ("Enter new Energy data", "Enter new Water data", "Generate BRSR Report", "View Audit Trail", "Check Data Quality").
   - 4 Recent Projects fetched live from `/api/organization/tree`: Gayatri Solar Plant (MEIL-SOL-GJT · Gayatri, Telangana), Nizamabad Solar Farm (MEIL-SOL-NZR · Nizamabad, Telangana), Hyderabad 33kV Substation (MEIL-TD-HYD · Hyderabad, Telangana), Kaleshwaram Lift Irrigation (MEIL-WTR-KPR · Jayashankar, Telangana).
3. **Filter test**: typed `water` into the search → list collapses to just "Enter new Water data". The "Clear search" (X) button appears.
4. **Empty-state test**: filled `zzznomatch` → `agent-browser read` returned "No results found" (correct empty-state rendering).
5. **Esc test**: pressed `Escape` → palette closed; subsequent snapshot no longer contains the `Command palette search` textbox.
6. **Keyboard nav test**: reopened with `Control+k`, pressed `ArrowDown` 6 times (Overview → My Project → Data Entry → Evidence → Submissions → Reports → Analytics), then `Enter`. Page heading switched from `ESG Command Center` (Overview) to `ESG Analytics` — selection + activation working end-to-end.
7. **Quick Action test**: reopened, filled `water`, pressed `Enter`. Page heading switched to `Data Entry` + sub-heading `Water Entry Form` — `setActiveModule('data-entry')` + `setDataEntrySubModule('water')` both fired.
8. **Click test**: reopened, clicked the `Nizamabad Solar Farm` row via `@e1157`. Page heading switched to `My Project` — palette closed + navigation fired.
9. **Visual verification**: screenshot saved to `/tmp/cmdk-palette.png`, then sent to z-ai vision. VLM response confirmed: "centered command palette overlay with a glassmorphism effect (white background, subtle shadow, rounded corners) floating over a blurred dashboard background", "search input with a blue search icon", "grouped results under a NAVIGATION header with items including icon, title, description, and keyboard shortcut hints (G O, G P, G D)", "selected row highlighted with a light blue background and a blue left-border accent", "footer hint bar with kbd-style badges for arrow keys, enter, esc, and the label 'Command Palette'", "clean, modern, and functional, utilizing a blue accent color".
10. **Dev server log**: zero new errors/warnings/exceptions introduced. The only log lines after my changes are the expected `GET /api/organization/tree 200` (palette pre-fetch) plus the normal flow of API calls when navigating between modules.

## Stage summary

- 1 new client component (`command-palette.tsx`, ~380 lines) + a 2-line edit to `app-shell.tsx` (import + render).
- Premium glass-strong + glass-shimmer palette with gradient search-icon tile, sticky group headers, blue glow on the selected row, staggered framer-motion entrance, and a kbd-style footer hint bar — fully consistent with the established MEIL ESG design system.
- Three groups, fully data-driven: 10 navigation modules (static catalog) + 5 quick actions (static catalog) + up to 5 recent projects (live from `/api/organization/tree`).
- Full keyboard support: Cmd/Ctrl+K toggle, ↑↓ wrap-around navigation, Enter to activate, Esc to close, hover syncs to keyboard selection, selected row auto-scrolls into view.
- Filtering: case-insensitive substring match on label/description/location with a clean empty state.
- Zero lint errors in my files. Zero TS errors in my files. Verified end-to-end in browser via agent-browser (open / filter / empty / Esc / arrow-nav / quick-action / click) plus VLM visual confirmation of the glassmorphism aesthetic.
- Single-route SPA navigation is preserved: every action funnels through `setActiveModule()` (+ `setDataEntrySubModule()` for the energy/water quick actions), never through URL changes.
