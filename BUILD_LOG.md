Read CLAUDE.md first. Create a new file BUILD_LOG.md in the project root with exactly this content:

# BUILD LOG - DAD'S DIARY

Chronological record of what was built, what changed, and why. Updated at the end of every milestone or significant work session. Use this to understand what happened at any stage without reading git history.

---

## M0: PROJECT FOUNDATION
**Completed:** March 2026
**Branch:** main

### What was built
- Next.js 14 + TypeScript project scaffolded
- Supabase project initialized (project ID: yagoticnplkqfzitjqge)
- Vercel deployment connected to GitHub repo
- Base Tailwind CSS and project structure established

### Key decisions
- App router (not pages router)
- Supabase for auth, database, and storage - no separate backend
- Vercel for hosting - zero-config Next.js deployment

---

## M1: AUTHENTICATION AND ONBOARDING
**Completed:** March 2026
**Branch:** main (merged from feature/m1-auth)
**Commit:** "Merge M1: Authentication and Onboarding"

### What was built
- Email/password authentication via Supabase Auth
- Google OAuth (SSO) via Supabase Auth
- Password recovery flow
- Onboarding flow routing new users to child profile creation
- Child profile CRUD at /children
- Protected routes via Next.js middleware
- Light theme across all pages

### Files created or modified
- app/auth/ - login and signup pages
- app/children/ - child profile management
- middleware.ts - route protection
- lib/supabase/client.ts - browser Supabase client
- lib/supabase/server.ts - server Supabase client
- components/Header.tsx - top navigation bar

### Deviations from spec
- Table named childrenprofiles (no underscore) - created this way during scaffolding
- Supabase email confirmation disabled - was blocking signup flow
- .env.local security incident: file accidentally committed, key rotated, credentials moved to Vercel environment variables

### Security incident resolved
- .env.local removed from repo
- Supabase publishable key rotated
- All credentials now in Vercel environment variables only

---

## M2: CORE JOURNALING
**Completed:** April 8, 2026
**Branch:** main (merged from feature/m2-journaling)

### What was built
- Journal entry creation, feed, detail view, edit, and soft delete
- Photo upload and display (Supabase Storage, bucket: entries)
- Child tagging on entries (many-to-many via entry_children)
- Entry form with 3000 character limit, 5MB photo cap, JPEG/PNG/WebP only

### Database tables created
- entries (id, user_id, text, entry_date, created_at, updated_at, deleted_at)
- entry_children (id, entry_id, child_id, created_at)
- entry_photos (id, entry_id, storage_path, original_filename, file_size_bytes, uploaded_at)

### Files created or modified
- app/entries/page.tsx - entry feed
- app/entries/new/page.tsx - entry creation
- app/entries/[id]/page.tsx - entry detail
- app/entries/[id]/edit/page.tsx - entry edit
- components/EntryForm.tsx - shared entry form component
- supabase/migrations/ - schema and RLS migration files

### Deviations from spec
- App router root confirmed at /app/ not /src/app/
- Library files at /lib/ not /src/lib/
- /src/ directory deleted during build fix
- Photo storage path: users/{userId}/entries/{entryId}/{filename}
- Soft delete via deleted_at timestamp (not hard delete)

### Known bugs filed for M6
- B1: Landing page / does not redirect authenticated users to /entries
- B2: Google OAuth routes through old M1 preview URL

---

## PRE-M3: DATABASE CLEANUP
**Completed:** April 9, 2026
**Branch:** feature/m3-engagement
**Commit:** "chore: pre-M3 cleanup - fix RLS policies, backfill users, remove orphan tables and src/"

### What was fixed
- public.users had 0 rows despite 6 users in auth.users - handle_new_user trigger existed but predated the table. Backfilled all 6 users.
- media table dropped - duplicate of entry_photos, empty, no RLS policies, security gap
- share_tokens table dropped - undocumented early M4 attempt, empty, will be rebuilt properly during M4
- All RLS policies across all 5 tables fixed from auth.uid() to (select auth.uid()) - prevents per-row re-evaluation
- handle_new_user and handle_updated_at functions hardened with SET search_path = public
- Missing index added on childrenprofiles.user_id
- CLAUDE.md created in repo root with project constraints for Claude Code sessions
- src/ directory deleted - was empty mirror of real structure, should not exist

### Migration file
- supabase/migrations/20260409000000_m3_pre_cleanup.sql

---

## M3: ENGAGEMENT FEATURES
**Completed:** April 9, 2026
**Branch:** main (merged from feature/m3-engagement)

### What was built
- reminder_settings table with RLS - stores per-user notification preferences (frequency, preferred time, preferred day, enabled toggle)
- get_on_this_day() Supabase function - returns current user's entries matching today's month and day from prior years. Handles soft delete filter. SECURITY DEFINER with fixed search_path.
- OnThisDay component (components/OnThisDay.tsx) - card on entries home screen surfacing past memories. Hidden when no matches. Links to entry detail pages.
- Reminder settings page (app/settings/reminders/page.tsx) - frequency selector, time picker, day picker (weekly/biweekly only), enabled toggle, upsert on save
- Header updated with Reminders navigation link

### Database created
- reminder_settings (id, user_id, enabled, frequency, preferred_time, preferred_day, created_at, updated_at)
- get_on_this_day() function (returns SETOF entries for current user matching today month/day in prior years)

### Migration files
- supabase/migrations/20260409000001_m3_reminder_settings.sql
- supabase/migrations/20260409000002_m3_on_this_day.sql

### Files created or modified
- components/OnThisDay.tsx - new
- components/Header.tsx - added Reminders nav link
- app/entries/page.tsx - added OnThisDay import and placement
- app/settings/reminders/page.tsx - new

### Deferred
- Task 3.3 (notification delivery - Web Push + email fallback) - requires paid email provider. Deferred until post-revenue. reminder_settings table is ready and waiting.

### Quality gates
- Vercel build: green
- Reminder settings page: tested, saves and loads correctly
- On This Day card: tested, appears with matching entries, hidden when no matches

---

## OPEN ITEMS

### Deferred tasks
| Task | Reason | Trigger |
|------|--------|---------|
| 3.3 Notification delivery | Requires paid email provider | First paying customer |

### Open bugs (M6)
| # | Bug | Workaround |
|---|-----|-----------|
| B1 | / does not redirect authenticated users to /entries | Manual navigation |
| B2 | Google OAuth routes through old M1 preview URL | Use email/password login |

### Pending decisions
| # | Decision | Owner |
|---|----------|-------|
| D1 | Supabase storage cost analysis and upload caps | Claude to research, Christopher to decide |
| D2 | Subscription grace period duration | Christopher |
| D3 | Email provider selection for notifications | Christopher - post-revenue |

Confirm BUILD_LOG.md was created at the project root.