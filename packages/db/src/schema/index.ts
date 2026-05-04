// Re-export every schema module so Drizzle picks up all tables.
// Note: Phase 1 has only the core tenant/identity tables. Phase 2 will
// add catalog, orders, discounts, loyalty, themes, etc. — see docs/SCHEMA.md.

export * from './shops.ts'
export * from './shop-domains.ts'
export * from './shop-members.ts'
export * from './customers.ts'
