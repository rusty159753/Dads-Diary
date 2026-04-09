# CLAUDE.md - Dad's Diary

## Project Overview
Dad's Diary is a private digital journal for fathers. Mobile-first PWA. Next.js + TypeScript frontend, Supabase backend, Vercel hosting. Stripe payments not yet implemented.

## File Structure Rules
- App router pages live at /app/ - never /src/app/
- Shared libraries live at /lib/ - never /src/lib/
- Components live at /components/
- The /src/ directory does not exist and must never be created

## Database Rules
- Table is named childrenprofiles - never children_profiles (no underscore)
- Always filter entries with WHERE deleted_at IS NULL
- Photo storage path pattern: users/{userId}/entries/{entryId}/{filename}
- Storage bucket name: entries

## Current Tables
- users (profile data, extends auth.users)
- childrenprofiles (user's children)
- entries (journal entries, soft delete via deleted_at)
- entry_children (many-to-many join: entries to children)
- entry_photos (photo metadata and storage paths)

## Active Milestone
M3: Engagement Features
Branch: feature/m3-engagement

## Tech Stack
- Next.js 14 with App Router and TypeScript
- Supabase (auth, database, storage)
- Tailwind CSS
- Vercel deployment

## Key Constraints
- All tables must have RLS policies before any frontend code touches them
- RLS policies must use (select auth.uid()) not auth.uid() directly
- No secrets or .env files committed to the repo
- Mobile-first: design for 375px minimum width
- Server components by default, client components only when interactivity requires it

## Do Not
- Create or reference /src/ directory
- Write children_profiles anywhere - it is childrenprofiles
- Use auth.uid() in RLS policies without wrapping in (select )
- Push directly to main
