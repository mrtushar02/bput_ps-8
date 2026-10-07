# TEAM — Team Module Builder

**Task ID:** `TEAM`
**Agent:** team-builder
**File touched:** `src/components/modules/team.tsx` (new — already wired into `module-router.tsx` & `role-nav.ts`)

## What was built

`TeamModule` — a `'use client'` module that renders the **Site Team & Supervisors** section + a glass conversation panel. Matched 1:1 to the VLM reference design.

### 1. Roster (15 seeded demo accounts)
Hardcoded `TEAM_MEMBERS` array mirrors `prisma/seed.ts` user roster (Arjun Mehta → Rajesh Khanna, all 15 ESG/BRSR roles). Every member carries `demo: true`. Each member has:
- name, email, roleKey (one of 15 typed `RoleKey` union members)
- roleLabel (human-readable)
- employeeCode (e.g. `MEIL-ADM-001`)
- active (alternates true/false around the roster for visual variety)

### 2. Team grid (4 / 2 / 1 responsive)
- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`
- Each card is a `glass` (or `glass-strong` + `ring-2 ring-sky-200` when chat-targeted) rounded-2xl card with `p-3.5`.
- **Avatar**: 44px (`h-11 w-11`) circle with role-tinted gradient background (`ROLE_TINT` map = exact same `from-x to-y` tints used in `app-shell.tsx`). Initials in bold white.
- **Status indicator dot**: top-right corner (`-right-0.5 -top-0.5`), emerald for active / slate-400 for away, with `animate-pulse` on active members, white border ring.
- **Name**: 13px bold, truncated with `truncate` (text-overflow ellipsis).
- **Role**: 11px gray, truncated.
- **Status pill**: bottom-left — `.status-pill .status-submitted` (blue) for Active, `.status-locked` (gray) for Away, with a tiny `Circle` lucide icon inside.
- **Edit (Pencil) + Delete (Trash2)** action buttons top-right (opacity-0 → group-hover:opacity-100 reveal). Plus a mobile-only Edit button in the footer row.
- **Message button** (MessageSquare icon) in card footer — clicking it calls `openChat(member)` which sets the active chat target, makes the panel visible, scrolls the chat panel into view, and fires a `toast.message`.

### 3. Chat panel (always visible, default = first member)
A `glass` card directly below the grid. Sections:
- **Header**: 36px role-tinted avatar (with status dot pulse), "Conversation with [name]" bold, role label + `@handle` pill, MoreVertical (options) + X (close) buttons. Closing fires `toast.info`.
- **Message thread**: `max-h-80 overflow-y-auto scroll-elegant`, alternating left/right rows.
  - Each `MessageRow`: 24px avatar (gradient — slate "ME" for self, role-tint initials for member), glass-subtle bubble capped at `max-w-[70%]`, timestamp below.
  - Pre-seeded with **3 demo messages** per member (3-line ESG snapshot dialogue via `seedThread(member)`).
  - Smooth message insertion via `motion.div` initial/animate/exit (opacity + y + scale).
  - Three-dot "typing…" indicator while a simulated reply is pending.
  - `useEffect` auto-scrolls the thread to bottom on message add / member switch.
- **Input**: `glass-subtle` rounded-full input + `btn-glass-primary` round Send button. **Enter to send** (Shift+Enter defers to default). Disabled when empty or while a reply is in-flight.
- **Auto-reply**: on send, appends my message, then after a 1000ms timeout picks a random entry from `CANNED_REPLIES` (6 canned strings) and appends it as a "from-member" message. No backend involved — purely local `threads` state per member.

### 4. Premium styling
- Glass cards reuse the design-system classes from `globals.css` (`.glass`, `.glass-strong`, `.glass-subtle`, `.status-pill`, `.scroll-elegant`, `.btn-glass-primary`).
- Role-tinted avatars match `app-shell.tsx`'s `roleTint` map exactly (same 15 keys → same Tailwind gradient classes).
- Framer-motion **staggered entrance** for the team grid (`gridContainer` variants with `staggerChildren: 0.04`, `cardItem` does `opacity/y → 0` over 400ms with the standard `[0.22, 1, 0.36, 1]` ease).
- Smooth message insertion animation per `MessageRow`.
- Status dots pulse (`animate-pulse`) for active members on both card and chat header avatars.
- Header icon block uses the same gradient treatment as other modules (`from-sky-500 to-blue-600`).

### 5. States
- **Loading skeleton** (`TeamSkeleton`): 8 placeholder cards with `animate-pulse` blocks + a chat-panel skeleton block. 350ms simulated fetch via `setTimeout`.
- **Empty state**: when all members have been deleted (delete button removes from local state), shows a centered glass card with a Users icon and explanatory copy.

### 6. Edit / Delete feedback (sonner)
- `onEdit` → `toast.info` with member meta in `description`.
- `onDeleteRequest` → `toast.warning` with an `action: { label: 'Remove', onClick }` that performs local removal + a follow-up `toast.success` confirmation. The whole roster is marked "Illustrative", so the warning explicitly states no DB records will be affected.

## Design constraints honored
- `'use client'` at top.
- TypeScript strict (typed `RoleKey`, `TeamMember`, `ChatMessage`, `TeamCardProps`, `MessageRowProps`).
- `import { toast } from 'sonner'`.
- All 8 required lucide-react icons imported & used: `Users`, `MessageSquare`, `Pencil`, `Trash2`, `Send`, `X`, `Circle`, `MoreVertical`.
- No other files touched. `module-router.tsx`, `role-nav.ts`, `auth-context.tsx` already referenced `'team'` / `TeamModule`, so this file completes the existing wiring.
- Mobile-first responsive (1 col → 2 col → 4 col), `scroll-elegant` custom scrollbar on the chat thread, `max-h-80` long-list handling.

## Verification
- `bun run lint` → exit 0, no warnings/errors.
- `bunx tsc --noEmit` → no `team.tsx` errors (clean).
- `dev.log` shows two clean `✓ Compiled in 316ms` / `✓ Compiled in 642ms` entries after file creation; the prior `Module not found: '@/components/modules/team'` errors are stale (from before the file existed) and have not reappeared.

## Notes for downstream agents
- This module uses **local hardcoded demo data**, not `/api/team` (no such endpoint exists). If you want live data, swap the `useEffect` body to fetch `/api/organization/tree` and walk the user nodes — the rendering layer expects the same `TeamMember` shape.
- Chat is **local UI state only** (per-member `threads` map). No backend wiring. If you need persistence, lift the `threads` state into a `mini-services/chat-service` socket.io service per the platform's WebSocket conventions (`io('/?XTransformPort=3003')`).
- The "View Team" header button is intentionally a `toast.info` affordance — it does not change routing (the grid is already visible directly below).
