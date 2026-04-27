# Design-to-Code Prompt Template

**Purpose**: Accelerate design iteration for Dad's Diary PWA by using Google Stitch design exports as input to Claude for code generation.

**Workflow**: Stitch (design at 375px) → MCP export to DESIGN.md → Claude interprets → TypeScript/React components

---

## Template

```
You are building a React component for a mobile PWA.

TECH STACK:
- Next.js 14 (App Router), TypeScript, Tailwind CSS v3 (HSL color system)
- shadcn/ui components only (no external UI libraries)
- Server Component by default; 'use client' only if interactive
- Tailwind config at repo root: /tailwind.config.ts
- Global styles: /src/styles/globals.css (HSL vars: --primary, --secondary, --muted, --accent, --destructive, --border, --input, --ring, --background, --foreground)

DESIGN INPUT:
[PASTE DESIGN.md from Stitch export OR describe the design: layout, colors, typography, interactions]

CONSTRAINTS:
1. **Mobile first (375px viewport)**: All components optimized for 375px width. Responsive scales up, not down.
2. **Tailwind only**: No inline styles, no CSS modules. Use Tailwind utilities only.
3. **shadcn/ui imports**: `from '@/components/ui/...'` Only use shadcn components (button, input, card, dialog, sheet, toast).
4. **TypeScript strict**: Full type annotations on props, return types, state. No `any`.
5. **Accessibility (WCAG AA)**: 
   - Tap targets ≥48x48px
   - Text ≥16px base size
   - Contrast ≥4.5:1
   - Keyboard navigation on all interactive elements
   - ARIA labels where needed (form labels, status icons, etc.)
6. **Component naming**: PascalCase component, kebab-case file. Props interface: `${ComponentName}Props`.
7. **No hardcoded strings**: Extract labels, placeholders, error messages to props or constants.
8. **Error handling**: Show user-facing errors (toast, inline validation), log to console.

DESIGN CHECKLIST (before output):
- [ ] Layout matches 375px mobile viewport
- [ ] Colors use Tailwind CSS vars (hsl(...)) from /tailwind.config.ts
- [ ] All text ≥16px (check Tailwind size scale)
- [ ] Tap targets ≥48x48px (padding on buttons, spacing on clickables)
- [ ] No <form> tags; use onClick + event handlers instead
- [ ] shadcn/ui imports verified (check /components/ui/)
- [ ] TypeScript: no `any`, all props typed
- [ ] Focus states visible (outline, bg color change, etc.)
- [ ] Mobile-native patterns: no hover-only affordances

OUTPUT FORMAT:
1. Component code (full file, ready to paste into /src/components/features/[domain]/[component-name].tsx)
2. Props interface (above component)
3. Usage example (comment showing how to use)
4. Tailwind classes used (list for reference)
5. Accessibility notes (what was done for AA compliance)

---

## Examples

### Example 1: Entry Card Component

**INPUT:**
```
Design: List item for journal entry. 
- Preview text (first 100 chars), date, child tags, sync status badge
- 375px width, 80px tall
- White card on gray background
- Tap to open full entry
- Date: gray text, 12px
- Tags: pill style, outlined
- Status badge: green checkmark (synced), orange clock (pending), red X (error)
```

**OUTPUT:**
```typescript
'use client';

import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface EntryCardProps {
  id: string;
  date: string; // YYYY-MM-DD
  preview: string;
  tags?: string[];
  syncStatus: 'synced' | 'pending' | 'error';
  onSelect?: () => void;
}

export function EntryCard({
  id,
  date,
  preview,
  tags = [],
  syncStatus,
  onSelect,
}: EntryCardProps) {
  const statusColor =
    syncStatus === 'synced'
      ? 'text-green-600'
      : syncStatus === 'pending'
        ? 'text-orange-500'
        : 'text-red-600';

  return (
    <Button
      variant="ghost"
      className="w-full h-20 justify-start p-4 rounded-lg bg-card border border-border hover:bg-muted"
      onClick={onSelect}
    >
      <div className="flex flex-col gap-2 w-full text-left">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{date}</p>
          <div className={`text-lg ${statusColor}`}>
            {syncStatus === 'synced' && '✓'}
            {syncStatus === 'pending' && '⏱'}
            {syncStatus === 'error' && '✕'}
          </div>
        </div>
        <p className="text-base text-foreground line-clamp-2">{preview}</p>
        {tags.length > 0 && (
          <div className="flex gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 border border-border rounded-full text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Button>
  );
}

// Usage:
// <EntryCard
//   id="entry1"
//   date="2026-04-27"
//   preview="Today I took the kids to..."
//   tags={['Family', 'Outdoor']}
//   syncStatus="synced"
//   onSelect={() => handleOpenEntry('entry1')}
// />

// Tailwind classes: w-full, h-20, p-4, rounded-lg, bg-card, border, border-border,
// text-sm, text-muted-foreground, text-lg, text-base, line-clamp-2, gap-1, gap-2,
// px-2, py-1, text-xs, flex, items-center, justify-between, flex-col

// Accessibility:
// - Button is 80px tall (exceeds 48px tap target)
// - Button width fills container, making side padding tap-friendly
// - Status icon is text-based (accessible in all contexts)
// - Line-clamp-2 preserves readability; full text available on tap
```

---

## Stitch Export Format (MCP Output)

Stitch exports design via MCP as `DESIGN.md`:
- Page name, artboard dimensions (375px)
- Component names, layer hierarchy
- Text content (labels, placeholders)
- Colors (Tailwind var names expected: --primary, --accent, etc.)
- Typography (size, weight)
- Layout (flex, grid, spacing)

Paste this DESIGN.md directly into the template above and ask Claude to generate the component.

---

## Troubleshooting

**Issue**: "shadcn/ui component not found"
**Solution**: Verify component exists in `/src/components/ui/`. If missing, add via:
```bash
npx shadcn-ui@latest add [component-name]
```

**Issue**: "Type error: `any` type"
**Solution**: Add explicit type annotation to props. Example:
```typescript
interface MyProps {
  items: Array<{ id: string; label: string }>;
  onSelect: (id: string) => void;
}
```

**Issue**: "Tailwind class not applying"
**Solution**: 
1. Verify class name in `/tailwind.config.ts` (HSL vars)
2. Ensure `content` path includes file: `/src/**/*.{js,ts,jsx,tsx}`
3. Rebuild with `npm run build`

**Issue**: "Component looks different on 375px vs desktop"
**Solution**: Design is mobile-first 375px. Use Tailwind responsive prefix for larger screens:
```typescript
className="text-sm md:text-base" // 14px on mobile, 16px on md+
```

