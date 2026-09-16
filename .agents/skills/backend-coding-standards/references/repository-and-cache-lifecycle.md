# Repository Layer & Redis Cache Lifecycle Standards

This reference document defines the exact method naming, query optimization, deletion lifecycles, and Redis caching standards for backend repositories and services.

---

## 1. Repository Method Naming Standards

- **Existence Checks & Predicates (`existsBy...`)**: Return **`Promise<boolean>`**.
  - ✅ **Standard**: `existsById(id: string)`, `existsByName(name: string)`, `existsByPhone(phone: string)`, `existsBySku(sku: string)`.
  - ❌ **Anti-Pattern**: Avoid grammatically broken names like `isExistById`, `isNameExist`, `isExistByName`.
  - **SQL Optimization**: ALWAYS select only the ID column: `columns: { id: true }`. Never `SELECT *`.
- **Relational Predicates (`has...`)**: Return **`Promise<boolean>`**.
  - Follow correct parent-to-child domain semantics:
    - ✅ `hasSubcategories(categoryId: string)` (Category owns/contains subcategories)
    - ✅ `hasItems(categoryId: string)` or `hasItems(subcategoryId: string)` (Category/Subcategory contains items)
    - ❌ **Anti-Pattern**: `isBelongToSubcategoryById` or `isBelongToItemById` (grammatically incorrect & inverts parent/child hierarchy).
- **Specific Field / Enum Queries (`get...Status`)**: Return **`Promise<EnumType | null>`** or **`Promise<number | null>`**.
  - Always optimize SQL by selecting only the needed column: `columns: { status: true }`.
- **Entity Fetch Queries (`findById`, `findByName`, `findAndCount`)**: Return **`Promise<Entity | null>`**.
  - Data-access methods must return `null` when not found, NEVER throw HTTP exceptions (`NotFoundException`) in repositories.

---

## 2. Deletion & Mutation Lifecycle Standards

| Scope | Method | SQL Operation | Return Type |
| :--- | :--- | :--- | :--- |
| **Single Mutation** | `create(data, userId)` | `INSERT INTO ...` | `Promise<Entity>` |
| | `update(id, data, userId)` | `UPDATE ... SET ...` | `Promise<Entity \| null>` |
| | `softDelete(id, userId)` | `UPDATE ... SET is_deleted = true, deleted_at = now()` | `Promise<boolean>` |
| | `restore(id)` | `UPDATE ... SET is_deleted = false, deleted_at = null` | `Promise<boolean>` |
| | `hardDelete(id)` | `DELETE FROM ... WHERE id = id` | `Promise<boolean>` |
| **Bulk Mutation** | `softDeleteMany(ids, userId)` | `UPDATE ... WHERE id IN (...)` | `Promise<number>` |
| | `restoreMany(ids)` | `UPDATE ... WHERE id IN (...)` | `Promise<number>` |
| | `hardDeleteMany(ids)` | `DELETE FROM ... WHERE id IN (...)` | `Promise<number>` |

---

## 3. Complete Repository Implementation Example

```typescript
@Injectable()
export class CategoryRepository {
  constructor(
    private readonly connectionManager: TenantConnectionManager,
    private readonly errorService: ErrorService,
  ) {}

  // 1. Single & Bulk Soft Delete (Schema/SQL manages timestamps)
  async softDelete(id: string, userId: string): Promise<boolean> {
    try {
      const db = await this.connectionManager.getTenantDb();
      await db
        .update(categories)
        .set({ isDeleted: true, deletedAt: sql`now()`, updatedBy: userId })
        .where(eq(categories.id, id));
      return true;
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryRepository.softDelete');
    }
  }

  async softDeleteMany(ids: string[], userId: string): Promise<number> {
    try {
      const db = await this.connectionManager.getTenantDb();
      const result = await db
        .update(categories)
        .set({ isDeleted: true, deletedAt: sql`now()`, updatedBy: userId })
        .where(and(inArray(categories.id, ids), eq(categories.isDeleted, false)));
      return result.rowCount ?? ids.length;
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryRepository.softDeleteMany');
    }
  }

  // 2. Single & Bulk Hard Delete
  async hardDelete(id: string): Promise<boolean> {
    try {
      const db = await this.connectionManager.getTenantDb();
      await db.delete(categories).where(eq(categories.id, id));
      return true;
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryRepository.hardDelete');
    }
  }

  async hardDeleteMany(ids: string[]): Promise<number> {
    try {
      const db = await this.connectionManager.getTenantDb();
      const result = await db.delete(categories).where(inArray(categories.id, ids));
      return result.rowCount ?? ids.length;
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryRepository.hardDeleteMany');
    }
  }

  // 3. Predicate Existence Check (Fast - only selects ID)
  async existsById(id: string): Promise<boolean> {
    try {
      const db = await this.connectionManager.getTenantDb();
      const result = await db.query.categories.findFirst({
        columns: { id: true }, // 👈 SELECT id FROM ... LIMIT 1
        where: and(eq(categories.id, id), eq(categories.isDeleted, false)),
      });
      return Boolean(result);
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryRepository.existsById');
    }
  }

  // 4. Relational Child Predicate (Fast - checks if parent has active children)
  async hasSubcategories(categoryId: string): Promise<boolean> {
    try {
      const db = await this.connectionManager.getTenantDb();
      const result = await db
        .select({ id: subCategories.id })
        .from(subCategories)
        .where(and(eq(subCategories.categoryId, categoryId), eq(subCategories.isDeleted, false)))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryRepository.hasSubcategories');
    }
  }

  // 5. Full Entity Fetch Query
  async findById(id: string): Promise<Category | null> {
    try {
      const db = await this.connectionManager.getTenantDb();
      const result = await db.query.categories.findFirst({
        where: and(eq(categories.id, id), eq(categories.isDeleted, false)),
      });
      return result || null;
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryRepository.findById');
    }
  }
}
```

---

## 4. Service Layer & Redis Cache Lifecycle Standards

- **Pure Direct DTO Returns**: Return strongly-typed entity DTOs (`Promise<CategoryResponseDto>`).
- **No Direct Database Access**: The service delegates ALL database read/write operations to the repository.
- **Business Logic Decisions**: The service decides business meaning (e.g., `if (!category) throw new NotFoundException('Category not found')`).
- **Mandatory Redis Cache Invalidation on Mutation**:
  - Every mutation (`create`, `update`, `softDelete`, `restore`, `hardDelete`, `bulk-delete`) MUST invalidate/flush relevant Redis cache keys (e.g., `delPattern('categories:${tenantId}:*')`, `del('categories:${tenantId}:${id}')`).
- **Cache-Aside Read Pattern**:
  - `findAll` and `findById` check Redis cache first (`this.cache.get`). On cache miss, fetch from repository, populate Redis (`this.cache.set`), and return.

```typescript
@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly errorService: ErrorService,
    private readonly cache: CacheService,
  ) {}

  private getTenantId(): string {
    return (tenantContext.getStore() as string) ?? 'global';
  }

  /** Invalidate all category cache keys for the current tenant */
  private async invalidate(id?: string): Promise<void> {
    const tenantId = this.getTenantId();
    await this.cache.delPattern(`categories:${tenantId}:*`);
    if (id) await this.cache.del(this.cache.buildKey('categories', tenantId, id));
  }

  async findById(id: string): Promise<CategoryResponseDto> {
    try {
      const tenantId = this.getTenantId();
      const cacheKey = this.cache.buildKey('categories', tenantId, id);

      const cached = await this.cache.get<CategoryResponseDto>(cacheKey);
      if (cached) return cached;

      const category = await this.categoryRepository.findById(id);
      if (!category) throw new NotFoundException(`Category with ID ${id} not found`);

      const result = this.mapToResponseDto(category);
      await this.cache.set(cacheKey, result, CacheService.TTL.MEDIUM);
      return result;
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryService.findById');
    }
  }

  async softDelete(id: string, userId: string): Promise<void> {
    try {
      const exists = await this.categoryRepository.existsById(id);
      if (!exists) throw new NotFoundException(`Category with ID ${id} not found`);

      const hasSub = await this.categoryRepository.hasSubcategories(id);
      if (hasSub) throw new BadRequestException(`Category with ID ${id} is bound to active subcategories`);

      await this.categoryRepository.softDelete(id, userId);
      await this.invalidate(id); // 👈 Flush Redis on mutation
    } catch (error) {
      throw this.errorService.handleError(error, 'CategoryService.softDelete');
    }
  }
}
```
