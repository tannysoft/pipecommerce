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
import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createShop } from './actions.ts'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

const schema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อร้าน'),
  slug: z
    .string()
    .min(3, 'อย่างน้อย 3 ตัวอักษร')
    .max(30, 'ยาวเกิน 30 ตัว')
    .regex(SLUG_RE, 'ใช้ได้เฉพาะ a-z, 0-9, -'),
})

type Values = z.infer<typeof schema>

export function OnboardingForm() {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '' },
  })

  const nameValue = form.watch('name')
  useEffect(() => {
    if (!slugTouched) form.setValue('slug', slugify(nameValue))
  }, [nameValue, slugTouched, form])

  function onSubmit(values: Values) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('slug', values.slug)
      const res = await createShop(formData)
      if (!res.ok) setServerError(res.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ชื่อร้าน</FormLabel>
              <FormControl>
                <Input disabled={pending} placeholder="ร้านน่ารัก" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL ของร้าน</FormLabel>
              <FormControl>
                <Input
                  disabled={pending}
                  pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                  minLength={3}
                  maxLength={30}
                  placeholder="my-shop"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e.target.value.toLowerCase())
                    setSlugTouched(true)
                  }}
                />
              </FormControl>
              <FormDescription>a-z, 0-9, - เท่านั้น (3-30 ตัว)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'กำลังสร้าง...' : 'สร้างร้าน'}
        </Button>
      </form>
    </Form>
  )
}
