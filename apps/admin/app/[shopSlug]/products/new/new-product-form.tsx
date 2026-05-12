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
import { Star, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { TagsInput } from '../../../_components/tags-input.tsx'
import { createProduct } from '../actions.ts'
import { uploadProductImage } from '../[productId]/image-actions.ts'

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
  tags: z.array(z.string()).max(20),
  status: z.enum(['draft', 'active'], { required_error: 'เลือก status' }),
})

type Values = z.infer<typeof schema>

type PickedImage = { file: File; previewUrl: string }

const MAX_IMAGES_AT_CREATE = 8
const MAX_BYTES = 8 * 1024 * 1024

export function NewProductForm({ shopSlug }: { shopSlug: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [handleTouched, setHandleTouched] = useState(false)
  const [picked, setPicked] = useState<PickedImage[]>([])
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const remaining = MAX_IMAGES_AT_CREATE - picked.length
    const accepted: PickedImage[] = []
    for (const file of files.slice(0, remaining)) {
      if (file.size > MAX_BYTES) {
        setServerError(`"${file.name}" ใหญ่เกิน 8 MB`)
        continue
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) })
    }
    setPicked((arr) => [...arr, ...accepted])
  }

  function removePicked(idx: number) {
    setPicked((arr) => {
      URL.revokeObjectURL(arr[idx]!.previewUrl)
      return arr.filter((_, i) => i !== idx)
    })
  }

  function moveToCover(idx: number) {
    if (idx === 0) return
    setPicked((arr) => [arr[idx]!, ...arr.filter((_, i) => i !== idx)])
  }

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => picked.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      handle: '',
      price: 0,
      description: '',
      tags: [],
      status: 'draft',
    },
  })

  const titleValue = form.watch('title')
  useEffect(() => {
    if (!handleTouched) form.setValue('handle', slugify(titleValue))
  }, [titleValue, handleTouched, form])

  function onSubmit(values: Values) {
    setServerError(null)
    setProgressMsg(null)
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(values).forEach(([k, v]) => {
        formData.append(k, Array.isArray(v) ? v.join(',') : String(v ?? ''))
      })
      const res = await createProduct(shopSlug, formData)
      if (!res.ok) {
        setServerError(res.error)
        return
      }

      // อัปโหลดรูปทีละไฟล์ — รูปแรกในรายการ = ปก (position 0)
      for (let i = 0; i < picked.length; i++) {
        setProgressMsg(`กำลังอัปโหลดรูปที่ ${i + 1}/${picked.length}...`)
        const fd = new FormData()
        fd.append('file', picked[i]!.file)
        const up = await uploadProductImage(shopSlug, res.productId, fd)
        if (!up.ok) {
          setServerError(`อัปโหลดรูปที่ ${i + 1} ไม่สำเร็จ: ${up.error}`)
          // ยังคง navigate ไปหน้า detail — user แก้ต่อในนั้นได้
          break
        }
      }

      router.push(`/${shopSlug}/products/${res.productId}`)
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
                <TagsInput
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                />
              </FormControl>
              <FormDescription>
                Enter หรือ , เพื่อเพิ่ม tag · lowercase อัตโนมัติ · สูงสุด 20 tags
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

        <FormItem>
          <FormLabel>รูปสินค้า</FormLabel>
          <FormDescription>
            รูปแรก = รูปปก · เลือกหลายไฟล์ได้ · สูงสุด {MAX_IMAGES_AT_CREATE} รูป ·
            JPG/PNG/WebP/AVIF · ≤ 8 MB/ไฟล์
          </FormDescription>

          {picked.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {picked.map((p, idx) => (
                <div
                  key={p.previewUrl}
                  className="group relative overflow-hidden rounded-lg border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  {idx === 0 ? (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm">
                      <Star className="size-3 fill-current" /> ปก
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => moveToCover(idx)}
                      disabled={pending}
                      title="ตั้งเป็นรูปปก"
                      className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-0.5 text-xs opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
                    >
                      <Star className="size-3" /> ปก
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePicked(idx)}
                    disabled={pending}
                    aria-label="ลบรูป"
                    className="absolute right-1 top-1 rounded-md bg-background/90 p-1 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {picked.length < MAX_IMAGES_AT_CREATE ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
            >
              + เลือกรูป
            </Button>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={onPickFiles}
            className="hidden"
          />
        </FormItem>

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
        {progressMsg ? (
          <p className="text-sm text-muted-foreground">{progressMsg}</p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังสร้าง...' : 'สร้างสินค้า'}
        </Button>
      </form>
    </Form>
  )
}
