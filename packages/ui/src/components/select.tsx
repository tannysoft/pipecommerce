import * as React from 'react'
import { cn } from '../lib/utils.ts'

/**
 * Native <select> wrapper styled ตาม shadcn — ทำงานกับ form action ตรงๆ
 * (FormData picks up value โดยอัตโนมัติ ไม่ต้องใช้ Radix Select + hidden input)
 *
 * Usage:
 *   <Select name="status" defaultValue="draft">
 *     <option value="draft">Draft</option>
 *     <option value="active">Active</option>
 *   </Select>
 *
 * Optgroup ก็ใช้ได้ตามปกติ:
 *   <Select name="font">
 *     <optgroup label="Sans">
 *       <option value="inter">Inter</option>
 *     </optgroup>
 *   </Select>
 *
 * ⚠ ถ้าอยากได้ Radix Select (search, custom render, virtualized) ค่อย add
 *   เป็น component ตัวที่สอง — ใน MVP native พอ
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      // font-sans บังคับ inherit body font — native <select> ใน Safari/
      // บางเบราเซอร์ไม่ inherit font-family จาก parent (fallback เป็น
      // system font) ต้องระบุชัดเจน
      'flex h-9 w-full appearance-none rounded-md border border-input bg-transparent bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat px-3 pr-9 font-sans text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    style={{
      backgroundImage:
        'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke-width=\'1.5\' stroke=\'currentColor\' opacity=\'0.5\'%3e%3cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'m19.5 8.25-7.5 7.5-7.5-7.5\'/%3e%3c/svg%3e")',
    }}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'
