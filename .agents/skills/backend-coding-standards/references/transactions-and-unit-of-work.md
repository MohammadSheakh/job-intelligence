# Database Transaction Architecture: The Gold Standard

This reference document defines the strict database transaction and Unit of Work standards across all backend NestJS modules.

---

## 1. The Two Banned Anti-Patterns

### ❌ Anti-Pattern 1: Service-Level `tx` Prop-Drilling (`repo.create(data, tx)`)
- **What it looks like**: Passing `tx` down through 8+ method parameters from the service layer.
- **Why it is BANNED**:
  - Leaks the database driver / ORM transaction handle into the business service layer.
  - **Human Error Guarantee**: If a developer forgets `tx` on step 7 out of 8 (`await this.userRepo.create(data)`), that query executes on the main pool outside the transaction. When step 8 fails, step 7 is **NOT rolled back**, causing silent data corruption and orphaned records in production.

### ❌ Anti-Pattern 2: The Mega-Repository "God Method" (`TenantRepository.onboardWithEverything()`)
- **What it looks like**: A single repository writing to 8 different database tables inside an internal transaction.
- **Why it is BANNED**:
  - Violates Single Responsibility Principle (SRP) and Domain-Driven Design (DDD).
  - Duplicates entity creation logic (e.g. password hashing, role templates, audit logs) across multiple repositories, creating severe maintenance debt.

---

## 2. The 3-Tier Global Transaction Hierarchy

```
                                  ┌─────────────────────────────────────────────────────────────┐
                                  │      Global Gold Standard Transaction Decision Tree         │
                                  └──────────────────────────────┬──────────────────────────────┘
                                                                 │
                                       Is it a Parent-Child Aggregate Root?
                                       (e.g., Order + OrderItems + OrderPayments)
                                            ├── YES ──► Pattern 1: Aggregate Root Repository (Encapsulated)
                                            │
                                            └── NO ───► Does it span Multiple Independent Aggregates?
                                                        (e.g., Tenant + User + Role + POS Settings)
                                                             │
                                                             ├── Immediate Consistency Required?
                                                             │   └── YES ──► Pattern 2: Ambient Unit of Work (AsyncLocalStorage)
                                                             │
                                                             └── Eventual Consistency Allowed?
                                                                 └── YES ──► Pattern 3: Domain Events / Outbox Pattern
```

---

## 3. Implementation Patterns

### Pattern 1: Aggregate Root Internal Transactions (Parent-Child Entities)
- **When to Use**: Master-detail tables where children have no independent domain lifecycle (`orders` + `order_items` + `order_payments`, `items` + `item_variants`).
- **Standard**: Encapsulate the transaction **internally inside the Aggregate Repository** (`OrderRepository.createOrderWithItems()`). This is 100% compliant with DDD.

### Pattern 2: Ambient Unit of Work via `AsyncLocalStorage` (Cross-Aggregate Operations)
- **When to Use**: Complex business workflows spanning multiple independent repositories (`Tenant` + `User` + `Role` + `PosSettings`).
- **Standard**: The Service invokes `this.unitOfWork.run(async () => { ... })`. The active transaction `tx` is automatically stored in the request's `AsyncLocalStorage`. Repositories call `getTenantDb()` and automatically execute inside `tx` with **zero `tx` parameter passing**.

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

### Pattern 3: Domain Events / Outbox Pattern (Asynchronous Cross-Module Side Effects)
- **When to Use**: Long-running or non-blocking side effects (sending verification emails, Stripe customer creation, seeding large demo catalogs).
- **Standard**: Commit core entity transaction immediately $\rightarrow$ emit a domain event (`TenantCreatedEvent`) $\rightarrow$ background event handlers process asynchronously without holding database locks.

---

## 4. Metric Comparison Matrix

| Metric | Service `tx` Prop-Drilling | Mega-Repository | **Ambient Unit of Work (Gold Standard)** |
| :--- | :---: | :---: | :---: |
| **Service Layer Cleanliness** | ❌ Messy (Manual `tx` coordination) | ✅ Clean | 🏆 **100% Clean Business Orchestrator** |
| **Single Responsibility (SRP)** | ✅ Good | ❌ Broken (8 tables in 1 repo) | 🏆 **100% Preserved (1 table per repo)** |
| **Transaction Safety** | ⚠️ Fragile (1 missed `tx` breaks rollback) | ✅ Safe | 🏆 **Bulletproof (Automatic context binding)** |
| **Code Reusability** | ✅ Good | ❌ Duplicated Logic | 🏆 **100% Reused across codebase** |
| **Developer Ergonomics** | ❌ Tedious (`tx?: any` everywhere) | ❌ Giant files | 🏆 **Seamless (`getDb()` auto-binds)** |
