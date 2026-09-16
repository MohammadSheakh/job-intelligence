---
trigger: always_on
---

# Unified Frontend Security, Cookie & Edge Proxy Architecture Rules

All frontend authentication, cookie management, Server Action security, and edge proxy code across `user-frontend` and `admin-frontend` MUST strictly follow these rules.

---

## 1. Authentication & Cookie Discipline

- **Strict HttpOnly Cookies**: All auth tokens (`accessToken`, `refreshToken`, `csrf-token`) are strictly HTTP-only.
- **Zero Client-Side Token Storage**: NEVER store or access auth tokens in browser `localStorage`, `sessionStorage`, cookies via `document.cookie`, or client React state.
- **Forwarded Session Context**: Edge proxy and Server Components pass cookies directly to backend API calls via `serverFetch<T>`.

---

## 2. Server Action Security Guards

Every Next.js Server Action (`lib/**/actions.ts`) MUST execute these two mandatory security checks before performing any work:

1. **Anti-CSRF Origin Check**:
   ```typescript
   await validateOrigin();
   ```
2. **Tenant Isolation Enforcement (OWASP A01 Prevention)**:
   ```typescript
   const tenantId = await validateTenant();
   ```

```typescript
// ✅ GOLD STANDARD: Protected Server Action
export async function createCategoryAction(data: CategoryFormValues): Promise<CategoryResponse> {
  await validateOrigin();
  const tenantId = await validateTenant();
  const validatedData = validateData(getCategoryFormSchema(), data);
  const result = await createCategory(validatedData);
  
  updateTag(`tenant:${tenantId}:categories`);
  return result;
}
```

---

## 3. Next.js 16 Configuration (`next.config.ts`)

- **Authenticated Media Passthrough**: `images: { unoptimized: true }` is MANDATORY. Bypasses Next.js image optimization proxy to ensure browser HttpOnly auth cookies are forwarded directly to backend file endpoints.
- **Secure File Rewrites**: Map `/assets/:page/:slug/:id` -> `${BACKEND_URL}/v1/files/:id`.
- **Next.js 16 Prerendering & Cache Features**: Maintain `cacheComponents: true`, `partialPrefetching: true`, and `reactCompiler: true`.

---

## 4. Edge Proxy Layer (`proxy.ts`)

- **In-flight Refresh Token Deduplication**: Concurrent RSC requests can trigger simultaneous token refreshes, causing "Token reuse detected" session invalidation. `proxy.ts` MUST use an in-flight promise map (`inflightRefreshes` / `recentRefreshes`) to deduplicate parallel refresh operations into a single backend call.
- **Tenant Context Verification**: Validate tenant slug and token payload alignment before request routing.
- **Arcjet Edge Security**: Guard proxy entry point with bot detection and abuse protection.
