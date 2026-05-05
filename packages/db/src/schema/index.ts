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

// Phase 2c — inventory
export * from './locations.ts'
export * from './inventory-items.ts'
export * from './inventory-movements.ts'

// Phase 2d — cart + orders + fulfillments + refunds
//   discount junction tables come in Phase 2e (depend on discounts table)
export * from './carts.ts'
export * from './cart-items.ts'
export * from './orders.ts'
export * from './order-line-items.ts'
export * from './fulfillments.ts'
export * from './fulfillment-line-items.ts'
export * from './refunds.ts'
