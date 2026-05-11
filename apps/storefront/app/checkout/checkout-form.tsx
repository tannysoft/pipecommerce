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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { placeOrder } from './actions.ts'

const schema = z.object({
  email: z.string().min(1, 'กรุณากรอกอีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
  phone: z.string().optional(),
  firstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  lastName: z.string().optional(),
  address1: z.string().min(1, 'กรุณากรอกที่อยู่'),
  address2: z.string().optional(),
  city: z.string().min(1, 'กรุณากรอกเมือง/อำเภอ'),
  province: z.string().optional(),
  postalCode: z.string().min(1, 'กรุณากรอกรหัสไปรษณีย์').max(10),
  country: z.string().min(1),
  note: z.string().max(500).optional(),
  discountCode: z.string().optional(),
})

type Values = z.infer<typeof schema>

export function CheckoutForm() {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      phone: '',
      firstName: '',
      lastName: '',
      address1: '',
      address2: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'TH',
      note: '',
      discountCode: '',
    },
  })

  function onSubmit(values: Values) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(values).forEach(([k, v]) => formData.append(k, String(v ?? '')))
      const res = await placeOrder(formData)
      if (!res.ok) setServerError(res.error)
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border bg-card p-6"
      >
        <section className="space-y-3">
          <h2 className="font-semibold">ข้อมูลติดต่อ</h2>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>อีเมล</FormLabel>
                <FormControl>
                  <Input type="email" disabled={pending} autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เบอร์โทรศัพท์</FormLabel>
                <FormControl>
                  <Input type="tel" disabled={pending} autoComplete="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-3 border-t pt-6">
          <h2 className="font-semibold">ที่อยู่จัดส่ง</h2>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อ</FormLabel>
                  <FormControl>
                    <Input disabled={pending} autoComplete="given-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>นามสกุล</FormLabel>
                  <FormControl>
                    <Input disabled={pending} autoComplete="family-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="address1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ที่อยู่</FormLabel>
                <FormControl>
                  <Input
                    disabled={pending}
                    autoComplete="address-line1"
                    placeholder="บ้านเลขที่ ตึก ซอย ถนน"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ที่อยู่เพิ่มเติม (optional)</FormLabel>
                <FormControl>
                  <Input
                    disabled={pending}
                    autoComplete="address-line2"
                    placeholder="ห้อง ชั้น อาคาร"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เมือง/อำเภอ</FormLabel>
                  <FormControl>
                    <Input disabled={pending} autoComplete="address-level2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>จังหวัด</FormLabel>
                  <FormControl>
                    <Input disabled={pending} autoComplete="address-level1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รหัสไปรษณีย์</FormLabel>
                  <FormControl>
                    <Input
                      disabled={pending}
                      autoComplete="postal-code"
                      maxLength={10}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ประเทศ</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={pending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TH">ไทย</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-3 border-t pt-6">
          <FormField
            control={form.control}
            name="discountCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัสส่วนลด (optional)</FormLabel>
                <FormControl>
                  <Input
                    disabled={pending}
                    placeholder="เช่น SUMMER20"
                    className="font-mono uppercase"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หมายเหตุ (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={2} disabled={pending} maxLength={500} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? 'กำลังสร้างออเดอร์...' : 'สั่งซื้อ'}
        </Button>
      </form>
    </Form>
  )
}
