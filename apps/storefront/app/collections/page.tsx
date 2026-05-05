import { asc, eq } from '@pipecommerce/db'
import { collections } from '@pipecommerce/db/schema'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export default async function CollectionsListPage() {
  const shop = await requireShopFromHost()

  const list = await db
    .select({
      id: collections.id,
      title: collections.title,
      handle: collections.handle,
      description: collections.description,
    })
    .from(collections)
    .where(eq(collections.shopId, shop.id))
    .orderBy(asc(collections.title))
    .limit(100)

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {shop.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Collections</h1>
      </header>

      {list.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มี collection</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.handle}`}
              className="rounded-xl border bg-card p-4 transition hover:shadow-md"
            >
              <h2 className="font-medium">{c.title}</h2>
              {c.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {c.description}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
