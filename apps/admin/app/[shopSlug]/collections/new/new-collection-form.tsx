'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from '@pipecommerce/ui'
import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createCollection } from '../actions.ts'

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
  title: z.string().min(1, 'กรุณากรอกชื่อ collection'),
  handle: z
    .string()
    .min(1, 'กรุณากรอก handle')
    .max(60, 'ยาวเกิน 60 ตัว')
    .regex(HANDLE_RE, 'ใช้ได้เฉพาะ a-z, 0-9, -'),
  description: z.string().optional(),
})

type Values = z.infer<typeof schema>

export function NewCollectionForm({ shopSlug }: { shopSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [handleTouched, setHandleTouched] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', handle: '', description: '' },
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
      const res = await createCollection(shopSlug, formData)
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
              <FormLabel>ชื่อ Collection</FormLabel>
              <FormControl>
                <Input
                  disabled={pending}
                  placeholder="เช่น สินค้าใหม่, ลดราคา"
                  {...field}
                />
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
                <Textarea rows={3} disabled={pending} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังสร้าง...' : 'สร้าง Collection'}
        </Button>
      </form>
    </Form>
  )
}
