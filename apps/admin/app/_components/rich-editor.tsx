'use client'

import { Button } from '@pipecommerce/ui'
import { Node, mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Columns2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Undo,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { uploadEditorImage } from './editor-actions.ts'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columnBlock: {
      insertColumns: (count: number) => ReturnType
    }
  }
}

const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'tiptap-column' }),
      0,
    ]
  },
})

const ColumnBlock = Node.create({
  name: 'columnBlock',
  group: 'block',
  content: 'column column+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column-block"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const cols = node.childCount
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column-block',
        class: `tiptap-columns tiptap-columns-${cols}`,
      }),
      0,
    ]
  },
  addCommands() {
    return {
      insertColumns:
        (count: number) =>
        ({ chain }) => {
          const columns = Array.from({ length: count }, () => ({
            type: 'column',
            content: [{ type: 'paragraph' }],
          }))
          return chain()
            .insertContent({ type: 'columnBlock', content: columns })
            .focus()
            .run()
        },
    }
  },
})

type Props = {
  shopSlug: string
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  minHeight?: number
}

export function RichEditor({
  shopSlug,
  value,
  onChange,
  disabled,
  minHeight = 320,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [uploadError, setUploadError] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ allowBase64: false, inline: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: 'เริ่มเขียน...' }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'tiptap-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      ColumnBlock,
      Column,
    ],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          'tiptap prose prose-sm max-w-none focus:outline-none px-4 py-3 min-h-[200px]',
      },
    },
  })

  function pickImage() {
    fileInputRef.current?.click()
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadEditorImage(shopSlug, fd)
      if (!res.ok) {
        setUploadError(res.error)
        return
      }
      editor.chain().focus().setImage({ src: res.url }).run()
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ',
      )
    } finally {
      setUploading(false)
    }
  }

  function setLink() {
    if (!editor) return
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  if (!editor) return null

  return (
    <div className="rounded-md border bg-background">
      <Toolbar
        editor={editor}
        disabled={disabled || uploading}
        onPickImage={pickImage}
        onSetLink={setLink}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        onChange={onFilePicked}
        className="hidden"
      />
      {uploading ? (
        <p className="border-b bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          กำลังอัปโหลดรูป...
        </p>
      ) : null}
      {uploadError ? (
        <p className="border-b bg-destructive/10 px-3 py-1 text-xs text-destructive">
          {uploadError}
        </p>
      ) : null}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function Toolbar({
  editor,
  disabled,
  onPickImage,
  onSetLink,
}: {
  editor: ReturnType<typeof useEditor>
  disabled?: boolean
  onPickImage: () => void
  onSetLink: () => void
}) {
  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        disabled={disabled}
        title="หัวข้อ 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        disabled={disabled}
        title="หัวข้อ 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        disabled={disabled}
        title="หัวข้อ 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        disabled={disabled}
        title="ตัวหนา (⌘B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        disabled={disabled}
        title="ตัวเอียง (⌘I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        disabled={disabled}
        title="ขีดทับ"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        disabled={disabled}
        title="Inline code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        disabled={disabled}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        disabled={disabled}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        disabled={disabled}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={onSetLink} active={editor.isActive('link')} disabled={disabled} title="Link">
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onPickImage} disabled={disabled} title="แทรกรูป">
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().insertColumns(2).run()}
        disabled={disabled}
        title="2 columns"
      >
        <Columns2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().insertColumns(3).run()}
        disabled={disabled}
        title="3 columns"
      >
        <Columns3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        disabled={disabled}
        title="แทรกตาราง"
      >
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>
      {editor.isActive('table') ? (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            disabled={disabled}
            title="เพิ่ม column"
          >
            <Plus className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            disabled={disabled}
            title="เพิ่มแถว"
          >
            <Minus className="h-4 w-4 rotate-90" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            disabled={disabled}
            title="ลบตาราง"
          >
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
          title="Undo (⌘Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
          title="Redo (⌘⇧Z)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />
}
