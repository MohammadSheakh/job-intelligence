# Table Archetypes & Schema Design Matrix

This reference document defines the schema design, timestamp handling, audit tracking, and deletion strategy for every table across the monorepo.

---

## 1. The Archetype Decision Matrix

Every table across the monorepo MUST follow its designated archetype:

| Table Archetype | Examples | `createdAt` | `createdBy` | `updatedAt` | `updatedBy` | Deletion Strategy |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **1. Mutable Domain Entities** | `categories`, `items`, `customers`, `roles`, `tenants` | ✅ | ✅ | ✅ | ✅ **(Mandatory)** | **`softDelete`** (Preserves historical foreign keys) |
| **2. Immutable Event Ledgers** | `orderPayments`, `orderHistory`, `auditLogs`, `stockMovements` | ✅ | ✅ | ❌ **(No)** | ❌ **(No)** | **NO DELETION** (Append-only ledger compliance) |
| **3. Junction / Mapping Tables** | `rolesToPermissions`, `itemToTags`, `pkgRoleTemplates` | ✅ | Optional | ❌ **(No)** | ❌ **(No)** | **`hardDelete`** (Physical SQL delete when detaching) |
| **4. Ephemeral / Token Tables** | `refreshTokens`, `passwordResetTokens`, `idempotencyKeys` | ✅ | Optional | ❌ **(No)** | ❌ **(No)** | **`hardDelete`** (Purged on expiry/revocation) |

---

## 2. Three-Question Table Audit Checklist

When creating or reviewing any table schema, answer these 3 questions:

1. **Can this record be modified after creation?**
   - **YES** $\rightarrow$ Must include `updatedAt` AND `updatedBy` (Archetype 1).
   - **NO** $\rightarrow$ Drop `updatedAt` and `updatedBy` (Archetypes 2, 3, 4).

2. **If this record is deleted, does it break historical reports, invoices, or relational trees?**
   - **YES** $\rightarrow$ Must use `softDelete` (`isDeleted: boolean`, `deletedAt: timestamp`).
   - **NO** $\rightarrow$ Use `hardDelete` via SQL `db.delete()`.

3. **Is this a financial transaction, audit log, or event stream?**
   - **YES** $\rightarrow$ Append-only ledger: No `updatedAt`, no updates, and zero deletions allowed.

---

## 3. Timestamp & Date Handling (SQL Level ONLY)

- `createdAt` and `updatedAt` timestamps MUST be managed strictly by Drizzle schema defaults and PostgreSQL (`defaultNow()`, `.$onUpdateFn(() => sql`now()`)`).
- **NEVER pass manual `new Date()` from the Service or Repository layer** on creation or mutation. PostgreSQL is the single source of truth for time.
- Soft deletions in the repository set `deletedAt: sql`now()`` and `deletedAt: null` on restore.
