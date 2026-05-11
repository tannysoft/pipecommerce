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
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { requestMagicLink } from './actions.ts'

const schema = z.object({
  email: z.string().min(1, 'กรุณากรอกอีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
})

type Values = z.infer<typeof schema>

export function CustomerLoginForm() {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: Values) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('email', values.email)
      const res = await requestMagicLink(formData)
      if (!res.ok) setServerError(res.error)
      else setSentTo(values.email)
    })
  }

  if (sentTo) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">ส่งอีเมลแล้ว ✓</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          เราส่งลิงก์เข้าสู่ระบบไปที่
        </p>
        <p className="mt-1 font-medium">{sentTo}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          ลิงก์มีอายุ 15 นาที — เช็คใน inbox หรือ spam folder
        </p>
        <button
          onClick={() => {
            setSentTo(null)
            form.reset()
          }}
          className="mt-4 text-sm text-primary hover:underline"
        >
          ใช้อีเมลอื่น
        </button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border bg-card p-6"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>อีเมล</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  disabled={pending}
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าสู่ระบบ'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          ระบบจะส่งลิงก์เข้าสู่ระบบไปที่อีเมลของคุณ ไม่ต้องใช้รหัสผ่าน
        </p>
      </form>
    </Form>
  )
}
