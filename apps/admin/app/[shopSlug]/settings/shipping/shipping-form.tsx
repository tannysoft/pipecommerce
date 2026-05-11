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
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { updateShippingSettings } from './actions.ts'

type Props = {
  shopSlug: string
  defaultValues: { defaultRate: number; freeThreshold: number | null }
}

const schema = z.object({
  defaultRate: z.coerce.number({ invalid_type_error: 'ต้องเป็นตัวเลข' }).min(0),
  freeThreshold: z.string().optional(),
})

type Values = z.infer<typeof schema>

export function ShippingForm({ shopSlug, defaultValues }: Props) {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultRate: defaultValues.defaultRate,
      freeThreshold:
        defaultValues.freeThreshold !== null ? String(defaultValues.freeThreshold) : '',
    },
  })

  function onSubmit(values: Values) {
    setServerError(null)
    setSaved(false)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('defaultRate', String(values.defaultRate))
      fd.append('freeThreshold', values.freeThreshold ?? '')
      const res = await updateShippingSettings(shopSlug, fd)
      if (!res.ok) setServerError(res.error)
      else setSaved(true)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="defaultRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ค่าส่งมาตรฐาน (บาท)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={pending}
                  placeholder="0"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                0 = ส่งฟรีตลอด · ตั้งเป็นจำนวนคงที่ต่อออเดอร์
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="freeThreshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ส่งฟรีเมื่อยอดสั่งซื้อ ≥ (บาท) — optional</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={pending}
                  placeholder="เช่น 1000"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                เว้นว่าง = ไม่มี threshold (เก็บค่าส่งทุกออเดอร์)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
        {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </form>
    </Form>
  )
}
