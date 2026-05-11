'use client'

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import {
  cancelOrder,
  closeOrder,
  markOrderFulfilled,
  markOrderPaid,
  refundOrder,
  reopenOrder,
} from '../actions.ts'

type Props = {
  shopSlug: string
  orderId: string
  financialStatus: string
  fulfillmentStatus: string
  status: string
  totalPrice: string
  currency: string
}

export function OrderStatusActions({
  shopSlug,
  orderId,
  financialStatus,
  fulfillmentStatus,
  status,
  totalPrice,
  currency,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) setError(res.error)
    })
  }

  function onCancelSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await cancelOrder(shopSlug, orderId, formData)
      if (!res.ok) setError(res.error)
      else setCancelOpen(false)
    })
  }

  function onRefundSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await refundOrder(shopSlug, orderId, formData)
      if (!res.ok) setError(res.error)
      else setRefundOpen(false)
    })
  }

  const isCancelled = status === 'cancelled'
  const isClosed = status === 'closed'
  const canRefund =
    financialStatus === 'paid' || financialStatus === 'partially_refunded'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {financialStatus === 'pending' && !isCancelled ? (
          <ConfirmDialog
            title="Mark order paid?"
            description="ยืนยันว่าได้รับเงินจากลูกค้าแล้ว — ลูกค้าจะได้รับ notification"
            confirmLabel="Mark paid"
            confirmVariant="default"
            pending={pending}
            onConfirm={() => run(() => markOrderPaid(shopSlug, orderId))}
          >
            <Button size="sm" disabled={pending}>
              Mark paid
            </Button>
          </ConfirmDialog>
        ) : null}

        {financialStatus === 'paid' &&
        fulfillmentStatus === 'unfulfilled' &&
        !isCancelled ? (
          <ConfirmDialog
            title="Mark fulfilled?"
            description="ยืนยันว่าส่งสินค้าให้ลูกค้าแล้ว"
            confirmLabel="Mark fulfilled"
            confirmVariant="default"
            pending={pending}
            onConfirm={() => run(() => markOrderFulfilled(shopSlug, orderId))}
          >
            <Button size="sm" disabled={pending}>
              Mark fulfilled
            </Button>
          </ConfirmDialog>
        ) : null}

        {!isClosed && !isCancelled ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => closeOrder(shopSlug, orderId))}
          >
            ปิด order
          </Button>
        ) : null}

        {isClosed ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => reopenOrder(shopSlug, orderId))}
          >
            เปิด order ใหม่
          </Button>
        ) : null}

        {canRefund ? (
          <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                คืนเงิน
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form action={onRefundSubmit}>
                <DialogHeader>
                  <DialogTitle>คืนเงิน order #{orderId.slice(0, 8)}</DialogTitle>
                  <DialogDescription>
                    บันทึกการคืนเงินในระบบ + แจ้งลูกค้าทาง email
                    การโอนเงินจริงต้องทำผ่าน payment provider แยก (Beam)
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="refund-amount">จำนวนเงิน ({currency})</Label>
                    <Input
                      id="refund-amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={totalPrice}
                      defaultValue={totalPrice}
                      required
                      disabled={pending}
                    />
                    <p className="text-xs text-muted-foreground">
                      ยอด order = {currency} {Number(totalPrice).toLocaleString('th-TH')} ·
                      น้อยกว่ายอดนี้ = partial refund
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refund-reason">เหตุผล (optional)</Label>
                    <Input
                      id="refund-reason"
                      name="reason"
                      placeholder="เช่น สินค้าเสียหาย, ลูกค้าขอคืน"
                      disabled={pending}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={pending}>
                      ปิด
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={pending}>
                    {pending ? '...' : 'ยืนยันคืนเงิน'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}

        {!isCancelled ? (
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={pending}>
                ยกเลิก order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form action={onCancelSubmit}>
                <DialogHeader>
                  <DialogTitle>ยกเลิก order นี้?</DialogTitle>
                  <DialogDescription>
                    การยกเลิกเป็น irreversible — สถานะจะเปลี่ยนเป็น cancelled
                    (refund แยกต่างหาก)
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-2">
                  <Label htmlFor="cancel-reason">เหตุผล (optional)</Label>
                  <Input
                    id="cancel-reason"
                    name="reason"
                    placeholder="เช่น ลูกค้าขอยกเลิก, ของหมด"
                    disabled={pending}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={pending}>
                      ปิด
                    </Button>
                  </DialogClose>
                  <Button type="submit" variant="destructive" disabled={pending}>
                    {pending ? '...' : 'ยืนยันยกเลิก'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
