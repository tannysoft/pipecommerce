/**
 * Build storefront origin for a given shop slug
 *
 * dev: http://{slug}.localhost:3000
 * prod: https://{slug}.{PLATFORM_DOMAIN}
 *
 * (custom domain support — P2: ดึงจาก shopDomains.primary)
 */
export function shopStorefrontOrigin(slug: string): string {
  if (process.env.NODE_ENV === 'production') {
    const platformDomain = process.env.PLATFORM_DOMAIN ?? 'pipecommerce.app'
    return `https://${slug}.${platformDomain}`
  }
  const port = process.env.STOREFRONT_PORT ?? '3000'
  return `http://${slug}.localhost:${port}`
}

export function shopOrderTrackingUrl(
  slug: string,
  orderNumber: string,
  trackingToken: string,
): string {
  return `${shopStorefrontOrigin(slug)}/orders/${orderNumber}?token=${trackingToken}`
}
