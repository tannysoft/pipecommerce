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
import { ImageUploadField } from '../../../_components/image-upload-field.tsx'
import { RichEditor } from '../../../_components/rich-editor.tsx'
import { createPage } from '../actions.ts'

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
  title: z.string().min(1, 'กรุณากรอก title'),
  handle: z
    .string()
    .min(1, 'กรุณากรอก handle')
    .max(60, 'ยาวเกิน 60 ตัว')
    .regex(HANDLE_RE, 'ใช้ได้เฉพาะ a-z, 0-9, -'),
  body: z.string().optional(),
  status: z.enum(['draft', 'active']),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  featuredImageUrl: z.string().optional(),
})

type Values = z.infer<typeof schema>

export function NewPageForm({ shopSlug }: { shopSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [handleTouched, setHandleTouched] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      handle: '',
      body: '',
      status: 'draft',
      seoTitle: '',
      seoDescription: '',
      featuredImageUrl: '',
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
      const res = await createPage(shopSlug, formData)
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
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  disabled={pending}
                  placeholder="เช่น About Us, Privacy Policy"
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/pages/</span>
                  <Input
                    disabled={pending}
                    pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                    maxLength={60}
                    className="flex-1"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value.toLowerCase())
                      setHandleTouched(true)
                    }}
                  />
                </div>
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
                  minHeight={350}
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

        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">SEO (optional)</summary>
          <div className="mt-3 space-y-3">
            <FormField
              control={form.control}
              name="seoTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SEO Title</FormLabel>
                  <FormControl>
                    <Input
                      disabled={pending}
                      maxLength={70}
                      placeholder="ใช้ title หลักถ้าไม่ตั้ง"
                      {...field}
                    />
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

        <FormField
          control={form.control}
          name="featuredImageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Featured image (optional)</FormLabel>
              <FormControl>
                <ImageUploadField
                  shopSlug={shopSlug}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  label="featured image"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังสร้าง...' : 'สร้าง Page'}
        </Button>
      </form>
    </Form>
  )
}
