// Re-export every schema module so Drizzle picks up all tables.
// See docs/SCHEMA.md for the full list — added in sub-phases (2a, 2b, ...).

// Phase 1 — tenant + identity foundation
export * from './shops.ts'
export * from './shop-domains.ts'
export * from './shop-members.ts'
export * from './customers.ts'

// Phase 2a — auth (multi-provider customer auth, see ADR-011)
export * from './customer-identities.ts'
export * from './customer-sessions.ts'
export * from './shop-auth-settings.ts'

// Phase 2b — catalog
export * from './products.ts'
export * from './product-options.ts'
export * from './product-variants.ts'
export * from './product-images.ts'
export * from './collections.ts'
export * from './collection-products.ts'
