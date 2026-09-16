---
trigger: always_on
---

# Unified Frontend Architecture, Data Fetching & Error Handling Rules

All frontend code across `user-frontend` and `admin-frontend` MUST strictly follow these unified rules for API fetching, DTO typing, multi-tenant caching, runtime array safety, and low-resource POS performance.

---

## 1. Pure Direct REST API Consumption (BFF Pattern)

### A. Architectural Boundary
```
Browser Component → Server Action / RSC → serverFetch<T> → NestJS Backend (Pure REST)
```
- **Browser NEVER calls NestJS directly**: All backend requests execute on the Next.js server via Server Components or Server Actions.
- **Pure Entity Fetching**: Backend returns pure entities directly. `serverFetch<T>` receives `T` directly without unwrapping artificial `{ data }` envelopes.

```typescript
// Single Entity Fetch (lib/services/category.service.ts)
export async function getCategoryById(id: string): Promise<CategoryResponse> {
  const tenantId = await validateTenant().catch(() => "default");
  return serverFetch<CategoryResponse>(`/categories/${id}`, {
    next: { tags: [`tenant:${tenantId}:category-${id}`] },
  });
}

// Single Entity Mutation
export async function createCategory(data: CreateCategoryRequest): Promise<CategoryResponse> {
  return serverFetch<CategoryResponse>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

### B. List / Paginated Fetching
- List responses follow the unified `{ data: T[], meta: PaginationMetaDto }` format:
```typescript
export async function getCategories(
  params?: GetCategoriesParams,
): Promise<CategoryPaginatedResponseDto> {
  const queryString = buildQueryString(params);
  const tenantId = await validateTenant().catch(() => "default");
  return serverFetch<CategoryPaginatedResponseDto>(`/categories${queryString}`, {
    next: { tags: [`tenant:${tenantId}:categories`] },
  });
}
```

---

## 2. Multi-Tenant Caching Standards (OWASP A01 Prevention)

- **Mandatory Tenant-Scoped Cache Tags**: All Next.js cache tags MUST include the `tenantId`. NEVER use global unscoped tags (`['categories']`).
  - ✅ `next: { tags: [`tenant:${tenantId}:categories`] }`
  - ❌ `next: { tags: ['categories'] }`
- **Mutation Invalidation in Server Actions**: Server Actions MUST invalidate the tenant-scoped tag immediately after successful mutation:
```typescript
export async function createCategoryAction(data: CategoryFormValues): Promise<CategoryResponse> {
  await validateOrigin();
  const tenantId = await validateTenant();
  const validatedData = validateData(getCategoryFormSchema(), data);
  const result = await createCategory(validatedData);
  
  updateTag(`tenant:${tenantId}:categories`);
  return result;
}
```
- **Request-Scoped Deduplication (`React.cache`)**: Wrap read-only server service calls in `React.cache()` to eliminate duplicate backend calls during a single SSR render pass.

---

## 3. Low-Resource POS Device Optimization

Budget POS hardware (1GB-2GB RAM, weak Android/ARM CPUs) will freeze if loaded with heavy client JS state.
- **RSC by Default**: Render pages and data tables via React Server Components.
- **NO Heavy Client RAM Caches**: Do NOT store full database collections in client-side memory trees (e.g. avoid client TanStack Query/SWR in-memory caching for large static collections).
- **Zero Client Hydration Overhead**: Ship pre-rendered HTML and minimal interactivity.

---

## 4. UI Feedback & Internationalization (i18n)

- **NEVER rely on backend message strings for UI feedback**.
- **ALWAYS use localized frontend dictionaries** for toast notifications and UI text:
```typescript
// ✅ Good: Localized dictionary toast
toast.success(dict?.messages?.createSuccess || 'Category created successfully');

// ❌ Bad: Relying on backend English message
toast.success(result.message);
```

---

## 5. Strict TypeScript Typing & Runtime Boundary Safety (NO `any`)

### A. Static TypeScript Discipline
- All Service functions, Server Actions, and API helpers MUST have explicit return types.
- Never use `any` or `Promise<any>`.

```typescript
export type CategoryResponse = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  subCategories?: { id: string; name: string; itemsCount?: number }[];
};

export type CategoryPaginatedResponseDto = PaginatedResponse<CategoryResponse>;
```

### B. Runtime Array Boundary Safety (Anti-TypeError Standard)
Compile-time types do not prevent runtime crashes if a network response or store state is `undefined` or an error object. To eliminate `TypeError: x.find is not a function` or `x.map is not a function`:
- **Store Setters**: Enforce array guards in Zustand setters: `set({ list: Array.isArray(val) ? val : [] })`.
- **Asynchronous Loaders**: Always validate responses before setting state: `setList(Array.isArray(res) ? res : [])`.
- **Component Array Methods**: Always guard calls to `.find()`, `.map()`, `.filter()`, `.some()`, and `.reduce()` (`Array.isArray(list) ? list.find(...) : undefined` or `(list || []).map(...)`).

---

## 6. Error Handling & Try-Catch Architecture across Frontend Layers

### A. Summary Decision Matrix across Frontend Layers
| Layer | File Location | Use `try-catch`? | Reason & Gold Standard |
| :--- | :--- | :---: | :--- |
| **1. Service Layer** | `lib/services/*.service.ts` | ❌ **NEVER** | Services must be pure pass-throughs. Catching here swallows errors, breaks type safety (`Promise<T>`), and disables `error.tsx`. |
| **2. Server Components (RSC)** | `app/**/page.tsx` | ❌ **AVOID** | Let errors bubble to Next.js **`error.tsx`** boundaries for native fallback rendering. |
| **3. Server Actions** | `lib/**/actions.ts` | ⚠️ **CONDITIONAL** | Let `BackendError` bubble directly to the client form, OR return a discriminated union. If catching, MUST re-throw Next.js redirects (`unstable_rethrow(error)`). |
| **4. API Route Handlers** | `app/api/**/route.ts` | ✅ **MANDATORY** | Must catch errors and return structured `NextResponse.json(...)` with proper HTTP status codes. |
| **5. Client UI / Forms** | `components/**/form.tsx` | ✅ **MANDATORY** | Catch `BackendError` to bind field validation errors to `react-hook-form` and display localized toasts. |

---

### B. Deep Dive by Layer

#### 1. Frontend Service Layer (`lib/services/*.service.ts`) $\rightarrow$ ❌ **NO `try-catch`**
- **Preserves Strict Return Types**: `getCategoryById(id)` returns `Promise<CategoryResponse>` cleanly without forcing `null` checks.
- **Preserves Error Context**: Passes `BackendError` (with RFC 7807 field validation paths) untouched to the form.
- **Enables `error.tsx`**: React Server Components natively catch thrown errors and render the nearest `error.tsx` UI boundary.

#### 2. Server Actions (`lib/**/actions.ts`) $\rightarrow$ ⚡ **Let Errors Bubble (or Structured Return)**
- Server actions run `validateOrigin()`, `validateTenant()`, `validateData()`, and service mutations.
- Let `BackendError` bubble directly to the client component `onSubmit` for inline field validation.
- > [!WARNING]
  > **If catching inside a Server Action**, you **MUST** re-throw Next.js redirects (`unstable_rethrow(error)` or `isRedirectError(error)`), otherwise `redirect('/login')` is trapped in the catch block.

#### 3. Client UI / Forms (`components/**/form.tsx`) $\rightarrow$ ✅ **MANDATORY `try-catch`**
```typescript
async function onSubmit(values: CategoryFormValues) {
  try {
    await createCategoryAction(values);
    toast.success(dict?.messages?.createSuccess || 'Created successfully');
    closeDialog();
  } catch (error) {
    if (error instanceof BackendError && error.errors) {
      error.errors.forEach((err) => {
        form.setError(err.path as any, { message: err.message, type: 'server' });
      });
    } else {
      toast.error(error?.message || dict?.messages?.createError || 'Failed');
    }
  }
}
```

#### 4. API Route Handlers (`app/api/**/route.ts`) $\rightarrow$ ✅ **MANDATORY `try-catch`**
```typescript
export async function GET() {
  try {
    const data = await getChangelogs();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    const status = error instanceof BackendError ? error.statusCode : 500;
    return NextResponse.json({ error: { message: error.message || 'Internal server error' } }, { status });
  }
}
```

---

### C. Rule of Thumb
- **`serverFetch<T>`**: Handles HTTP network call, parses RFC 7807 errors into `BackendError`, and throws.
- **`services/*.service.ts`**: **NO `try-catch`**. Pure DTO pass-through and cache-tag assignment.
- **`actions.ts`**: **NO `try-catch`** (lets `BackendError` bubble cleanly to client forms).
- **`components/*.tsx` (Forms)**: **YES `try-catch`** (maps errors to UI toasts & field validation).
- **`app/api/*/route.ts`**: **YES `try-catch`** (formats errors into HTTP `NextResponse`).

---

## 7. Financial Typography & Badge Casing Architecture Standards

### A. Number, Alignment & Font Discipline
- **Right-Alignment Rule**: All numeric and financial table headers and values MUST be right-aligned (`text-right`, `w-full justify-end`). Decimal points and place values stack directly in vertical columns for fast scanning.
- **Financial Values & Identifiers**: Use `font-mono tabular-nums text-right` (`Unit Price`, `Total`, `Subtotal`, `Tax`, `SKU`, `Barcode`, `Invoice #`).
- **Prose Counts & Units**: Use standard sans with `tabular-nums` and `items-baseline` (`10M PCS`, `2 items`, `Dates`, `Phone`). NEVER mix monospace numbers directly inside sans text strings without baseline alignment.

### B. Badge & Status Casing Decision Matrix

| Badge Category | Standard Casing | Examples | Tailwind Pattern |
| :--- | :--- | :--- | :--- |
| **Status Badges** *(Order, Payment, Stock)* | **Title Case (`capitalize`)** | `Completed`, `Partially Returned`, `Paid`, `Draft`, `Published` | `<Badge className="capitalize ...">` |
| **Roles & Permissions** | **Title Case (`capitalize`)** | `Admin`, `Manager`, `Cashier`, `Superadmin` | `<Badge className="capitalize ...">` |
| **Boolean Flags** | **Title Case (`capitalize`)** | `Yes`, `No`, `Active`, `Inactive` | `<StatusBadge type="boolean" ... />` |
| **Units & Measurement** | **Uppercase** | `PCS`, `KG`, `LTR`, `BOX`, `DOZEN` | `<span className="uppercase text-xs ...">` |
| **Technical Acronyms & Plan Tags** | **Uppercase + Letter Spacing** | `SKU`, `MRP`, `VAT`, `PRO`, `API`, `POST` | `<Badge className="text-[10px] uppercase tracking-wider font-bold">` |
| **Lowercase** | ❌ **Strictly Avoided** | - | Avoid across business tables (looks unpolished/informal). |
