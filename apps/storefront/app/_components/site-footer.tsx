// Newsletter signup hidden in Phase 1 (Thai market prefers LINE OA / SMS over email)
// import { NewsletterForm } from './newsletter/newsletter-form.tsx'

type Props = {
  shopName: string
}

export function SiteFooter({ shopName }: Props) {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-12 border-t bg-card">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="text-sm">
          <h3 className="font-semibold">{shopName}</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-4">
            <li>
              <a href="/" className="hover:text-foreground">
                หน้าแรก
              </a>
            </li>
            <li>
              <a href="/products" className="hover:text-foreground">
                สินค้าทั้งหมด
              </a>
            </li>
            <li>
              <a href="/blog" className="hover:text-foreground">
                บทความ
              </a>
            </li>
            <li>
              <a href="/account" className="hover:text-foreground">
                บัญชีของฉัน
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        © {year} {shopName}. ขับเคลื่อนโดย PipeCommerce.
      </div>
    </footer>
  )
}
