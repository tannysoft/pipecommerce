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
  Textarea,
} from '@pipecommerce/ui'
import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createProduct } from '../actions.ts'

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

const schema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อสินค้า'),
  handle: z
    .string()
    .min(1, 'กรุณากรอก handle')
    .max(60, 'ยาวเกิน 60 ตัว')
    .regex(HANDLE_RE, 'ใช้ได้เฉพาะ a-z, 0-9, -'),
  price: z.coerce.number({ invalid_type_error: 'ต้องเป็นตัวเลข' }).min(0, 'ต้อง ≥ 0'),
  description: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(['draft', 'active'], { required_error: 'เลือก status' }),
})

type Values = z.infer<typeof schema>

export function NewProductForm({ shopSlug }: { shopSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [handleTouched, setHandleTouched] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      handle: '',
      price: 0,
      description: '',
      tags: '',
      status: 'draft',
    },
  })

  const titleValue = form.watch('title')
  useEffect(() => {
    if (!handleTouched) form.setValue('handle', slugify(titleValue))
  }, [titleValue, handleTouched, form])

  function onSubmit(values: Values) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(values).forEach(([k, v]) => formData.append(k, String(v ?? '')))
      const res = await createProduct(shopSlug, formData)
      if (!res.ok) setServerError(res.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ชื่อสินค้า</FormLabel>
              <FormControl>
                <Input disabled={pending} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="handle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL handle</FormLabel>
              <FormControl>
                <Input
                  disabled={pending}
                  pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                  maxLength={60}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e.target.value.toLowerCase())
                    setHandleTouched(true)
                  }}
                />
              </FormControl>
              <FormDescription>a-z, 0-9, - เท่านั้น</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ราคา (บาท)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={pending}
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                ราคาเริ่มต้น — เพิ่ม variant + ราคาแยกได้ทีหลัง
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>คำอธิบาย</FormLabel>
              <FormControl>
                <Textarea rows={4} disabled={pending} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <Input disabled={pending} placeholder="summer, sale, new" {...field} />
              </FormControl>
              <FormDescription>
                คั่นด้วย comma · lowercase อัตโนมัติ · สูงสุด 20 tags
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="draft" id="status-draft" disabled={pending} />
                    <Label htmlFor="status-draft" className="font-normal">
                      Draft
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="active" id="status-active" disabled={pending} />
                    <Label htmlFor="status-active" className="font-normal">
                      Active (เผยแพร่)
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังสร้าง...' : 'สร้างสินค้า'}
        </Button>
      </form>
    </Form>
  )
}
