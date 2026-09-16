---
name: backend-coding-standards
description: Enforces strict coding standards for backend NestJS code. Always apply these rules to prevent breaking the system architecture. Covers DTOs, Controllers, Services, Repositories, Error Handling, Pure Direct REST, and Multi-Tenant Isolation.
---

# Backend Coding Standards & Best Practices

Whenever writing, modifying, or reviewing backend code (NestJS / TypeScript / Drizzle ORM) in this repository, you **MUST** follow these strict rules to ensure system stability, security, and consistency.

---

## 1. Pure Direct REST Architecture & DTO Design

### A. Single Resource Operations (`POST /`, `GET /:id`, `PATCH /:id`, `PUT /:id`, `DELETE /:id`)
- **Return Pure Entity DTOs Directly**: Do NOT wrap single resource responses in artificial `{ data: ..., message: ... }` or `{ success: true }` envelopes at the service or controller layers.
- **HTTP Status Codes Convey Outcome**:
  - `201 Created` for `POST` (Creation $\rightarrow$ returns entity DTO)
  - `200 OK` for `GET`, `PATCH`, `PUT` (Read / Mutation $\rightarrow$ returns entity DTO)
  - `204 No Content` for `DELETE` (**Empty response body, `Promise<void>`** $\rightarrow$ NEVER return redundant `{ id, count }` on single delete).
- **Swagger Documentation 1:1 Alignment**: The `@ApiResponse({ status: 201, type: EntityResponseDto })` MUST match the controller's exact `Promise<EntityResponseDto>` return type 1:1.

```typescript
// Controller Layer (Creation)
@Post()
@HttpCode(HttpStatus.CREATED)
@ApiResponse({ status: 201, type: CategoryResponseDto })
async create(
  @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto,
  @GetCurrentUserUUID() userId: string,
): Promise<CategoryResponseDto> {
  return this.categoryService.create(dto, userId);
}

// Controller Layer (Single Deletion)
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiResponse({ status: 204, description: 'Deleted successfully' })
async softDelete(
  @UUIDParam('id') id: string,
  @GetCurrentUserUUID() userId: string,
): Promise<void> {
  await this.categoryService.softDelete(id, userId);
}
```

### B. DTO Single Responsibility Principle
- **Entity DTOs represent domain fields ONLY**: `CategoryResponseDto` must contain only entity properties (`id`, `name`, `description`, timestamps, etc.).
- **NEVER put transport envelope keys (`data`, `message`, `statusCode`) inside entity DTOs**. Putting transport keys inside entity DTOs corrupts nested relations (`ItemCategoryResponseDto extends CategoryResponseDto`) and list arrays (`CategoryResponseDto[]`).
- **All DTO fields must use `@ApiProperty`** for accurate OpenAPI / Swagger documentation.

### C. Bulk Operations (`POST /bulk-delete`, `POST /bulk-restore`, `POST /bulk-hard-delete`)
- **HTTP Status `200 OK`**: Always return **structured data DTOs** (`Promise<BulkActionResponseDto>`) containing `{ count: number, ids: string[] }`.
- Clarifies partial success and enables frontend tables to reconcile selection state immediately without full refetching.

```typescript
export class BulkActionResponseDto {
  @ApiProperty({ example: 5, description: 'Number of affected records' })
  count: number;

  @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'Array of affected record IDs' })
  ids: string[];
}
```

### D. Standardized Error Responses (RFC 7807)
- Errors MUST use standard HTTP status codes (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`) and return structured error objects:
```json
{
  "error": {
    "code": "CATEGORY_ALREADY_EXISTS",
    "message": "Category name already exists",
    "details": null
  }
}
```

---

## 2. Repository Layer Standards

- **Exclusivity**: ALL database insertions, updates, soft-deletes, and hard-deletes reside strictly in the **Repository layer**. The Service layer NEVER runs direct SQL/Drizzle queries.
- **Predicates & Relational Naming**:
  - `existsBy...` (`existsById`, `existsByName`, `existsByPhone`): Returns `Promise<boolean>`, selects `columns: { id: true }`.
  - `has...` (`hasSubcategories`, `hasItems`): Returns `Promise<boolean>` for parent-child relations.
- **Mutation & Deletion Lifecycles (Option 2 Full-Stack Symmetry: NO `remove` or `delete` names)**:
  - **Single Entity**: `create(data, userId)`, `update(id, data, userId)`, `softDelete(id, userId)`, `restore(id)`, `hardDelete(id)`.
  - **Bulk Batch**: `softDeleteMany(ids, userId)`, `restoreMany(ids)`, `hardDeleteMany(ids)`.
  - **Method Naming Strict Rule**: NEVER name deletion methods `remove` or `delete`. ALWAYS use `softDelete` across Controller, Service, and Repository layers for single soft deletion, `restore` for restoration, and `hardDelete` for permanent physical deletion. For bulk batch operations, ALWAYS use `softDeleteMany`, `restoreMany`, and `hardDeleteMany`.
  - **Zero Backwards-Compatibility Aliases (Pure Refactor Only)**: Strictly DO NOT keep or add compatibility aliases (e.g. `delete`, `permanentDelete`, `remove`, `isExistById`, `isExistBySku`, `isExistByName`, `deleteCategory`). All call sites across controllers, services, repositories, server actions, and UI components MUST be refactored directly to the canonical names.
- **Timestamp & Date Handling**: PostgreSQL and Drizzle schema defaults (`defaultNow()`, `.$onUpdateFn(() => sql`now()`)`) are the single source of truth for `createdAt` and `updatedAt`. NEVER pass manual `new Date()` from Service or Repository.

> 📖 **Deep Dive Reference**: See [Repository and Cache Lifecycle Reference](file:///Users/alvi/Documents/WebDev/backend/multi-tenant-pos--mono-repo-nestjs-nextjs/.agents/skills/backend-coding-standards/references/repository-and-cache-lifecycle.md) for complete SQL query patterns, bulk helpers, and full repository implementations.

---

## 3. Table Archetypes & Schema Design Matrix

Every table across the monorepo MUST follow its designated archetype:

| Table Archetype | Examples | `createdAt` | `createdBy` | `updatedAt` | `updatedBy` | Deletion Strategy |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **1. Mutable Domain Entities** | `categories`, `items`, `customers`, `roles`, `tenants` | ✅ | ✅ | ✅ | ✅ **(Mandatory)** | **`softDelete`** (Preserves historical foreign keys) |
| **2. Immutable Event Ledgers** | `orderPayments`, `orderHistory`, `auditLogs`, `stockMovements` | ✅ | ✅ | ❌ **(No)** | ❌ **(No)** | **NO DELETION** (Append-only ledger compliance) |
| **3. Junction / Mapping Tables** | `rolesToPermissions`, `itemToTags`, `pkgRoleTemplates` | ✅ | Optional | ❌ **(No)** | ❌ **(No)** | **`hardDelete`** (Physical SQL delete when detaching) |
| **4. Ephemeral / Token Tables** | `refreshTokens`, `passwordResetTokens`, `idempotencyKeys` | ✅ | Optional | ❌ **(No)** | ❌ **(No)** | **`hardDelete`** (Purged on expiry/revocation) |

> 📖 **Deep Dive Reference**: See [Table Archetypes Reference](file:///Users/alvi/Documents/WebDev/backend/multi-tenant-pos--mono-repo-nestjs-nextjs/.agents/skills/backend-coding-standards/references/table-archetypes.md) for the 3-Question Table Audit Checklist and schema design rules.

---

## 4. Service Layer & Redis Cache Lifecycle Standards

- **Pure DTO Returns**: Return strongly-typed entity DTOs (`Promise<CategoryResponseDto>`).
- **Business Logic Decisions**: The service decides business meaning (e.g. throwing `NotFoundException`, `BadRequestException`).
- **Mandatory Redis Invalidation on Mutation**:
  - Every mutation (`create`, `update`, `softDelete`, `restore`, `hardDelete`, `bulk-delete`) MUST invalidate/flush relevant Redis cache keys (`delPattern('resource:${tenantId}:*')`, `del('resource:${tenantId}:${id}')`).
- **Cache-Aside Read Pattern**: `findAll` and `findById` check Redis first; populate on miss.
- **Mandatory Try-Catch**: Forward all errors through `this.errorService.handleError(error, context)`.

---

## 5. Strict Return Typing (NO `any`) & RBAC Boundaries

- **Strict Promise Typing**: All asynchronous operations in **Controllers, Services, and Repositories** MUST return explicit, strongly-typed `Promise<Type>`. NEVER use `any` or `Promise<any>`.
- **System Scope (`SYSTEMADMIN`)**: Platform-level owner. Operates globally without a `tenantId`.
- **Tenant Scope (`ADMIN`, `MANAGER`, `CASHIER`)**: Operates strictly within the isolated boundary of a single `tenantId`. Never mix system and tenant contexts.

---

## 6. Database Transaction Architecture: The Gold Standard

### A. The Two Banned Anti-Patterns
1. ❌ **BANNED: Service-Level `tx` Prop-Drilling (`repo.create(data, tx)`)**: Leaks DB connection handle into the service layer; human error omitting `tx` on one line silently runs outside the transaction and causes partial commits / corrupted state on rollback.
2. ❌ **BANNED: Mega-Repository "God Method" (`TenantRepository.onboardWithEverything()`)**: Violates Single Responsibility (SRP) and DDD; duplicates user, role, and settings creation logic across repositories.

### B. The 3-Tier Hierarchy
1. **Pattern 1: Aggregate Root Internal Transactions** (`orders` + `order_items` + `order_payments`): Encapsulated inside `OrderRepository` via internal transaction because children have no independent domain lifecycle.
2. **Pattern 2: Ambient Unit of Work (`UnitOfWorkService`) via `AsyncLocalStorage`** (Cross-Aggregate workflows: `Tenant` + `User` + `Role` + `Settings`): The Unit of Work binds `tx` to the async execution context; repositories automatically use `tx` with **zero `tx` parameter passing**.
3. **Pattern 3: Domain Events / Outbox Pattern** (Async side effects: sending emails, Stripe customer creation, seeding catalog demo): Core entity transaction commits immediately $\rightarrow$ emits event $\rightarrow$ background event handlers process asynchronously without holding database locks.

```typescript
// ✅ GOLD STANDARD: Clean Orchestrator, Zero `tx` Prop-Drilling, 100% Type-Safe
@Injectable()
export class OnboardingService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly tenantRepo: TenantRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRepo: UserRepository,
    private readonly settingsRepo: PosSettingsRepository,
  ) {}

  async onboardTenant(dto: OnboardTenantDto) {
    return this.uow.run(async () => {
      const tenant = await this.tenantRepo.create(dto.tenant);
      const role = await this.roleRepo.create(tenant.id, dto.role);
      const user = await this.userRepo.create(tenant.id, dto.user);
      const settings = await this.settingsRepo.createDefault(tenant.id);
      return { tenant, user, role, settings };
    });
  }
}
```

> 📖 **Deep Dive Reference**: See [Transactions & Unit of Work Reference](file:///Users/alvi/Documents/WebDev/backend/multi-tenant-pos--mono-repo-nestjs-nextjs/.agents/skills/backend-coding-standards/references/transactions-and-unit-of-work.md) for the Decision Tree, Decision Matrix, and architecture patterns.
