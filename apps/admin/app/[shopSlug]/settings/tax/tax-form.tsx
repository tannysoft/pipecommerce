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
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { type TaxMode, updateTaxSettings } from './actions.ts'

type Props = {
  shopSlug: string
  defaultValues: { mode: TaxMode; rate: number; label: string }
}

const schema = z.object({
  mode: z.enum(['none', 'inclusive_customer', 'exclusive_customer', 'shop_absorbs']),
  rate: z.coerce.number({ invalid_type_error: 'ต้องเป็นตัวเลข' }).min(0).max(100),
  label: z.string().min(1, 'กรุณากรอก label'),
})

type Values = z.infer<typeof schema>

const MODE_OPTIONS: Array<{ value: TaxMode; title: string; desc: string }> = [
  {
    value: 'none',
    title: 'ไม่คิดภาษี',
    desc: 'ร้านที่ยังไม่จด VAT — ไม่แสดงภาษีใน checkout',
  },
  {
    value: 'inclusive_customer',
    title: 'รวมในราคาแล้ว (Tax-inclusive)',
    desc: 'ลูกค้าเห็นราคาเดิม — ระบบคำนวณภาษีจากราคาแสดง (ราคารวม VAT)',
  },
  {
    value: 'exclusive_customer',
    title: 'บวกเพิ่มจากราคา (Tax-exclusive)',
    desc: 'ลูกค้าเห็นภาษีเป็น line แยกใน checkout — บวกเพิ่มจาก subtotal',
  },
  {
    value: 'shop_absorbs',
    title: 'ร้านจ่ายภาษีเอง (Shop absorbs)',
    desc: 'ราคาที่ตั้งไว้คือราคาสุดท้าย — ร้านรับภาระภาษีเองไม่บวกให้ลูกค้า',
  },
]

export function TaxForm({ shopSlug, defaultValues }: Props) {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: defaultValues.mode,
      rate: defaultValues.rate * 100, // store as percent in form
      label: defaultValues.label,
    },
  })

  const mode = form.watch('mode')

  function onSubmit(values: Values) {
    setServerError(null)
    setSaved(false)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('mode', values.mode)
      formData.append('rate', String(values.rate / 100))
      formData.append('label', values.label)
      const res = await updateTaxSettings(shopSlug, formData)
      if (!res.ok) setServerError(res.error)
      else setSaved(true)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>โหมดภาษี</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="space-y-2"
                >
                  {MODE_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`mode-${opt.value}`}
                        disabled={pending}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`mode-${opt.value}`}
                        className="flex-1 cursor-pointer space-y-1 font-normal"
                      >
                        <div className="font-medium">{opt.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {opt.desc}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode !== 'none' ? (
          <>
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>อัตราภาษี (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    เช่น 7 = VAT 7% ของไทย · ใส่เป็น % ระบบจะแปลงเอง
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อแสดงใน checkout</FormLabel>
                  <FormControl>
                    <Input disabled={pending} placeholder="VAT 7%" {...field} />
                  </FormControl>
                  <FormDescription>
                    แสดงเป็น line ใน checkout summary (เฉพาะ exclusive mode)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
        {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </form>
    </Form>
  )
}
