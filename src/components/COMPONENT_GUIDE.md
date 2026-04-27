# Component Structure Guide

## Overview
This guide defines the organization and naming conventions for React components in the Dad's Diary PWA.

## Directory Layout

```
src/components/
├── ui/
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx
│   └── toast.tsx
├── features/
│   ├── entries/
│   │   ├── entry-form.tsx
│   │   ├── entry-list.tsx
│   │   ├── entry-card.tsx
│   │   └── sync-status.tsx
│   ├── children/
│   │   ├── child-form.tsx
│   │   ├── child-list.tsx
│   │   └── child-tag.tsx
│   └── auth/
│       ├── login-form.tsx
│       ├── signup-form.tsx
│       └── auth-guard.tsx
└── layout/
    ├── mobile-header.tsx
    ├── mobile-shell.tsx
    └── footer-nav.tsx
```

## Naming Conventions

### File Names
- Use kebab-case: `entry-form.tsx`, `sync-status.tsx`
- One component per file (unless tightly coupled subcomponents)
- Descriptive, explicit names over abbreviations

### Component Names
- Use PascalCase: `EntryForm`, `SyncStatus`
- Match file name: `entry-form.tsx` exports `EntryForm`
- No "Component" suffix: use `EntryForm`, not `EntryFormComponent`

### Props Interfaces
- Named `${ComponentName}Props`: `EntryFormProps`, `SyncStatusProps`
- Placed directly above component definition
- Exported for consumer documentation

## UI Components (`/ui`)

**Source**: shadcn/ui components (copy-paste)

Primitives for building features:
- `button.tsx` - Button with variants (primary, secondary, destructive, outline, ghost)
- `input.tsx` - Text input, email, password, number variants
- `card.tsx` - Card container with header/body/footer
- `dialog.tsx` - Modal dialog (desktop)
- `sheet.tsx` - Slide-out panel (mobile, drawer)
- `toast.tsx` - Toast notifications for confirmations/errors

Each file exports the component and any related subcomponents (e.g., `Button`, `ButtonGroup`).

## Feature Components (`/features`)

Business logic wrapped around UI primitives. Organized by domain.

### Entries (`/features/entries`)

**entry-form.tsx**
- Props: `EntryFormProps` with `onSubmit`, `initialEntry?`, `isLoading?`
- Handles text input, photo attachment, date selection, child tag selection
- Validates content (non-empty), formats date
- Dispatches to entry store or parent callback

**entry-list.tsx**
- Props: `EntryListProps` with `entries`, `onSelectEntry`, `isLoading?`
- Renders list of `EntryCard` components
- Handles scrolling, pagination, "On This Day" memory injection
- Synced/pending/error badges for each entry

**entry-card.tsx**
- Props: `EntryCardProps` with `entry`, `onSelect?`, `onDelete?`
- Displays entry preview (first 100 chars), date, child tags
- Shows sync status badge (green checkmark = synced, clock = pending, X = error)
- Click to expand full entry

**sync-status.tsx**
- Props: `SyncStatusProps` with `status: SyncStatus`, `errorMessage?`
- Visual indicator: spinner (pending), checkmark (synced), error icon (error)
- Tooltip on hover showing timestamp or error reason
- Auto-hides after 3s on success

### Children (`/features/children`)

**child-form.tsx**
- Props: `ChildFormProps` with `onSubmit`, `initialChild?`
- Name input, birth date picker
- Validates non-empty name, reasonable birth date

**child-list.tsx**
- Props: `ChildListProps` with `children`, `onSelectChild`, `onDeleteChild`
- Renders child cards with name, age, edit/delete buttons
- Empty state message if no children added

**child-tag.tsx**
- Props: `ChildTagProps` with `child`, `selected?`, `onToggle?`
- Multi-select toggle (pill style, outlined when unselected)
- Used in entry-form to tag entries for specific children

### Auth (`/features/auth`)

**login-form.tsx**
- Props: `LoginFormProps` with `onSubmit`, `isLoading?`, `error?`
- Email + password inputs
- "Sign up" link, "Forgot password" link
- Loading state on submit button

**signup-form.tsx**
- Props: `SignupFormProps` with `onSubmit`, `isLoading?`, `error?`
- Email, password, password confirm inputs
- Password strength indicator (visual bar)
- Terms acceptance checkbox
- "Already have account? Log in" link

**auth-guard.tsx**
- Props: `AuthGuardProps` with `children`, `fallback?`
- Wrapper component that checks session
- Shows fallback (or redirect to login) if not authenticated
- Useful for protecting pages/routes

## Layout Components (`/layout`)

**mobile-header.tsx**
- Props: `MobileHeaderProps` with `title`, `onMenuOpen?`
- 48px tall, centered title, hamburger menu on left
- Optional right-side action slot (settings icon, etc.)
- Sticky position at top of viewport

**mobile-shell.tsx**
- Props: `MobileShellProps` with `children`
- Outer wrapper: sets 375px width (mobile), handles safe area insets
- Includes header, content area, and footer nav
- Prevents horizontal scroll

**footer-nav.tsx**
- Props: `FooterNavProps` with `items`
- Bottom navigation bar (5 items max)
- Active indicator for current route
- Icons + labels, stacked vertically
- 56px height (mobile standard)

## Patterns

### Client Components
Mark with `'use client'` at file top for interactive features (forms, state, event handlers).

### Server Components
Default. Use for static layouts, data fetching, layout boundaries.

### Props Drilling
Avoid >3 levels. Use Context for deeply nested state (e.g., `AuthContext`, `EntryContext`).

### Error Boundaries
Wrap feature components in error boundary. Log errors, show fallback UI.

### Loading States
All async operations should accept `isLoading?` prop and show visual feedback (disabled button, skeleton, spinner).

### Accessibility
- All interactive elements: keyboard navigable, focus visible
- Labels for inputs, ARIA attributes for status
- Color contrast 4.5:1 minimum
- Tap targets 48x48px on mobile

## Versioning & Updates

As shadcn/ui releases updates, pull in new components via:
```bash
npx shadcn-ui@latest add [component-name]
```

Feature components are custom and not versioned separately; update as needed in-place.
