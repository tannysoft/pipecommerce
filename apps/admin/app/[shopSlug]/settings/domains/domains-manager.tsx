'use client'

import { Button, Input } from '@pipecommerce/ui'
import { CheckCircle2, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { useState, useTransition } from 'react'
import {
  addCustomDomain,
  refreshDomainStatus,
  removeCustomDomain,
  type DomainStatus,
} from './actions.ts'

type Domain = {
  id: string
  hostname: string
  sslStatus: string
  cfHostnameId: string | null
  isPrimary: boolean
  verifiedAt: string | null
}

export function DomainsManager({
  shopSlug,
  domains,
  fallbackOrigin,
}: {
  shopSlug: string
  domains: Domain[]
  fallbackOrigin: string | null
}) {
  const [hostname, setHostname] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [statusByDomain, setStatusByDomain] = useState<Record<string, DomainStatus>>({})

  function onAdd() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('hostname', hostname.trim().toLowerCase())
      const res = await addCustomDomain(shopSlug, fd)
      if (!res.ok) setError(res.error)
      else setHostname('')
    })
  }

  function onRemove(domainId: string) {
    if (!confirm('ลบ domain นี้?')) return
    startTransition(async () => {
      await removeCustomDomain(shopSlug, domainId)
    })
  }

  function onRefresh(domainId: string) {
    startTransition(async () => {
      const res = await refreshDomainStatus(shopSlug, domainId)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setStatusByDomain((s) => ({ ...s, [domainId]: res }))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="narakshop.com"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          disabled={pending}
        />
        <Button type="button" onClick={onAdd} disabled={pending || !hostname.trim()}>
          เพิ่ม
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {domains.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          ยังไม่มี custom domain
        </p>
      ) : (
        <ul className="space-y-3">
          {domains.map((d) => {
            const status = statusByDomain[d.id]
            const active = d.sslStatus === 'active'
            return (
              <li key={d.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-base font-medium">{d.hostname}</code>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="size-3" /> active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {d.sslStatus}
                        </span>
                      )}
                    </div>
                    {d.verifiedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        verified {new Date(d.verifiedAt).toLocaleDateString('th-TH')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onRefresh(d.id)}
                      disabled={pending}
                      aria-label="รีเฟรชสถานะ"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onRemove(d.id)}
                      disabled={pending}
                      aria-label="ลบ"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {!active ? (
                  <div className="mt-4 space-y-2 rounded-md bg-muted/40 p-3 text-xs">
                    <p className="font-medium">
                      เพิ่ม DNS records เหล่านี้ใน domain provider ของคุณ:
                    </p>
                    {fallbackOrigin ? (
                      <div className="space-y-1 font-mono">
                        <div>CNAME &nbsp; {d.hostname} &nbsp; → &nbsp; {fallbackOrigin}</div>
                      </div>
                    ) : null}
                    {status?.verificationRecords.map((r, i) => (
                      <div key={i} className="space-y-0.5 font-mono">
                        <div>{r.type}: {r.name}</div>
                        <div className="break-all text-muted-foreground">{r.value}</div>
                      </div>
                    ))}
                    {status?.errors && status.errors.length > 0 ? (
                      <div className="flex items-start gap-1 pt-1 text-destructive">
                        <XCircle className="mt-0.5 size-3 shrink-0" />
                        <div>{status.errors.join(', ')}</div>
                      </div>
                    ) : null}
                    {!status ? (
                      <p className="text-muted-foreground">
                        กดปุ่ม <RefreshCw className="inline size-3" /> เพื่อดู records ที่ต้องเพิ่ม
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
