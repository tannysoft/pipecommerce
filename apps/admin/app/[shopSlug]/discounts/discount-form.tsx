'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '../../_components/confirm-dialog.tsx'
import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
} from './actions.ts'

type FormStatus = 'active' | 'disabled' | 'scheduled'
type FormType = 'percentage' | 'fixed_amount' | 'free_shipping'

type Props = {
  shopSlug: string
  mode: 'create' | 'edit'
  discountId?: string
  defaultValues: {
    code: string
    title: string
    type: FormType
    value: string
    minimumAmount: string
    usageLimit: string
    startsAt: string
    endsAt: string
    status: FormStatus
  }
}

const schema = z.object({
  code: z.string(),
  title: z.string().min(1, 'กรุณากรอก title'),
  type: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
  value: z.string(),
  minimumAmount: z.string(),
  usageLimit: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(['active', 'disabled', 'scheduled']),
})

type Values = z.infer<typeof schema>

export function DiscountForm({ shopSlug, mode, discountId, defaultValues }: Props) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const type = form.watch('type')

  function onSubmit(values: Values) {
    setServerError(null)
    setSaved(false)
    startTransition(async () => {
      const fd = new FormData()
      Object.entries(values).forEach(([k, v]) => fd.append(k, String(v ?? '')))
      const res =
        mode === 'create'
          ? await createDiscount(shopSlug, fd)
          : await updateDiscount(shopSlug, discountId!, fd)
      if (!res.ok) setServerError(res.error)
      else setSaved(true)
    })
  }

  function onDelete() {
    if (!discountId) return
    startDelete(async () => {
      await deleteDiscount(shopSlug, discountId)
    })
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title (ภายในร้าน)</FormLabel>
                <FormControl>
                  <Input
                    disabled={pending}
                    placeholder="Summer Sale 20%"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code (optional)</FormLabel>
                <FormControl>
                  <Input
                    disabled={pending}
                    placeholder="SUMMER20"
                    className="font-mono uppercase"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormDescription>
                  เว้นว่างไว้ = automatic discount (apply ทุก eligible cart)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>ประเภท</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex flex-wrap gap-3"
                  >
                    {(
                      [
                        ['percentage', 'เปอร์เซ็นต์ %'],
                        ['fixed_amount', 'จำนวนเงิน'],
                        ['free_shipping', 'ส่งฟรี'],
                      ] as const
                    ).map(([v, label]) => (
                      <div key={v} className="flex items-center gap-2">
                        <RadioGroupItem value={v} id={`type-${v}`} disabled={pending} />
                        <Label htmlFor={`type-${v}`} className="font-normal">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {type !== 'free_shipping' ? (
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {type === 'percentage' ? 'เปอร์เซ็นต์ลด (%)' : 'จำนวนเงินลด (บาท)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={type === 'percentage' ? '100' : undefined}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="minimumAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ยอดสั่งซื้อขั้นต่ำ (บาท) — optional</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={pending}
                    placeholder="เช่น 500"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="usageLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>จำกัดการใช้รวม — optional</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    disabled={pending}
                    placeholder="เช่น 100"
                    {...field}
                  />
                </FormControl>
                <FormDescription>เว้นว่าง = ไม่จำกัด</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="startsAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เริ่ม — optional</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" disabled={pending} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endsAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สิ้นสุด — optional</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" disabled={pending} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={pending}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
          {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

          <Button type="submit" disabled={pending}>
            {pending
              ? 'กำลังบันทึก...'
              : mode === 'create'
                ? 'สร้าง Discount'
                : 'บันทึก'}
          </Button>
        </form>
      </Form>

      {mode === 'edit' && discountId ? (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">ลบ discount นี้ถาวร</p>
          <ConfirmDialog
            title="ลบ discount นี้?"
            description="ลบแบบถาวร — orders ที่เคยใช้ discount นี้ยัง snapshot อยู่ใน order_discount_applications"
            confirmLabel="ลบ"
            pending={deletePending}
            onConfirm={onDelete}
          >
            <Button type="button" variant="destructive" size="sm" disabled={deletePending}>
              {deletePending ? '...' : 'Delete'}
            </Button>
          </ConfirmDialog>
        </div>
      ) : null}
    </div>
  )
}
