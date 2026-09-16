# Unified Frontend shadcn Component Architecture Rules

All AI Agents, Sub-Agents, Workflows, and frontend code across `user-frontend` and `admin-frontend` MUST strictly maintain and enforce the **Official shadcn Component Architecture**, directory discipline, and CSS token standards. No agent or task is permitted to bypass these rules or re-introduce ad-hoc wrappers directly inside `components/ui/`.

---

## 1. Directory Discipline: Three-Tier Component Structure

```
components/
├── ui/                    ← ONLY pure shadcn primitives (Tier 1)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   └── ... (pulled via `npx shadcn@latest add`)
├── shared/                ← Reusable cross-domain compositions (Tier 2)
│   ├── data-table.tsx
│   ├── form-sheet.tsx
│   ├── image-upload.tsx
│   └── ...
└── domain/                ← Domain-specific business components (Tier 3)
    ├── permissions-editor.tsx
    └── order-item-image-cell.tsx
```

### Tier Classification Rules
- **Tier 1 (`components/ui/`)**: Components that exist in the shadcn registry. These files are managed exclusively by `npx shadcn@latest add <name> --overwrite`. NEVER manually edit these files. If you need to extend behavior, create a Tier 2 wrapper in `components/shared/`.
- **Tier 2 (`components/shared/`)**: Reusable compositions built ON TOP of Tier 1 primitives. Used across multiple domain pages (data-table, form-sheet, image-upload, pagination, filters, status-badge, date pickers).
- **Tier 3 (`components/domain/`)**: Business-specific components used by only 1-3 pages (permissions-editor, order-item-image-cell). These contain domain logic and are not reusable across unrelated features.

### Import Path Convention
```typescript
// ✅ Correct Tier 1 import
import { Button } from "@/components/ui/button";

// ✅ Correct Tier 2 import
import { DataTable } from "@/components/shared/data-table";

// ✅ Correct Tier 3 import
import { PermissionsEditor } from "@/components/domain/permissions-editor";

// ❌ NEVER import a custom composition from ui/
import { DataTable } from "@/components/ui/data-table";
```

---

## 2. Tier 1 Purity Rules (shadcn Primitives)

### A. Zero Manual Edits
- Every file in `components/ui/` MUST be an exact match of what `npx shadcn@latest add <name> --overwrite --yes` produces.
- Do NOT add custom props, custom event handlers, custom CSS classes, or custom JavaScript logic to Tier 1 files.
- If you need to extend a shadcn primitive (e.g., add a `showCloseButton` prop to Dialog), create a wrapper component in `components/shared/`:

```typescript
// ✅ GOOD: Wrapper in shared/
// components/shared/closeable-dialog.tsx
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";

export function CloseableDialog({ showCloseButton = true, children, ...props }) {
  return (
    <Dialog {...props}>
      <DialogContent>
        {children}
        {showCloseButton && <DialogClose />}
      </DialogContent>
    </Dialog>
  );
}

// ❌ BAD: Modifying the shadcn primitive directly
// components/ui/dialog.tsx — NEVER add custom props here
```

### B. Zero Arbitrary CSS Values in Tier 1
- Tier 1 files MUST NOT contain arbitrary bracket values like `w-[180px]`, `pt-[12px]`, `max-w-[750px]`.
- All spacing, sizing, and layout MUST use Tailwind design tokens (`w-44`, `pt-3`, `max-w-3xl`).
- This ensures theme/preset changes via `globals.css` propagate correctly to all primitives.

### C. Export Signature Integrity
- After resetting a Tier 1 component, verify its export signature matches the shadcn source.
- If shadcn adds new exports (e.g., new sub-components), they are automatically available.
- If shadcn removes exports that consumers depend on, fix all consumers before committing.

---

## 3. Tier 2 CSS Token Rules (Custom Compositions)

### A. Prefer Tailwind Design Tokens
Map arbitrary values to the closest Tailwind token:
| Arbitrary Value | → | Tailwind Token | Difference |
|---|---|---|---|
| `w-[180px]` | → | `w-44` (176px) | -4px |
| `min-h-[36px]` | → | `min-h-9` (36px) | exact |
| `min-h-[44px]` | → | `min-h-11` (44px) | exact |
| `max-w-[750px]` | → | `max-w-3xl` (768px) | +18px |
| `min-w-[120px]` | → | `min-w-28` (112px) or `min-w-32` (128px) | ±8px |
| `w-[220px]` | → | `w-56` (224px) | +4px |
| `max-w-[150px]` | → | `max-w-36` (144px) | -6px |
| `max-h-[200px]` | → | `max-h-48` (192px) or `max-h-52` (208px) | ±8px |
| `min-h-[8rem]` | → | `min-h-32` (128px) | exact |
| `w-[1px]` | → | `w-px` | exact |

### B. Allowed Exceptions (Viewport-Relative Units)
Arbitrary bracket values are ONLY permitted when:
- Using viewport-relative units with no Tailwind equivalent: `max-w-[95vw]`, `h-[85vh]`
- Using CSS `calc()` expressions: `h-[calc(100%-1px)]`, `max-w-[calc(100%-2rem)]`
- Using CSS variable references: `w-(--sidebar-width)`

### C. Composition Pattern for Icon Placement
When adding icons to shadcn primitives, follow shadcn's `data-icon` attribute pattern:

```typescript
// ✅ GOOD: Using shadcn's data-icon pattern
<Button size="sm">
  <PlusIcon data-icon="inline-start" />
  Add Item
</Button>

// ❌ BAD: Hardcoded absolute positioning
<Button className="relative">
  <PlusIcon className="absolute left-3 top-1/2 -translate-y-1/2" />
  <span className="pl-6">Add Item</span>
</Button>
```

---

## 4. Custom & Composed Component Architecture Rules (Tiers 2, 3 & Page Components)

Every custom component, widget, dialog, or form section built in `components/shared/*`, `components/domain/*`, or `app/**/components/*` **MUST strictly follow the Official shadcn Component Architecture**:

### A. Component Composition over Ad-hoc HTML
- **Always compose using Tier 1 primitives**: Build cards with `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardAction>`, `<CardContent>`, `<CardFooter>`; build forms with `<Field>`, `<FieldLabel>`, `<FieldError>`, `<Input>`, `<Select>`; build overlays with `<Dialog>`, `<Sheet>`, `<Popover>`, `<ActionAlertDialog>`.
- **Zero redundant container reinvention**: Never write ad-hoc `div` wrappers that recreate card borders, focus rings, shadows, or dialog overlays from scratch.

### B. CSS Box Model & Spacing Discipline
- **Use standard Tailwind CSS design tokens exclusively**: Spacing (`p-6`, `gap-2`, `space-y-4`), radii (`rounded-2xl`, `rounded-full`), font scales (`text-xs`, `text-sm`, `text-2xl`, `text-3xl font-heading font-bold`), and sizes (`size-14`, `size-9`, `size-4.5`).
- **Zero hardcoded inline styles**: NEVER use inline pixel style objects (e.g. `style={{ width: 68, height: 68 }}`) that break container responsiveness. Use responsive Tailwind classes or SVG `viewBox` with `size-full`.

### C. Flexbox, Grid Layout & DOM Structure Hierarchy
- Follow shadcn's official CSS Grid / Flexbox auto-row slots (`grid auto-rows-min items-start gap-1.5`, `grid-rows-[auto_auto]`, `has-data-[slot=card-action]:grid-cols-[1fr_auto]`).
- Place action triggers and badges in `<CardAction>` or proper flex alignment rather than absolute pixel overlays.

### D. Theme Portability Guarantee
- Rely on semantic design system tokens (`bg-card`, `text-card-foreground`, `text-muted-foreground`, `bg-primary`, `border-border`, `ring-ring`).
- The entire application MUST support theme/preset switching via `globals.css` + `components.json` with zero changes required to custom component code.

---

## 5. Theme Portability Guarantee

The three-tier structure ensures that switching shadcn themes/presets requires ONLY:
1. Update `components.json` (`"style"` field)
2. Update `globals.css` (CSS custom properties)
3. Run `npx shadcn@latest add --overwrite --yes` for all Tier 1 components

**Zero Tier 2 or Tier 3 file edits should be needed** because they compose Tier 1 primitives via imports, not by duplicating styles.

---

## 6. shadcn Component Reset Verification Checklist

Before declaring any Tier 1 reset complete:
1. ✅ `npx shadcn@latest add <name> --overwrite --yes` ran successfully
2. ✅ All exported symbols match (no removed exports that break consumers)
3. ✅ All consumer import paths are correct
4. ✅ `npm --prefix user-frontend run build` passes with zero errors
5. ✅ No arbitrary CSS bracket values `[...]` exist in the reset file

Before declaring any Tier 2 restructure complete:
1. ✅ File moved from `components/ui/` to `components/shared/` or `components/domain/`
2. ✅ All consumer imports updated to new path
3. ✅ Hardcoded CSS bracket values replaced with Tailwind tokens (except viewport-relative)
4. ✅ Component still uses Tier 1 primitives via `@/components/ui/` imports
5. ✅ `npm --prefix user-frontend run build` passes with zero errors
