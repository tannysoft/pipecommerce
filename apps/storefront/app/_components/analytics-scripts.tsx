import Script from 'next/script'
import type { ShopAnalytics } from '@/lib/shop.ts'

/**
 * Per-shop analytics injectors
 *
 * GA4: gtag library + config
 * Meta Pixel: fbq init + PageView
 *
 * ใช้ Next.js `<Script>` strategy="afterInteractive" — โหลดหลัง page hydrate
 * เพื่อไม่บล็อก LCP. ไม่เห็น script จะไม่ส่ง analytics
 */
export function AnalyticsScripts({ analytics }: { analytics: ShopAnalytics }) {
  const ga4 = analytics.ga4MeasurementId?.trim()
  const pixel = analytics.metaPixelId?.trim()
  if (!ga4 && !pixel) return null

  return (
    <>
      {ga4 ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4}', { send_page_view: true });`}
          </Script>
        </>
      ) : null}

      {pixel ? (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixel}');
fbq('track', 'PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixel)}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
    </>
  )
}
