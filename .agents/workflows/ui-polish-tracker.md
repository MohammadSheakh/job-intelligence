---
description: Live UI polish tracker. Lists polished reference pages and remaining pages to bring to the same standard. Use when auditing, fixing, or polishing any frontend page design.
---

# 🎨 UI Polish Tracker (`/ui-polish`)

Single source of truth for page-by-page design polish across `user-frontend`.

---

## How This Works

1. **Reference Pages** = fully polished, production-ready designs (responsive lg→sm, typography, spacing, badges, financial alignment).
2. **Remaining Pages** = need to be audited and brought to the same standard as the reference pages.
3. **When prompted** to "polish a page" or "audit X page", read this tracker → check the page against the design standards → report gaps → fix them.

---

## Design Standards Checklist

Every polished page MUST meet ALL of these criteria:

- [ ] **Responsive Layout**: Works cleanly from desktop (`lg` 1280px) → tablet (`md` 768px) → mobile (`sm` 640px). No horizontal overflow, no squished columns.
- [ ] **Typography**: Headings use `font-heading font-bold`, body text uses design system sizes (`text-sm`, `text-base`). Zero browser-default fonts.
- [ ] **Spacing & Padding**: Consistent padding (`p-6`, `gap-4`, `space-y-4`). No arbitrary pixel values.
- [ ] **Financial Alignment**: Numeric columns right-aligned (`text-right`). Financial figures use `font-mono tabular-nums text-right`.
- [ ] **Badge Casing**: Status badges use `capitalize`, units use `uppercase tracking-wider`. Zero lowercase badges.
- [ ] **shadcn Composition**: Uses Tier 1 primitives (`Card`, `CardHeader`, `CardTitle`, `CardContent`). Zero ad-hoc div wrappers recreating card/dialog surfaces.
- [ ] **Loading States**: Skeleton placeholders for async data. No layout shift on load.
- [ ] **Empty States**: Meaningful empty state message when tables/lists have no data.
- [ ] **Error States**: Graceful error boundaries (`error.tsx`) for failed data fetches.
- [ ] **Accessibility**: All interactive elements have focus rings, proper ARIA labels, keyboard navigation.

---

## ✅ Reference Pages (Polished — 7 pages)

These pages are the gold standard. All remaining pages should match their design quality.

| # | Route | Page | Key Design Patterns |
|---|-------|------|-------------------|
| 1 | `/dashboard/categories` | Categories Management | DataTable + FormSheet + bulk actions + trash lifecycle |
| 2 | `/dashboard/subcategories` | Subcategories Management | Parent-child select + DataTable + FormSheet |
| 3 | `/dashboard/items` | Items & Inventory | Multi-tab form + image upload + async multi-filter + variant dialog |
| 4 | `/dashboard/orders` | Orders List | Multi-filter DataTable + status badges + date range |
| 5 | `/dashboard/orders/[id]` | Order Details (tabs: details, payment, returns) | Tabbed detail view + Card sections + financial summary + status timeline |
| 6 | `/dashboard/orders/[id]/return` | Return Order (RMA) | Item selection table + condition select + refund calculation + confirmation |
| 7 | `/dashboard/customers` | Customers CRM | DataTable + FormSheet + E.164 phone + status badges |

---

## ⬜ Remaining Pages (22 pages)

| # | Route | Page | Complexity | Status |
|---|-------|------|-----------|--------|
| 1 | `/login` | Login | Low | ⬜ |
| 2 | `/forgot-password` | Forgot Password | Low | ⬜ |
| 3 | `/reset-password` | Reset Password | Low | ⬜ |
| 4 | `/change-password` | Change Password | Low | ⬜ |
| 5 | `/accept-invitation` | Accept Invitation | Low | ⬜ |
| 6 | `/locked` | Account Locked | Low | ⬜ |
| 7 | `/no-organization` | No Organization | Low | ⬜ |
| 8 | `/onboarding` | Onboarding Wizard | Medium | ⬜ |
| 9 | `/` | Landing / Redirect | Low | ⬜ |
| 10 | `/dashboard` (layout) | Dashboard Shell & Sidebar | Medium | ⬜ |
| 11 | `/dashboard` (page) | Analytics Dashboard | High | ⬜ |
| 12 | `/dashboard/customers/[id]` | Customer Details | Medium | ⬜ |
| 13 | `/dashboard/due` | Due Management List | Medium | ⬜ |
| 14 | `/dashboard/due/[id]` | Due Ledger Details | Medium | ⬜ |
| 15 | `/dashboard/pos` | POS Terminal | High | ⬜ |
| 16 | `/dashboard/promotions` | Promotions & Discounts | Medium | ⬜ |
| 17 | `/dashboard/users` | Users & Staff | Medium | ⬜ |
| 18 | `/dashboard/roles` | Roles & Permissions | Medium | ⬜ |
| 19 | `/dashboard/account` | Account & Org Settings | Medium | ⬜ |
| 20 | `/dashboard/settings/pos` | POS Settings | Medium | ⬜ |
| 21 | `/dashboard/settings/receipts` | Receipt Settings | Medium | ⬜ |
| 22 | `/dashboard/settings/loyalty` | Loyalty Settings | Low | ⬜ |

---

## Agent Execution Protocol

When asked to polish or audit a page:

1. **Read this tracker** to identify the target page and its status.
2. **Open the page file** (`app/dashboard/<route>/page.tsx` and its components).
3. **Compare against** reference page patterns (categories, orders, items).
4. **Run through the Design Standards Checklist** above — check each item.
5. **Report gaps** in a structured format: what's wrong, what needs to change, file paths.
6. **Fix the issues** — apply responsive classes, correct typography, align financials, fix badges.
7. **Verify**: `npm --prefix user-frontend run build` passes.
8. **Update this tracker**: Change the page status from ⬜ to ✅.

---

## Verification

```bash
# Build verification after any polish work
npm --prefix user-frontend run build
```
