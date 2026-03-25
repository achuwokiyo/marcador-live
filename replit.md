# MarcadorLIVE

## Overview

MarcadorLIVE is a real-time live scoreboard application for youth football (soccer) matches. Spectators scan a QR code to view the match score on their mobile devices, with automatic live updates without page refreshing. The system includes a public view for spectators and a PIN-protected admin panel for match operators (parents/delegates) to control the scoreboard.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state with 1-second polling for live updates
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom sports-themed design tokens
- **Build Tool**: Vite with React plugin

Key frontend routes:
- `/` - Landing page to create new matches
- `/match/:id` - Public spectator view (auto-refreshing scoreboard)
- `/match/:id/admin` - Protected admin panel for match control
- `/dashboard` - User dashboard for logged-in users (manage teams, view matches)
- `/admin` - Super admin dashboard (manage all users, matches, assignments, clubs)
- `/widget` - Embeddable widget showing live and recent matches (for iframe embedding)
- `/match/:id/widget` - Single match embeddable widget (for iframe embedding individual matches)
- `/widget-embed` - Configuration page to generate widget embed code (supports both list and single match widgets, requires auth, supports team-based filtering)
- `/registro` - Local auth registration (username + password + optional recovery)
- `/login` - Local auth login
- `/recuperar` - Password recovery flow (multi-step)
- `/club/:slug` - Public club landing page (live matches, schedule, results, sponsors)
- `/club/:slug/admin` - Coordinator panel (teams, delegates, matchdays, sponsors management, weekly schedule image generation)
- `/club/:slug/delegado` - Delegate panel (PIN access, team/matchday management)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON API with Zod validation
- **Database ORM**: Drizzle ORM with PostgreSQL dialect

API endpoints handle:
- Match CRUD operations
- Score updates (increment/decrement)
- Match status transitions (scheduled → first_half → halftime → second_half → finished) — idempotent (duplicate requests ignored), optimistic UI updates
- Timer control (start/pause/reset) — idempotent
- Match event logging (goals, cards, substitutions)
- PIN verification for admin access
- Widget API (`/api/widget/matches`) - Public endpoint with CORS headers for cross-domain embedding, returns sanitized live/recent match data
- AI Chronicle generation (`/api/matches/:id/generate-chronicle`) - Uses Anthropic Claude API via Replit AI Integrations
- Chronicle config (`/api/club/:slug/chronicle-config`) - GET/PUT endpoints for club chronicle style configuration
- Match sponsor (`/api/matches/:id/sponsor`) - GET endpoint returns sponsor data for a match (via matchday→team→sponsor chain) or null
- User editing (`/api/admin/users/:id`) - PATCH endpoint for superadmin to edit username, password, role of local auth users

### Image Generation Components (Canvas API)
- **MatchdayImage** - Single match promotional poster (1080x1350, team logos/colors, date/time/venue, optional player photo, sponsor). Supports `template` prop (classic/modern/bold) fetched from club config.
- **ShareResultImage** - Post-match result image (1080x1080, scores, optional player photo, sponsor). Supports `template` prop (classic/modern/bold) fetched from club config.
- **WeeklyScheduleImage** - Weekly schedule poster grouped by category (1080xN, all pending matches for a category, club branding, optional background photo, sponsor). Supports 3 template styles with separate render functions.
- **Template styles**: classic (dark gradient), modern (light/clean), bold (black, high contrast). Stored per-club in `templateMatchday`, `templateResult`, `templateWeekly` columns. Managed via coordinator panel "Plantillas" tab. MatchAdmin fetches template config from `GET /api/club/:slug/template-config` (public endpoint).

### Data Model
Main tables:
1. **auth_users** - Registered users via Replit Auth (includes `role` field: 'user' or 'superadmin')
2. **matches** - Stores match state (teams, scores, status, timer data, admin PIN, owner authUserId, chronicle, summaryImageUrl)
3. **match_events** - Event log (goals, cards, whistles, substitutions)
4. **teams** - User's saved favorite teams
5. **match_spectators** - Tracks unique visitors per match

Club tables (paid clubs feature):
6. **clubs** - Club entities with slug, colors, coordinator, status (trial/active/inactive), chronicle config (tone, mentionScorers, hideBlowout, blowoutThreshold, slogans, values, extraInstructions), template config (templateMatchday, templateResult, templateWeekly)
7. **club_branches** - Club branches/sections
8. **club_teams** - Teams belonging to a club with category, color, delegate/sponsor assignments
9. **club_delegates** - Delegate users with PIN-only access (no account needed)
10. **club_players** - Players in club teams
11. **club_matchdays** - Scheduled matchdays linked to club teams, can be broadcast to create matches
12. **club_sponsors** - Club sponsors with tier (gold/silver/standard)

Timer synchronization uses `timerStartTime` (timestamp when running) and `timerElapsedSeconds` (accumulated time) to calculate current match time on the client.

### Authentication & Authorization
- **Replit Auth** - User registration and login via OAuth (legacy, still functional)
- **Local Auth** - Username + password registration/login with JWT tokens (new primary auth)
  - JWT stored in localStorage, sent via Authorization header
  - Optional recovery via email or phone (codes logged to console for now)
  - Routes: /api/auth/register, /api/auth/login, /api/auth/me, /api/auth/change-password
  - Recovery: /api/auth/recovery/request, /api/auth/recovery/verify, /api/auth/recovery/reset
  - Username availability check: /api/auth/username-available?username=...
  - Middleware: `isLocalAuthenticated` (server/localAuth.ts)
- **Owner access** - Match owners (authUserId) have direct admin access without PIN
- **Coordinator access** - Club coordinators have direct admin access to all their club's matches without PIN (checked via matchday→club→coordinatorUserId)
- **Superadmin access** - Users with role='superadmin' bypass PIN for all matches and can access /admin dashboard
- **PIN delegation** - Optional 4-digit PIN for delegating match control to others
- Access patterns: Owner (direct), Coordinator (direct), Superadmin (direct), Delegated (PIN), Guest (requires PIN)

### Real-time Updates
Currently implemented via polling (React Query refetches every 1 second). The architecture supports future WebSocket implementation for true real-time updates.

### Network Resilience & Monitoring
- **Retry with backoff** - Critical mutations (score, status, timer) use `fetchWithRetry` with 3 retries and exponential backoff (1s, 2s, 4s). Retries on 500/404/network errors; does not retry on 401/400.
- **Graceful shutdown** - Server handles SIGTERM/SIGINT signals, finishes in-flight requests before exiting (10s timeout).
- **Production logging** - All score updates, status changes, and timer actions logged with `[MATCH]` prefix including matchId, action details, and ISO timestamp. Auth failures logged with `[AUTH FAIL]` prefix. Shutdown events logged with `[SHUTDOWN]` prefix.

## External Dependencies

### Database
- **PostgreSQL** - Primary database (connection via `DATABASE_URL` environment variable)
- **Drizzle Kit** - Database migrations and schema management

### Key NPM Packages
- `drizzle-orm` / `drizzle-zod` - Database ORM and schema validation
- `@tanstack/react-query` - Server state management
- `react-qr-code` - QR code generation for share functionality
- `canvas-confetti` - Celebration effects when matches finish
- `zod` - Runtime type validation for API inputs
- `express` - HTTP server framework
- `connect-pg-simple` - PostgreSQL session store (available but sessions not currently used)
- `@anthropic-ai/sdk` - Anthropic Claude API for AI chronicle generation (via Replit AI Integrations, no API key needed)

### UI Dependencies
- Full shadcn/ui component library with Radix UI primitives
- `date-fns` - Date formatting utilities
- `lucide-react` - Icon library

### Development
- Vite dev server with HMR
- Replit-specific plugins for development experience
- esbuild for production server bundling