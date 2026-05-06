import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pipecommerce/ui'
import { addProductToCollection, removeProductFromCollection } from '../actions.ts'

type Item = { id: string; title: string; handle: string }

/**
 * Server component (ไม่ใช่ client) — ใช้ Server Action ผ่าน <form>
 * Radix Select รองรับ name prop → render hidden native select ให้
 * อัตโนมัติ FormData picks up value
 */
export function CollectionProductsManager({
  shopSlug,
  collectionId,
  inCollection,
  available,
}: {
  shopSlug: string
  collectionId: string
  inCollection: Item[]
  available: Item[]
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-medium">
          สินค้าใน collection ({inCollection.length})
        </h3>
        {inCollection.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีสินค้า — เพิ่มจากด้านล่าง</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {inCollection.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.handle}</p>
                </div>
                <form
                  action={removeProductFromCollection.bind(null, shopSlug, collectionId, p.id)}
                >
                  <Button type="submit" variant="outline" size="sm">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t pt-4">
        <h3 className="font-medium">เพิ่มสินค้า</h3>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            สินค้าทั้งหมดในร้านอยู่ใน collection นี้แล้ว
          </p>
        ) : (
          <form
            action={addProductToCollection.bind(null, shopSlug, collectionId)}
            className="flex gap-2"
          >
            <div className="flex-1">
              <Select name="productId" required defaultValue={available[0]!.id}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสินค้า" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">+ Add</Button>
          </form>
        )}
      </div>
    </div>
  )
}
