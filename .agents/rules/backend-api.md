---
trigger: always_on
---

# Unified Backend API, DTO & Pagination Architecture Rules

All backend (NestJS) and frontend (Next.js BFF) code across this monorepo MUST strictly adhere to these unified architecture, security, API design, and DTO rules.

---

## 1. API Architecture: Pure Direct REST

### A. Single Resource Operations (`POST /`, `GET /:id`, `PATCH /:id`, `PUT /:id`, `DELETE /:id`)
- **Return Pure Entity DTOs Directly**: Do NOT wrap single resource responses in artificial `{ data: ..., message: ... }` or `{ success: true }` envelopes at the service or controller layers.
- **HTTP Status Codes Convey Outcome**:
  - `201 Created` for `POST` (Creation $\rightarrow$ returns entity DTO)
  - `200 OK` for `GET`, `PATCH`, `PUT` (Read / Mutation $\rightarrow$ returns entity DTO)
  - `204 No Content` for `DELETE` (**Empty response body, `Promise<void>`** $\rightarrow$ NEVER return redundant `{ id, count }` on single delete).
- **Swagger Documentation 1:1 Alignment**: The `@ApiResponse({ status: 201, type: EntityResponseDto })` MUST match the controller's exact `Promise<EntityResponseDto>` return type 1:1.

```typescript
// Service Layer
async create(data: CreateCategoryDto, userId: string): Promise<CategoryResponseDto> {
  const category = await this.categoryRepository.create(data, userId);
  await this.invalidate();
  return this.mapToResponseDto(category);
}

// Controller Layer
@Post()
@HttpCode(HttpStatus.CREATED)
@ApiResponse({ status: 201, type: CategoryResponseDto })
async create(
  @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto,
  @GetCurrentUserUUID() userId: string,
): Promise<CategoryResponseDto> {
  return this.categoryService.create(dto, userId);
}
```

### B. Route, Method & Lifecycle Mapping Table

| Operation | HTTP Verb & Route | Controller Method | Service Method | Repository Method | HTTP Status & Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Create** | `POST /` | `create` | `create` | `create` | `201 Created` $\rightarrow$ `Promise<EntityDto>` |
| **Read List** | `GET /` | `findAll` | `findAll` | `findAndCount` | `200 OK` $\rightarrow$ `Promise<PaginatedResponseDto>` |
| **Read Single** | `GET /:id` | `findById` | `findById` | `findById` | `200 OK` $\rightarrow$ `Promise<EntityDto>` |
| **Update** | `PATCH /:id` | `update` | `update` | `update` | `200 OK` $\rightarrow$ `Promise<EntityDto>` |
| **Soft Delete** | `DELETE /:id` | `softDelete` | `softDelete` | `softDelete` | `204 No Content` $\rightarrow$ `Promise<void>` |
| **Restore** | `POST /:id/restore` | `restore` | `restore` | `restore` | `200 OK` $\rightarrow$ `Promise<void>` |
| **Hard Delete** | `DELETE /:id/permanent` | `hardDelete` | `hardDelete` | `hardDelete` | `204 No Content` $\rightarrow$ `Promise<void>` |
| **Bulk Soft Delete** | `POST /bulk-delete` | `softDeleteMany` | `softDeleteMany` | `softDeleteMany` | `200 OK` $\rightarrow$ `Promise<BulkActionResponseDto>` |
| **Bulk Restore** | `POST /bulk-restore` | `restoreMany` | `restoreMany` | `restoreMany` | `200 OK` $\rightarrow$ `Promise<BulkActionResponseDto>` |
| **Bulk Hard Delete** | `POST /bulk-hard-delete` | `hardDeleteMany` | `hardDeleteMany` | `hardDeleteMany` | `200 OK` $\rightarrow$ `Promise<BulkActionResponseDto>` |

---

### C. Bulk & Aggregation Operations (`POST /bulk-delete`, `POST /bulk-restore`, `POST /bulk-hard-delete`)
- **HTTP Status `200 OK`**: Return **structured data DTOs** (e.g., `{ count: number, ids: string[] }`), NEVER arbitrary string messages or empty 204.
- **Why Return `{ count, ids }` on Bulk?**
  - Clarifies partial success when some records are filtered out or bound to relations.
  - Enables the frontend table to immediately reconcile and uncheck the exact deleted IDs without a full re-fetch.
  - Frontend internationalization (i18n) dictionaries format user-facing text dynamically.

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

## 2. DTO Design & Single Responsibility Principle

- **Entity DTOs represent domain fields ONLY**: `CategoryResponseDto` MUST contain only entity properties (`id`, `name`, `description`, timestamps, etc.).
- **NEVER put transport envelope keys (`data`, `message`, `statusCode`) inside entity DTOs**. Putting transport keys inside entity DTOs corrupts nested relations (`ItemCategoryResponseDto extends CategoryResponseDto`) and list arrays (`CategoryResponseDto[]`).
- **All DTO fields must use `@ApiProperty`** for accurate OpenAPI / Swagger documentation.

---

## 3. Multi-Tenant Security & Frontend Caching Standards

- **Tenant-Scoped Next.js Tags (OWASP A01 Prevention)**: All Next.js cache tags MUST include the `tenantId`. NEVER use global unscoped tags (`['categories']`) to prevent cross-tenant cache bleeding.
  - ✅ `next: { tags: [`tenant:${tenantId}:categories`] }`
  - ❌ `next: { tags: ['categories'] }`
- **Mutation Invalidation**: Server Actions MUST invalidate the tenant-scoped tag: `updateTag(`tenant:${tenantId}:categories`)`.
- **Low-Resource POS Device Optimization**: Budget POS terminals have weak CPUs and limited RAM.
  - Rely on **Next.js Server Components (RSC)** and Server-side tag caching.
  - AVOID storing heavy JSON state trees in client-side browser memory (e.g. TanStack/SWR) to eliminate JS bundle weight and RAM stutter.
- **HTTP Cache Headers**:
  - Authenticated tenant endpoints MUST return `Cache-Control: private, no-store` or `private, no-cache`.
  - NEVER use `Cache-Control: public` on tenant data.

---

## 4. List, Pagination, Multi-Sort & Multi-Filter Standards

All list/index endpoints across backend and frontend MUST parse dynamic query parameters and return a unified pagination envelope.

### Request Query Parameters
- **`page`**: Page number (default: `1`).
- **`limit`**: Items per page (default: `10`, max: `100`).
- **`search`**: Global text search term.
- **`sort` (Multi-Sort)**: Comma-separated fields in **kebab-case**. Prefix `-` indicates descending order (e.g. `?sort=-created-at,name`).
- **`filter` (Multi-Filter)**: Nested object notation in **kebab-case**:
  - Exact multiple match: `?filter[status]=active,pending&filter[role]=manager`
  - Range/Operators: `?filter[created-at][gte]=2026-01-01&filter[created-at][lte]=2026-12-31`

**Example Request:**
`GET /api/v1/categories?page=1&limit=20&search=food&sort=-created-at,name&filter[is-deleted]=false`

### List Response Structure (`data` + `meta`)
```json
{
  "data": [
    {
      "id": "7689028e-0186-4191-8819-2ade3a504953",
      "name": "Beverages",
      "createdAt": "2026-08-20T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrevious": false,
    "search": "food",
    "sort": [
      { "field": "created-at", "direction": "desc" },
      { "field": "name", "direction": "asc" }
    ],
    "filters": {
      "is-deleted": ["false"]
    }
  }
}
```

### Query Implementation Rules
- Always use `totalItems` (never `total`).
- Deprecate individual `sortBy` and `sortOrder` in favor of unified `sort` string.
- Kebab-case URL parameters must be automatically mapped to camelCase database fields by backend pipes.
