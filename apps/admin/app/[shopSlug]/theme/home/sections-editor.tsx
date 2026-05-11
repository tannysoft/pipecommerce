'use client'

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@pipecommerce/ui'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import { ImageUploadField } from '../../../_components/image-upload-field.tsx'
import { discardDraft, publishDraft, saveDraftSections } from '../actions.ts'
import {
  SECTION_LIBRARY,
  type Section,
  type SectionType,
  defaultSectionSettings,
  newSectionId,
  sectionLabel,
} from '../sections.ts'
import { SectionPreview } from './section-preview.tsx'

type Props = {
  shopSlug: string
  initialSections: Section[]
  hasDraft: boolean
}

export function SectionsEditor({ shopSlug, initialSections, hasDraft }: Props) {
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null)
  const [pending, startTransition] = useTransition()
  const [publishPending, startPublish] = useTransition()
  const [discardPending, startDiscard] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function update(next: Section[]) {
    setSections(next)
    setDirty(true)
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = sections.findIndex((s) => s.id === active.id)
    const newIdx = sections.findIndex((s) => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    update(arrayMove(sections, oldIdx, newIdx))
  }

  function addSection(type: SectionType) {
    const id = newSectionId()
    const newSection = {
      id,
      type,
      settings: defaultSectionSettings(type),
    } as Section
    update([...sections, newSection])
    setSelectedId(id)
    setShowAdd(false)
  }

  function removeSection(id: string) {
    update(sections.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(sections[0]?.id ?? null)
  }

  function updateSection(id: string, settings: Section['settings']) {
    update(
      sections.map((s) => (s.id === id ? ({ ...s, settings } as Section) : s)),
    )
  }

  function onSaveDraft() {
    setError(null)
    startTransition(async () => {
      const res = await saveDraftSections(shopSlug, sections)
      if (!res.ok) setError(res.error)
      else {
        setSavedAt(new Date())
        setDirty(false)
      }
    })
  }

  function onPublish() {
    setError(null)
    startPublish(async () => {
      // Save first if dirty
      if (dirty) {
        const saveRes = await saveDraftSections(shopSlug, sections)
        if (!saveRes.ok) {
          setError(saveRes.error)
          return
        }
        setDirty(false)
      }
      const res = await publishDraft(shopSlug)
      if (!res.ok) setError(res.error)
      else setSavedAt(new Date())
    })
  }

  function onDiscard() {
    setError(null)
    startDiscard(async () => {
      const res = await discardDraft(shopSlug)
      if (!res.ok) setError(res.error)
      else window.location.reload()
    })
  }

  const selected = sections.find((s) => s.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="text-xs text-muted-foreground">
          {dirty ? (
            <span className="text-orange-600">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
          ) : savedAt ? (
            <span>บันทึก {savedAt.toLocaleTimeString('th-TH')}</span>
          ) : hasDraft ? (
            <span>มี draft ค้างอยู่ — publish เพื่อให้ลูกค้าเห็น</span>
          ) : (
            <span>ตรงกับ live</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={pending || !dirty}
          >
            {pending ? '...' : 'Save draft'}
          </Button>
          <ConfirmDialog
            title="Publish draft?"
            description="ลูกค้าจะเห็นการเปลี่ยนแปลงทันที — ทับ version ปัจจุบัน"
            confirmLabel="Publish"
            confirmVariant="default"
            pending={publishPending}
            onConfirm={onPublish}
          >
            <Button type="button" size="sm" disabled={publishPending}>
              {publishPending ? '...' : 'Publish'}
            </Button>
          </ConfirmDialog>
          {hasDraft || dirty ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDiscard}
              disabled={discardPending}
            >
              {discardPending ? '...' : 'Discard draft'}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-3">
                {sections.map((s) => (
                  <SortableSectionRow
                    key={s.id}
                    section={s}
                    selected={s.id === selectedId}
                    onSelect={() => setSelectedId(s.id)}
                    onRemove={() => removeSection(s.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {showAdd ? (
            <div className="space-y-1.5 rounded-md border bg-card p-2">
              <p className="px-1 text-xs text-muted-foreground">เลือก section</p>
              {SECTION_LIBRARY.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => addSection(opt.type)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="block w-full rounded px-2 py-1 text-center text-xs text-muted-foreground hover:bg-muted"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-4 w-4" /> เพิ่ม section
            </Button>
          )}
        </div>

        <div className="rounded-md border bg-card p-4">
          {selected ? (
            <SectionForm
              shopSlug={shopSlug}
              section={selected}
              onChange={(settings) => updateSection(selected.id, settings)}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              เลือก section เพื่อแก้ไขการตั้งค่า
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SortableSectionRow({
  section,
  selected,
  onSelect,
  onRemove,
}: {
  section: Section
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <li ref={setNodeRef} style={style}>
      <div
        className={`group relative overflow-hidden rounded-lg border bg-card transition ${
          selected
            ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
            : 'hover:ring-1 hover:ring-foreground/30'
        }`}
      >
        {/* Header bar with drag handle, label, delete */}
        <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              aria-label="ลาก reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {sectionLabel(section.type)}
            </span>
          </div>
          <ConfirmDialog
            title="ลบ section นี้?"
            confirmLabel="ลบ"
            onConfirm={onRemove}
          >
            <button
              type="button"
              className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              aria-label="ลบ section"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </ConfirmDialog>
        </div>

        {/* Visual preview — click to select */}
        <button
          type="button"
          onClick={onSelect}
          className="block w-full text-left"
          aria-label={`เลือก ${sectionLabel(section.type)}`}
        >
          <SectionPreview section={section} />
        </button>
      </div>
    </li>
  )
}

function SectionForm({
  shopSlug,
  section,
  onChange,
}: {
  shopSlug: string
  section: Section
  onChange: (settings: Section['settings']) => void
}) {
  const s = section.settings as Record<string, unknown>

  function set<K extends string>(key: K, value: unknown) {
    onChange({ ...(s as object), [key]: value } as Section['settings'])
  }

  function setList(key: string, raw: string) {
    const list = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    set(key, list)
  }

  if (section.type === 'hero') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Hero</p>
        <Field label="Headline">
          <Input
            value={(s.headline as string) ?? ''}
            onChange={(e) => set('headline', e.target.value)}
          />
        </Field>
        <Field label="Sub headline">
          <Input
            value={(s.subheadline as string) ?? ''}
            onChange={(e) => set('subheadline', e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CTA text">
            <Input
              value={(s.ctaText as string) ?? ''}
              onChange={(e) => set('ctaText', e.target.value)}
            />
          </Field>
          <Field label="CTA URL">
            <Input
              value={(s.ctaUrl as string) ?? ''}
              onChange={(e) => set('ctaUrl', e.target.value)}
              placeholder="/products"
            />
          </Field>
        </div>
        <Field label="Background image">
          <ImageUploadField
            shopSlug={shopSlug}
            value={(s.imageUrl as string) ?? ''}
            onChange={(url) => set('imageUrl', url)}
            label="background"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Background color">
            <Input
              value={(s.backgroundColor as string) ?? ''}
              onChange={(e) => set('backgroundColor', e.target.value)}
              placeholder="#fafafa"
            />
          </Field>
          <Field label="Text color">
            <Input
              value={(s.textColor as string) ?? ''}
              onChange={(e) => set('textColor', e.target.value)}
              placeholder="#222"
            />
          </Field>
        </div>
        <Field label="Align">
          <Select
            value={(s.align as string) ?? 'center'}
            onValueChange={(v) => set('align', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="left">Left</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    )
  }

  if (section.type === 'featuredProducts') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Featured products</p>
        <Field label="Headline">
          <Input
            value={(s.headline as string) ?? ''}
            onChange={(e) => set('headline', e.target.value)}
          />
        </Field>
        <Field label="Product handles (คั่นด้วย ,)">
          <Input
            value={(s.productHandles as string[] | undefined)?.join(', ') ?? ''}
            onChange={(e) => setList('productHandles', e.target.value)}
            placeholder="my-product-1, my-product-2"
            className="font-mono text-xs"
          />
        </Field>
        <Field label="Limit (ถ้าไม่ระบุ handle)">
          <Input
            type="number"
            min="1"
            max="24"
            value={(s.limit as number | undefined) ?? 8}
            onChange={(e) => set('limit', Number(e.target.value))}
          />
        </Field>
      </div>
    )
  }

  if (section.type === 'featuredCollections') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Featured collections</p>
        <Field label="Headline">
          <Input
            value={(s.headline as string) ?? ''}
            onChange={(e) => set('headline', e.target.value)}
          />
        </Field>
        <Field label="Collection handles (คั่นด้วย ,)">
          <Input
            value={(s.collectionHandles as string[] | undefined)?.join(', ') ?? ''}
            onChange={(e) => setList('collectionHandles', e.target.value)}
            placeholder="sale, new-arrivals"
            className="font-mono text-xs"
          />
        </Field>
      </div>
    )
  }

  if (section.type === 'textBlock') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Text block</p>
        <Field label="Headline">
          <Input
            value={(s.headline as string) ?? ''}
            onChange={(e) => set('headline', e.target.value)}
          />
        </Field>
        <Field label="Body (HTML)">
          <Textarea
            rows={6}
            value={(s.body as string) ?? ''}
            onChange={(e) => set('body', e.target.value)}
          />
        </Field>
        <Field label="Align">
          <Select value={(s.align as string) ?? 'center'} onValueChange={(v) => set('align', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="left">Left</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    )
  }

  if (section.type === 'imageBanner') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Image banner</p>
        <Field label="รูปภาพ">
          <ImageUploadField
            shopSlug={shopSlug}
            value={(s.imageUrl as string) ?? ''}
            onChange={(url) => set('imageUrl', url)}
            label="banner"
          />
        </Field>
        <Field label="Link URL (optional)">
          <Input
            value={(s.link as string) ?? ''}
            onChange={(e) => set('link', e.target.value)}
          />
        </Field>
        <Field label="Alt text">
          <Input
            value={(s.altText as string) ?? ''}
            onChange={(e) => set('altText', e.target.value)}
          />
        </Field>
        <Field label="Height">
          <Select
            value={(s.height as string) ?? 'md'}
            onValueChange={(v) => set('height', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small (200px)</SelectItem>
              <SelectItem value="md">Medium (320px)</SelectItem>
              <SelectItem value="lg">Large (480px)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    )
  }

  return null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
