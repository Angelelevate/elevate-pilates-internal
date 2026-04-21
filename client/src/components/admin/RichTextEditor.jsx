import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Youtube from '@tiptap/extension-youtube'

const ALIGN_VALUES = new Set(['left', 'right', 'center'])

const AlignableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-align')
          if (v && ALIGN_VALUES.has(v)) return v
          const cls = el.getAttribute('class') || ''
          const match = cls.match(/img-align-(left|right|center)/)
          return match ? match[1] : null
        },
        renderHTML: (attrs) => {
          if (!attrs.align || !ALIGN_VALUES.has(attrs.align)) return {}
          return {
            'data-align': attrs.align,
            class: `img-align-${attrs.align}`,
          }
        },
      },
    }
  },
})

export function RichTextEditor({ content, onChange, onImageUpload, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      AlignableImage.configure({
        allowBase64: false,
        inline: false,
        resize: {
          enabled: true,
          minWidth: 48,
          minHeight: 48,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Subscript,
      Superscript,
      Youtube.configure({ inline: false, ccLanguage: 'en' }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your reading content…',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML())
    },
  })

  if (!editor) return null

  return (
    <div className="rte-wrap rounded-2xl border border-stone-200/60 bg-white shadow-warm-sm">
      <Toolbar editor={editor} onImageUpload={onImageUpload} />
      <EditorContent editor={editor} className="rte-content" />
      <ImageBubbleMenu editor={editor} />
    </div>
  )
}

function ImageBubbleMenu({ editor }) {
  const currentAlign = editor.getAttributes('image').align ?? null
  const setAlign = (value) =>
    editor.chain().focus().updateAttributes('image', { align: value }).run()

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => ed.isActive('image')}
      options={{ placement: 'top', offset: 8 }}
      className="flex items-center gap-0.5 rounded-xl border border-stone-200 bg-white p-1 shadow-warm"
    >
      <AlignBtn active={currentAlign === null} onClick={() => setAlign(null)} label="Inline">
        <AlignInlineIcon />
      </AlignBtn>
      <AlignBtn active={currentAlign === 'left'} onClick={() => setAlign('left')} label="Wrap left">
        <AlignWrapLeftIcon />
      </AlignBtn>
      <AlignBtn
        active={currentAlign === 'center'}
        onClick={() => setAlign('center')}
        label="Center"
      >
        <AlignCenterBlockIcon />
      </AlignBtn>
      <AlignBtn
        active={currentAlign === 'right'}
        onClick={() => setAlign('right')}
        label="Wrap right"
      >
        <AlignWrapRightIcon />
      </AlignBtn>
    </BubbleMenu>
  )
}

function AlignBtn({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-deep/10 text-deep' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
      }`}
    >
      {children}
    </button>
  )
}

function promptForLink(editor) {
  const prev = editor.getAttributes('link').href || ''
  const url = window.prompt('URL', prev)
  if (url === null) return
  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function Toolbar({ editor, onImageUpload }) {
  const fileInputRef = useRef(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)

  const handleImageUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (fileInputRef.current) fileInputRef.current.value = ''

      if (onImageUpload) {
        try {
          const url = await onImageUpload(file)
          if (url) editor.chain().focus().setImage({ src: url }).run()
        } catch {
          // upload failed, handled by caller
        }
      } else {
        const url = window.prompt('Image upload not configured. Enter image URL:')
        if (url) editor.chain().focus().setImage({ src: url }).run()
      }
    },
    [editor, onImageUpload],
  )

  const insertImageByUrl = useCallback(() => {
    const url = window.prompt('Image URL')
    if (url) editor.chain().focus().setImage({ src: url, alt: '' }).run()
  }, [editor])

  const insertYoutube = useCallback(() => {
    const url = window.prompt('YouTube video URL')
    if (url) editor.commands.setYoutubeVideo({ src: url })
  }, [editor])

  const textColors = [
    '#000000', '#374151', '#991b1b', '#9a3412', '#854d0e',
    '#166534', '#1e40af', '#5b21b6', '#9d174d', '#dc2626',
    '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed',
  ]

  const highlightColors = [
    '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fecdd3',
    '#fed7aa', '#d1fae5', '#dbeafe', '#fce7f3', '#fef9c3',
  ]

  return (
    <div className="rte-toolbar flex flex-wrap items-center gap-0.5 border-b border-stone-200/60 px-2 py-1.5">
      {/* Heading selector */}
      <select
        value={
          editor.isActive('heading', { level: 1 })
            ? '1'
            : editor.isActive('heading', { level: 2 })
              ? '2'
              : editor.isActive('heading', { level: 3 })
                ? '3'
                : editor.isActive('heading', { level: 4 })
                  ? '4'
                  : '0'
        }
        onChange={(e) => {
          const v = Number(e.target.value)
          if (v === 0) editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: v }).run()
        }}
        className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs font-medium text-stone-700 outline-none hover:bg-stone-50"
      >
        <option value="0">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        <option value="4">Heading 4</option>
      </select>

      <ToolbarDivider />

      {/* Text formatting */}
      <ToolbarBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <BoldIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <ItalicIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Underline"
      >
        <UnderlineIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strikethrough"
      >
        <StrikethroughIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('subscript')}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        label="Subscript"
      >
        <span className="text-[10px] font-bold">X<sub>2</sub></span>
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('superscript')}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        label="Superscript"
      >
        <span className="text-[10px] font-bold">X<sup>2</sup></span>
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Text color */}
      <div className="relative">
        <ToolbarBtn
          active={showColorPicker}
          onClick={() => {
            setShowColorPicker((v) => !v)
            setShowHighlightPicker(false)
            setShowTableMenu(false)
          }}
          label="Text color"
        >
          <TextColorIcon />
        </ToolbarBtn>
        {showColorPicker && (
          <ColorPalette
            colors={textColors}
            onPick={(c) => {
              editor.chain().focus().setColor(c).run()
              setShowColorPicker(false)
            }}
            onReset={() => {
              editor.chain().focus().unsetColor().run()
              setShowColorPicker(false)
            }}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      </div>

      {/* Highlight color */}
      <div className="relative">
        <ToolbarBtn
          active={showHighlightPicker || editor.isActive('highlight')}
          onClick={() => {
            setShowHighlightPicker((v) => !v)
            setShowColorPicker(false)
            setShowTableMenu(false)
          }}
          label="Highlight"
        >
          <HighlightIcon />
        </ToolbarBtn>
        {showHighlightPicker && (
          <ColorPalette
            colors={highlightColors}
            onPick={(c) => {
              editor.chain().focus().toggleHighlight({ color: c }).run()
              setShowHighlightPicker(false)
            }}
            onReset={() => {
              editor.chain().focus().unsetHighlight().run()
              setShowHighlightPicker(false)
            }}
            onClose={() => setShowHighlightPicker(false)}
          />
        )}
      </div>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarBtn
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        label="Align left"
      >
        <AlignLeftIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        label="Align center"
      >
        <AlignCenterIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        label="Align right"
      >
        <AlignRightIcon />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarBtn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
      >
        <BulletListIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Ordered list"
      >
        <OrderedListIcon />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Block elements */}
      <ToolbarBtn
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Blockquote"
      >
        <BlockquoteIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        label="Code block"
      >
        <CodeBlockIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="Horizontal rule"
      >
        <HorizontalRuleIcon />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Link */}
      <ToolbarBtn
        active={editor.isActive('link')}
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
          } else {
            promptForLink(editor)
          }
        }}
        label="Link"
      >
        <LinkIcon />
      </ToolbarBtn>

      {/* Image upload */}
      <ToolbarBtn active={false} onClick={() => fileInputRef.current?.click()} label="Upload image">
        <ImageIcon />
      </ToolbarBtn>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleImageUpload}
      />
      <ToolbarBtn active={false} onClick={insertImageByUrl} label="Image from URL">
        <ImageUrlIcon />
      </ToolbarBtn>

      {/* YouTube */}
      <ToolbarBtn active={false} onClick={insertYoutube} label="YouTube video">
        <YoutubeIcon />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Table */}
      <div className="relative">
        <ToolbarBtn
          active={showTableMenu || editor.isActive('table')}
          onClick={() => {
            setShowTableMenu((v) => !v)
            setShowColorPicker(false)
            setShowHighlightPicker(false)
          }}
          label="Table"
        >
          <TableIcon />
        </ToolbarBtn>
        {showTableMenu && (
          <TableMenu
            editor={editor}
            onClose={() => setShowTableMenu(false)}
          />
        )}
      </div>

      <div className="ml-auto" />

      {/* Undo / Redo */}
      <ToolbarBtn
        active={false}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        label="Undo"
      >
        <UndoIcon />
      </ToolbarBtn>
      <ToolbarBtn
        active={false}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        label="Redo"
      >
        <RedoIcon />
      </ToolbarBtn>
    </div>
  )
}

function ToolbarBtn({ active, onClick, label, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-deep/10 text-deep'
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
      } disabled:opacity-30 disabled:pointer-events-none`}
      title={label}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px bg-stone-200" />
}

function ColorPalette({ colors, onPick, onReset, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full z-50 mt-1.5 grid w-44 grid-cols-5 gap-1 rounded-xl border border-stone-200 bg-white p-2 shadow-warm">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="h-6 w-6 rounded-md border border-stone-200 transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        <button
          type="button"
          onClick={onReset}
          className="col-span-5 mt-1 rounded-lg px-2 py-1 text-[10px] font-medium text-stone-500 hover:bg-stone-50"
        >
          Reset
        </button>
      </div>
    </>
  )
}

function TableMenu({ editor, onClose }) {
  const isInTable = editor.isActive('table')
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-stone-200 bg-white p-1.5 shadow-warm">
        {!isInTable ? (
          <TableMenuBtn
            onClick={() => {
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              onClose()
            }}
          >
            Insert 3×3 table
          </TableMenuBtn>
        ) : (
          <>
            <TableMenuBtn onClick={() => { editor.chain().focus().addColumnBefore().run(); onClose() }}>
              Add column before
            </TableMenuBtn>
            <TableMenuBtn onClick={() => { editor.chain().focus().addColumnAfter().run(); onClose() }}>
              Add column after
            </TableMenuBtn>
            <TableMenuBtn onClick={() => { editor.chain().focus().deleteColumn().run(); onClose() }}>
              Delete column
            </TableMenuBtn>
            <div className="my-1 h-px bg-stone-100" />
            <TableMenuBtn onClick={() => { editor.chain().focus().addRowBefore().run(); onClose() }}>
              Add row above
            </TableMenuBtn>
            <TableMenuBtn onClick={() => { editor.chain().focus().addRowAfter().run(); onClose() }}>
              Add row below
            </TableMenuBtn>
            <TableMenuBtn onClick={() => { editor.chain().focus().deleteRow().run(); onClose() }}>
              Delete row
            </TableMenuBtn>
            <div className="my-1 h-px bg-stone-100" />
            <TableMenuBtn onClick={() => { editor.chain().focus().toggleHeaderRow().run(); onClose() }}>
              Toggle header row
            </TableMenuBtn>
            <TableMenuBtn
              onClick={() => { editor.chain().focus().deleteTable().run(); onClose() }}
              className="!text-red-600 hover:!bg-red-50"
            >
              Delete table
            </TableMenuBtn>
          </>
        )}
      </div>
    </>
  )
}

function TableMenuBtn({ onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 ${className}`}
    >
      {children}
    </button>
  )
}

/* ─── SVG Icons (16×16) ─── */
const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

function BoldIcon() {
  return <svg {...s}><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>
}
function ItalicIcon() {
  return <svg {...s}><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>
}
function UnderlineIcon() {
  return <svg {...s}><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" y1="20" x2="20" y2="20" /></svg>
}
function StrikethroughIcon() {
  return <svg {...s}><path d="M16 4H9a3 3 0 0 0 0 6h6" /><path d="M8 20h7a3 3 0 0 0 0-6H4" /><line x1="4" y1="12" x2="20" y2="12" /></svg>
}
function LinkIcon() {
  return <svg {...s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
}
function HighlightIcon() {
  return <svg {...s} strokeWidth={1.8}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
}
function TextColorIcon() {
  return <svg {...s}><path d="M4 20h16" strokeWidth={3} /><path d="M9.5 4h5L18 16H6L9.5 4z" fill="none" /><path d="M12 4L8.5 16" /><path d="M12 4L15.5 16" /></svg>
}
function AlignLeftIcon() {
  return <svg {...s}><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
}
function AlignCenterIcon() {
  return <svg {...s}><line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" /></svg>
}
function AlignRightIcon() {
  return <svg {...s}><line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" /></svg>
}
function BulletListIcon() {
  return <svg {...s}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>
}
function OrderedListIcon() {
  return <svg {...s}><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><text x="2" y="8" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">1</text><text x="2" y="14" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">2</text><text x="2" y="20" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">3</text></svg>
}
function BlockquoteIcon() {
  return <svg {...s} strokeWidth={1.8}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" /></svg>
}
function CodeBlockIcon() {
  return <svg {...s}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
}
function HorizontalRuleIcon() {
  return <svg {...s}><line x1="2" y1="12" x2="22" y2="12" /></svg>
}
function ImageIcon() {
  return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
}
function ImageUrlIcon() {
  return <svg {...s} strokeWidth={1.8}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M10 13a3 3 0 0 0 4.24.36l1.5-1.5a3 3 0 0 0-4.24-4.24l-.86.86" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>
}
function YoutubeIcon() {
  return <svg {...s} strokeWidth={1.8}><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></svg>
}
function TableIcon() {
  return <svg {...s} strokeWidth={1.8}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
}
function UndoIcon() {
  return <svg {...s}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
}
function RedoIcon() {
  return <svg {...s}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
}
function AlignInlineIcon() {
  return <svg {...s} strokeWidth={1.8}><line x1="3" y1="6" x2="21" y2="6" /><rect x="3" y="10" width="6" height="6" rx="1" /><line x1="11" y1="11" x2="21" y2="11" /><line x1="11" y1="15" x2="21" y2="15" /><line x1="3" y1="20" x2="21" y2="20" /></svg>
}
function AlignWrapLeftIcon() {
  return <svg {...s} strokeWidth={1.8}><rect x="3" y="5" width="8" height="8" rx="1" /><line x1="13" y1="6" x2="21" y2="6" /><line x1="13" y1="10" x2="21" y2="10" /><line x1="3" y1="16" x2="21" y2="16" /><line x1="3" y1="20" x2="21" y2="20" /></svg>
}
function AlignWrapRightIcon() {
  return <svg {...s} strokeWidth={1.8}><rect x="13" y="5" width="8" height="8" rx="1" /><line x1="3" y1="6" x2="11" y2="6" /><line x1="3" y1="10" x2="11" y2="10" /><line x1="3" y1="16" x2="21" y2="16" /><line x1="3" y1="20" x2="21" y2="20" /></svg>
}
function AlignCenterBlockIcon() {
  return <svg {...s} strokeWidth={1.8}><line x1="3" y1="5" x2="21" y2="5" /><rect x="7" y="9" width="10" height="6" rx="1" /><line x1="3" y1="19" x2="21" y2="19" /></svg>
}
