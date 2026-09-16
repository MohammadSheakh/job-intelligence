---
trigger: always_on
---

# Unified Backend Database, Repository & Schema Architecture Rules

All backend (NestJS) repository, service, schema, and database query code MUST strictly adhere to these unified standards.

---

## 1. Timestamp & Date Handling (Schema / SQL Level ONLY)

- `createdAt` and `updatedAt` timestamps MUST be managed strictly by Drizzle schema defaults and PostgreSQL (`defaultNow()`, `.$onUpdateFn(() => sql`now()`)`).
- **NEVER pass manual `new Date()` from the Service or Repository layer** on creation or mutation. PostgreSQL is the single source of truth for time.
- Soft deletions in the repository set `deletedAt: sql`now()`` and `deletedAt: null` on restore.

---

## 2. Data Modification & Insertion Exclusivity (Repository Layer ONLY)

- ALL database queries, data insertions, updates, soft-deletes, restores, and hard-deletes MUST reside strictly in the **Repository layer**.
- The **Service layer** must NEVER execute direct SQL/Drizzle queries or access the database connection.
- The **Repository layer** must NEVER throw HTTP exceptions (e.g. `NotFoundException`, `BadRequestException`). Return `null`, `boolean`, or entities; the Service layer evaluates business meaning.

---

## 3. Redis Cache Lifecycle & Invalidation (Service Layer)

- The **Service layer** owns Redis caching and cache invalidation.
- On **any mutation** (`create`, `update`, `softDelete`, `restore`, `hardDelete`, bulk operations), the Service MUST invalidate, flush, or recache relevant Redis keys (`delPattern('resource:${tenantId}:*')`, `del('resource:${tenantId}:${id}')`).
- Read operations (`findAll`, `findById`) use the cache-aside pattern: check Redis, fetch from repository on cache miss, write to Redis with TTL, and return.

---

## 4. Repository Query Decision Matrix & Naming Standards

- **Existence Predicates (`existsBy...`)**: Return **`Promise<boolean>`** and optimize SQL with `columns: { id: true }` (never `SELECT *`).
  - ✅ `existsById(id)`, `existsByName(name)`, `existsByPhone(phone)`, `existsBySku(sku)`.
  - ❌ Avoid `isExistById`, `isNameExist`, `isExistByName`.
- **Relational Predicates (`has...`)**: Return **`Promise<boolean>`** and follow correct parent-to-child domain semantics.
  - ✅ `hasSubcategories(categoryId)` (Category contains subcategories)
  - ✅ `hasItems(categoryId)` / `hasItems(subcategoryId)` (Parent entity contains items)
  - ❌ Avoid inverted naming like `isBelongToSubcategoryById` or `isBelongToItemById`.
- **Single Field / Enum Queries (`get...Status`)**: Return **`Promise<EnumType | null>`** and optimize SQL with `columns: { status: true }`.
- **Entity Fetching (`findById`, `findByName`, `findAndCount`)**: Return **`Promise<Entity | null>`**.
- **Deletion & Mutation Lifecycle Standards**:
  - **Single Mutation**: `create`, `update`, `softDelete(id, userId)`, `restore(id)`, `hardDelete(id)`
  - **Bulk Mutation**: `softDeleteMany(ids, userId)`, `restoreMany(ids)`, `hardDeleteMany(ids)`
  - **Zero Backwards-Compatibility Aliases (Pure Refactor Only)**: Strictly DO NOT keep or add compatibility aliases (e.g. `delete`, `permanentDelete`, `remove`, `isExistById`, `isExistBySku`, `isExistByName`). All call sites across controllers, services, repositories, and frontend MUST be refactored directly to the canonical names.
  - Repositories return affected count (`Promise<number>`) for bulk mutations.
  - Controllers & Services return structured DTOs (`Promise<{ count: number, ids: string[] }>`) for bulk operations.

| Scope | Method | SQL Operation | Repository Return Type | Controller Return Type |
| :--- | :--- | :--- | :--- | :--- |
| **Single** | `softDelete(id, userId)` | `UPDATE ... SET is_deleted = true, deleted_at = now()` | `Promise<boolean>` | `204 No Content` $\rightarrow$ `Promise<void>` |
| | `restore(id)` | `UPDATE ... SET is_deleted = false, deleted_at = null` | `Promise<boolean>` | `200 OK` $\rightarrow$ `Promise<void>` |
| | `hardDelete(id)` | `DELETE FROM ... WHERE id = id` | `Promise<boolean>` | `204 No Content` $\rightarrow$ `Promise<void>` |
| **Bulk** | `softDeleteMany(ids, userId)` | `UPDATE ... WHERE id IN (...)` | `Promise<number>` | `200 OK` $\rightarrow$ `Promise<BulkActionResponseDto>` |
| | `restoreMany(ids)` | `UPDATE ... WHERE id IN (...)` | `Promise<number>` | `200 OK` $\rightarrow$ `Promise<BulkActionResponseDto>` |
| | `hardDeleteMany(ids)` | `DELETE FROM ... WHERE id IN (...)` | `Promise<number>` | `200 OK` $\rightarrow$ `Promise<BulkActionResponseDto>` |

---

## 5. Table Archetypes & Schema Design Matrix

Every table across the monorepo MUST follow its designated archetype for timestamps (`updatedAt`), audit tracking (`updatedBy`), and deletion strategy:

| Table Archetype | Examples | `createdAt` | `createdBy` | `updatedAt` | `updatedBy` | Deletion Strategy |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **1. Mutable Domain Entities** | `categories`, `items`, `customers`, `roles`, `tenants` | ✅ | ✅ | ✅ | ✅ **(Mandatory)** | **`softDelete`** (Preserves historical foreign keys) |
| **2. Immutable Event Ledgers** | `orderPayments`, `orderHistory`, `auditLogs`, `stockMovements` | ✅ | ✅ | ❌ **(No)** | ❌ **(No)** | **NO DELETION** (Append-only ledger compliance) |
| **3. Junction / Mapping Tables** | `rolesToPermissions`, `itemToTags`, `pkgRoleTemplates` | ✅ | Optional | ❌ **(No)** | ❌ **(No)** | **`hardDelete`** (Physical SQL delete when detaching) |
| **4. Ephemeral / Token Tables** | `refreshTokens`, `passwordResetTokens`, `idempotencyKeys` | ✅ | Optional | ❌ **(No)** | ❌ **(No)** | **`hardDelete`** (Purged on expiry/revocation) |

### Three-Question Table Audit Checklist
1. **Can this record be modified after creation?**
   - **YES** $\rightarrow$ Must include `updatedAt` AND `updatedBy` (Archetype 1).
   - **NO** $\rightarrow$ Drop `updatedAt` and `updatedBy` (Archetypes 2, 3, 4).
2. **If this record is deleted, does it break historical reports, invoices, or relational trees?**
   - **YES** $\rightarrow$ Must use `softDelete` (`isDeleted`, `deletedAt`).
   - **NO** $\rightarrow$ Use `hardDelete` via SQL `db.delete()`.
3. **Is this a financial transaction, audit log, or event stream?**
   - **YES** $\rightarrow$ Append-only ledger: No `updatedAt`, no updates, and zero deletions allowed.

---

## 6. Strict Promise Typing & RBAC Boundaries

- **Mandatory Try-Catch**: Never omit try-catch in Service and Repository layers. Forward through `this.errorService.handleError(error, context)`.
- **Strict Promise Typing (NO `any`)**: All asynchronous operations across **Controller, Service, and Repository layers** MUST return explicit, strongly-typed `Promise<Type>`. NEVER use `any`, `Promise<any>`, or omit return types.
- **RBAC Strict Boundary**: Never mix System Context (`SYSTEMADMIN`) and Tenant Context (`ADMIN`, `MANAGER`, `CASHIER`). Validate tenant isolation on every repository query (`where: eq(table.tenantId, tenantId)` or dynamic tenant schema connection).
