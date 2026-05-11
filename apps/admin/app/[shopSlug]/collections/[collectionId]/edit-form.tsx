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
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import { deleteCollection, updateCollection } from '../actions.ts'

type Collection = {
  id: string
  title: string
  handle: string
  description: string | null
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

export function CollectionEditForm({
  shopSlug,
  collection,
}: {
  shopSlug: string
  collection: Collection
}) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: collection.title,
      handle: collection.handle,
      description: collection.description ?? '',
    },
  })

  function onSubmit(values: Values) {
    setServerError(null)
    setSaved(false)
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(values).forEach(([k, v]) => formData.append(k, String(v ?? '')))
      const res = await updateCollection(shopSlug, collection.id, formData)
      if (!res.ok) setServerError(res.error)
      else setSaved(true)
    })
  }

  function onDelete() {
    startDelete(async () => {
      await deleteCollection(shopSlug, collection.id)
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
                <FormLabel>ชื่อ Collection</FormLabel>
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
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
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
          {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

          <Button type="submit" disabled={pending}>
            {pending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </form>
      </Form>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">ลบ collection นี้</p>
        <ConfirmDialog
          title="ลบ collection นี้?"
          description="สินค้าใน collection จะไม่ถูกลบ — แค่ unlink ออกจาก collection"
          confirmLabel="ลบ"
          pending={deletePending}
          onConfirm={onDelete}
        >
          <Button type="button" variant="destructive" size="sm" disabled={deletePending}>
            {deletePending ? '...' : 'Delete'}
          </Button>
        </ConfirmDialog>
      </div>
    </div>
  )
}
