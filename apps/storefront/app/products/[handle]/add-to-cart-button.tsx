'use client'

import { Button } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { addToCart } from '@/app/cart/actions.ts'

export function AddToCartButton({ variantId }: { variantId: string }) {
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    setAdded(false)
    const formData = new FormData()
    formData.append('variantId', variantId)
    formData.append('quantity', '1')
    startTransition(async () => {
      const res = await addToCart(formData)
      if (!res.ok) setError(res.error)
      else {
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
      }
    })
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={pending} onClick={onClick}>
        {pending ? 'กำลังเพิ่ม...' : added ? 'เพิ่มแล้ว ✓ กดอีกครั้งเพื่อเพิ่มอีก' : 'เพิ่มลงตะกร้า'}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
