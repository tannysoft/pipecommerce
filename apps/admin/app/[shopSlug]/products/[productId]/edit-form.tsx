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
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import { TagsInput } from '../../../_components/tags-input.tsx'
import { archiveProduct, unarchiveProduct, updateProduct } from '../actions.ts'

type Product = {
  id: string
  title: string
  handle: string
  description: string | null
  status: string
  tags: string[]
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
  tags: z.array(z.string()).max(20),
  status: z.enum(['draft', 'active']),
})

type Values = z.infer<typeof schema>

export function ProductEditForm({
  shopSlug,
  product,
  price,
}: {
  shopSlug: string
  product: Product
  price: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [archivePending, startArchive] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isArchived = product.status === 'archived'

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: product.title,
      handle: product.handle,
      price: price ? Number(price) : 0,
      description: product.description ?? '',
      tags: product.tags,
      status: isArchived ? 'draft' : (product.status as Values['status']),
    },
  })

  function onSubmit(values: Values) {
    setServerError(null)
    setSaved(false)
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(values).forEach(([k, v]) => {
        formData.append(k, Array.isArray(v) ? v.join(',') : String(v ?? ''))
      })
      const res = await updateProduct(shopSlug, product.id, formData)
      if (!res.ok) setServerError(res.error)
      else setSaved(true)
    })
  }

  function runArchive() {
    startArchive(async () => {
      if (isArchived) {
        await unarchiveProduct(shopSlug, product.id)
      } else {
        await archiveProduct(shopSlug, product.id)
      }
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
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                  />
                </FormControl>
                <FormDescription>
                  ⚠ การเปลี่ยน handle จะทำให้ URL เก่าเสีย (อนาคต system จะ auto-create 301 redirect)
                </FormDescription>
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
                  <Input type="number" step="0.01" min="0" disabled={pending} {...field} />
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
                  <TagsInput
                    value={field.value}
                    onChange={field.onChange}
                    disabled={pending}
                  />
                </FormControl>
                <FormDescription>
                  Enter หรือ , เพื่อเพิ่ม tag · สูงสุด 20 tags
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isArchived ? (
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
                        <RadioGroupItem
                          value="draft"
                          id="status-draft"
                          disabled={pending}
                        />
                        <Label htmlFor="status-draft" className="font-normal">
                          Draft
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="active"
                          id="status-active"
                          disabled={pending}
                        />
                        <Label htmlFor="status-active" className="font-normal">
                          Active
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              สินค้านี้ถูก archive แล้ว — ใช้ปุ่มด้านล่าง toggle
            </div>
          )}

          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
          {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending || isArchived}>
              {pending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {isArchived ? 'สินค้านี้ถูก archive แล้ว' : 'Archive แทนการลบ'}
        </p>
        {isArchived ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={archivePending}
            onClick={runArchive}
          >
            {archivePending ? '...' : 'Unarchive'}
          </Button>
        ) : (
          <ConfirmDialog
            title="Archive สินค้านี้?"
            description="ลูกค้าจะไม่เห็นในหน้า storefront จนกว่าจะ unarchive"
            confirmLabel="Archive"
            pending={archivePending}
            onConfirm={runArchive}
          >
            <Button type="button" variant="destructive" size="sm" disabled={archivePending}>
              {archivePending ? '...' : 'Archive'}
            </Button>
          </ConfirmDialog>
        )}
      </div>
    </div>
  )
}
