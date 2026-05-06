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
import { sendMagicLink } from './actions.ts'

const schema = z.object({
  email: z.string().min(1, 'กรุณากรอกอีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
})

type Values = z.infer<typeof schema>

export function LoginForm({ next }: { next: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok?: boolean; email?: string; error?: string } | null>(
    null,
  )

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: Values) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('email', values.email)
      formData.append('next', next)
      const res = await sendMagicLink(formData)
      setResult(res)
    })
  }

  if (result?.ok) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">📧 ส่งลิงก์ไปที่ {result.email} แล้ว</p>
        <p className="text-muted-foreground">เปิดเมล แล้วคลิกลิงก์เพื่อเข้าระบบ</p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  placeholder="you@example.com"
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {result?.error ? <p className="text-sm text-destructive">{result.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าใช้งาน'}
        </Button>
      </form>
    </Form>
  )
}
