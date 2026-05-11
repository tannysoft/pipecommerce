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
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import { RichEditor } from '../../../_components/rich-editor.tsx'
import { TagsInput } from '../../../_components/tags-input.tsx'
import { deleteArticle, updateArticle } from '../actions.ts'

type Article = {
  id: string
  title: string
  handle: string
  body: string | null
  excerpt: string | null
  authorName: string | null
  status: string
  tags: string[]
  seoTitle: string | null
  seoDescription: string | null
}

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

const schema = z.object({
  title: z.string().min(1, 'กรุณากรอก title'),
  handle: z
    .string()
    .min(1, 'กรุณากรอก handle')
    .max(60, 'ยาวเกิน 60 ตัว')
    .regex(HANDLE_RE, 'ใช้ได้เฉพาะ a-z, 0-9, -'),
  excerpt: z.string().max(300).optional(),
  body: z.string().optional(),
  authorName: z.string().optional(),
  tags: z.array(z.string()).max(20),
  status: z.enum(['draft', 'active', 'archived']),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
})

type Values = z.infer<typeof schema>

export function ArticleEditForm({
  shopSlug,
  article,
}: {
  shopSlug: string
  article: Article
}) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: article.title,
      handle: article.handle,
      excerpt: article.excerpt ?? '',
      body: article.body ?? '',
      authorName: article.authorName ?? '',
      tags: article.tags,
      status: (article.status as Values['status']) ?? 'draft',
      seoTitle: article.seoTitle ?? '',
      seoDescription: article.seoDescription ?? '',
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
      const res = await updateArticle(shopSlug, article.id, formData)
      if (!res.ok) setServerError(res.error)
      else setSaved(true)
    })
  }

  function onDelete() {
    startDelete(async () => {
      await deleteArticle(shopSlug, article.id)
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
                <FormLabel>Title</FormLabel>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/blog/</span>
                    <Input
                      disabled={pending}
                      pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                      maxLength={60}
                      className="flex-1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="excerpt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Excerpt</FormLabel>
                <FormControl>
                  <Textarea rows={2} maxLength={300} disabled={pending} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เนื้อหา</FormLabel>
                <FormControl>
                  <RichEditor
                    shopSlug={shopSlug}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    disabled={pending}
                    minHeight={400}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="authorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อผู้เขียน</FormLabel>
                <FormControl>
                  <Input disabled={pending} {...field} />
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
                    {(['draft', 'active', 'archived'] as const).map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <RadioGroupItem value={s} id={`status-${s}`} disabled={pending} />
                        <Label htmlFor={`status-${s}`} className="font-normal capitalize">
                          {s}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <details
            className="rounded-lg border p-3 text-sm"
            open={!!article.seoTitle || !!article.seoDescription}
          >
            <summary className="cursor-pointer font-medium">SEO</summary>
            <div className="mt-3 space-y-3">
              <FormField
                control={form.control}
                name="seoTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SEO Title</FormLabel>
                    <FormControl>
                      <Input disabled={pending} maxLength={70} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seoDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SEO Description</FormLabel>
                    <FormControl>
                      <Textarea rows={2} maxLength={160} disabled={pending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </details>

          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
          {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

          <Button type="submit" disabled={pending}>
            {pending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </form>
      </Form>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">ลบบทความ (soft delete)</p>
        <ConfirmDialog
          title="ลบบทความนี้?"
          description={`"${article.title}" จะถูกซ่อนจาก storefront`}
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
