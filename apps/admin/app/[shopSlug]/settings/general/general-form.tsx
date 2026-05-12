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
  Textarea,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { saveShopProfile } from './actions.ts'

const schema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อร้าน').max(120, 'ยาวเกิน 120 ตัวอักษร'),
  description: z.string().max(500, 'ยาวเกิน 500 ตัวอักษร').optional(),
})

type Values = z.infer<typeof schema>

export function GeneralForm({
  shopSlug,
  defaultValues,
}: {
  shopSlug: string
  defaultValues: { name: string; description: string | null }
}) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues.name,
      description: defaultValues.description ?? '',
    },
  })

  function onSubmit(values: Values) {
    setStatus(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('description', values.description ?? '')
      const res = await saveShopProfile(shopSlug, formData)
      setStatus(res)
      if (res.ok) form.reset(values)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormItem>
          <FormLabel>Slug (URL)</FormLabel>
          <Input value={shopSlug} disabled readOnly />
          <FormDescription>
            <code>{`{slug}.pipecommerce.com`}</code> — เปลี่ยนไม่ได้
            (จะกระทบลิงก์ที่แชร์ไปแล้ว)
          </FormDescription>
        </FormItem>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ชื่อร้าน *</FormLabel>
              <FormControl>
                <Input {...field} maxLength={120} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>คำอธิบายร้าน</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={4}
                  maxLength={500}
                  placeholder="เกี่ยวกับร้านของคุณ — แสดงใน SEO meta description"
                />
              </FormControl>
              <FormDescription>
                ใช้ทำ meta description ใน search engine · {field.value?.length ?? 0}/500
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending || !form.formState.isDirty}>
            {pending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
          {status?.ok ? (
            <span className="text-sm text-emerald-600">บันทึกแล้ว ✓</span>
          ) : null}
          {status && !status.ok ? (
            <span className="text-sm text-destructive">{status.error}</span>
          ) : null}
        </div>
      </form>
    </Form>
  )
}
