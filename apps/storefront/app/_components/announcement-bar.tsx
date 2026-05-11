'use client'

import { useEffect, useState } from 'react'

type Message = { text: string; link?: string | null; link_text?: string | null }

type Props = {
  shopId: string
  messages: Message[]
  isDismissible: boolean
  backgroundColor: string | null
  textColor: string | null
}

export function AnnouncementBar({
  shopId,
  messages,
  isDismissible,
  backgroundColor,
  textColor,
}: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const cookieKey = `pc_announce_dismissed_${shopId}`

  useEffect(() => {
    setHydrated(true)
    if (typeof document === 'undefined') return
    const cookies = document.cookie.split(';').map((c) => c.trim())
    if (cookies.some((c) => c.startsWith(`${cookieKey}=1`))) {
      setDismissed(true)
    }
  }, [cookieKey])

  function dismiss() {
    setDismissed(true)
    if (typeof document !== 'undefined') {
      const oneWeek = 60 * 60 * 24 * 7
      document.cookie = `${cookieKey}=1; path=/; max-age=${oneWeek}; samesite=lax`
    }
  }

  if (messages.length === 0) return null
  // Render server-side without dismiss state to avoid hydration mismatch
  if (hydrated && dismissed) return null

  const msg = messages[0]!

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-center text-sm"
      style={{
        backgroundColor: backgroundColor ?? '#000',
        color: textColor ?? '#fff',
      }}
    >
      <span>
        {msg.text}
        {msg.link ? (
          <>
            {' '}
            <a href={msg.link} className="underline underline-offset-2 hover:opacity-90">
              {msg.link_text || 'ดูเพิ่ม'}
            </a>
          </>
        ) : null}
      </span>
      {isDismissible ? (
        <button
          type="button"
          onClick={dismiss}
          className="opacity-70 transition hover:opacity-100"
          aria-label="ปิดประกาศ"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
