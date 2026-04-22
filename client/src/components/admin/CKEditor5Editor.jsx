import { useMemo, useRef, useEffect, useState } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  ClassicEditor,
  Alignment,
  Autoformat,
  AutoImage,
  AutoLink,
  BlockQuote,
  Bold,
  Code,
  CodeBlock,
  Essentials,
  FindAndReplace,
  FontBackgroundColor,
  FontColor,
  GeneralHtmlSupport,
  Heading,
  Highlight,
  HorizontalLine,
  Image,
  ImageBlock,
  ImageCaption,
  ImageInline,
  ImageInsert,
  ImageInsertViaUrl,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Italic,
  Link,
  LinkImage,
  List,
  ListProperties,
  MediaEmbed,
  Paragraph,
  PasteFromOffice,
  PictureEditing,
  RemoveFormat,
  SourceEditing,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  TextTransformation,
  TodoList,
  Underline,
  Undo,
} from 'ckeditor5'

import 'ckeditor5/ckeditor5.css'

class SignedUrlUploadAdapter {
  constructor(loader, getUploader) {
    this.loader = loader
    this.getUploader = getUploader
    this.aborted = false
  }

  async upload() {
    const file = await this.loader.file
    if (this.aborted) throw new Error('Upload aborted')
    const uploader = this.getUploader()
    if (!uploader) throw new Error('Image upload not configured')
    const url = await uploader(file)
    if (!url) throw new Error('Upload returned no URL')
    return { default: url }
  }

  abort() {
    this.aborted = true
  }
}

const TOOLBAR = [
  'undo',
  'redo',
  '|',
  'heading',
  '|',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'subscript',
  'superscript',
  'code',
  'removeFormat',
  '|',
  'fontColor',
  'fontBackgroundColor',
  'highlight',
  '|',
  'link',
  'insertImage',
  'mediaEmbed',
  'insertTable',
  'blockQuote',
  'codeBlock',
  'horizontalLine',
  '|',
  'alignment',
  'bulletedList',
  'numberedList',
  'todoList',
  'outdent',
  'indent',
  '|',
  'findAndReplace',
  'sourceEditing',
]

// Word-style tight wrap — CKEditor only ships `side` (right). Mirror it for left.
// `className` lands on the <figure> as `image-style-X`; the CSS handles the float.
const TIGHT_WRAP_LEFT = {
  name: 'tightWrapLeft',
  title: 'Wrap left (tight)',
  modelElements: ['imageBlock'],
  className: 'image-style-tight-left',
  icon: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="8" height="7" rx="1" fill="currentColor"/><line x1="11" y1="4" x2="18" y2="4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="11" y1="7" x2="18" y2="7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="13" x2="18" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
}

const TIGHT_WRAP_RIGHT = {
  name: 'tightWrapRight',
  title: 'Wrap right (tight)',
  modelElements: ['imageBlock'],
  className: 'image-style-tight-right',
  icon: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="3" width="8" height="7" rx="1" fill="currentColor"/><line x1="2" y1="4" x2="9" y2="4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="7" x2="9" y2="7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="13" x2="18" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
}

const IMAGE_TOOLBAR = [
  'toggleImageCaption',
  'imageTextAlternative',
  '|',
  // The headline ask: Word-style tight wrap. Single-click block-image floats
  // with text flowing around them on subsequent lines/paragraphs.
  'imageStyle:tightWrapLeft',
  'imageStyle:tightWrapRight',
  '|',
  // Inline (sits in line with text) and full-width block alignment dropdown.
  'imageStyle:inline',
  'imageStyle:breakText',
  '|',
  'resizeImage',
  '|',
  'linkImage',
]

const TABLE_TOOLBAR = [
  'tableColumn',
  'tableRow',
  'mergeTableCells',
  'tableProperties',
  'tableCellProperties',
  'toggleTableCaption',
]

const HIGHLIGHT_OPTIONS = [
  { model: 'yellowMarker', class: 'marker-yellow', title: 'Yellow', color: '#fef08a', type: 'marker' },
  { model: 'greenMarker', class: 'marker-green', title: 'Green', color: '#bbf7d0', type: 'marker' },
  { model: 'blueMarker', class: 'marker-blue', title: 'Blue', color: '#bfdbfe', type: 'marker' },
  { model: 'pinkMarker', class: 'marker-pink', title: 'Pink', color: '#fecdd3', type: 'marker' },
  { model: 'purpleMarker', class: 'marker-purple', title: 'Purple', color: '#e9d5ff', type: 'marker' },
  { model: 'redPen', class: 'pen-red', title: 'Red pen', color: '#dc2626', type: 'pen' },
  { model: 'greenPen', class: 'pen-green', title: 'Green pen', color: '#166534', type: 'pen' },
]

export function CKEditor5Editor({ content, onChange, onImageUpload, placeholder }) {
  const onChangeRef = useRef(onChange)
  const onUploadRef = useRef(onImageUpload)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onUploadRef.current = onImageUpload
  }, [onImageUpload])

  const config = useMemo(
    () => ({
      licenseKey: 'GPL',
      plugins: [
        Alignment,
        Autoformat,
        AutoImage,
        AutoLink,
        BlockQuote,
        Bold,
        Code,
        CodeBlock,
        Essentials,
        FindAndReplace,
        FontBackgroundColor,
        FontColor,
        GeneralHtmlSupport,
        Heading,
        Highlight,
        HorizontalLine,
        Image,
        ImageBlock,
        ImageCaption,
        ImageInline,
        ImageInsert,
        ImageInsertViaUrl,
        ImageResize,
        ImageStyle,
        ImageToolbar,
        ImageUpload,
        Indent,
        IndentBlock,
        Italic,
        Link,
        LinkImage,
        List,
        ListProperties,
        MediaEmbed,
        Paragraph,
        PasteFromOffice,
        PictureEditing,
        RemoveFormat,
        SourceEditing,
        Strikethrough,
        Subscript,
        Superscript,
        Table,
        TableCaption,
        TableCellProperties,
        TableColumnResize,
        TableProperties,
        TableToolbar,
        TextTransformation,
        TodoList,
        Underline,
        Undo,
      ],
      toolbar: { items: TOOLBAR, shouldNotGroupWhenFull: false },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
          { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
          { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
          { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
        ],
      },
      image: {
        toolbar: IMAGE_TOOLBAR,
        styles: {
          options: [
            // Inline: image sits inside a line of text.
            'inline',
            // Block-level alignment (image breaks the line, text resumes below).
            'alignBlockLeft',
            'block',
            'alignCenter',
            'alignBlockRight',
            // Tight Word-style wrap — image floats and text wraps around it.
            TIGHT_WRAP_LEFT,
            TIGHT_WRAP_RIGHT,
          ],
        },
        resizeOptions: [
          { name: 'resizeImage:original', value: null, label: 'Original' },
          { name: 'resizeImage:25', value: '25', label: '25%' },
          { name: 'resizeImage:50', value: '50', label: '50%' },
          { name: 'resizeImage:75', value: '75', label: '75%' },
        ],
        resizeUnit: '%',
      },
      table: {
        contentToolbar: TABLE_TOOLBAR,
      },
      link: {
        addTargetToExternalLinks: true,
        defaultProtocol: 'https://',
        decorators: {
          openInNewTab: {
            mode: 'manual',
            label: 'Open in a new tab',
            attributes: { target: '_blank', rel: 'noopener noreferrer' },
          },
        },
      },
      list: {
        properties: { styles: true, startIndex: true, reversed: true },
      },
      highlight: { options: HIGHLIGHT_OPTIONS },
      // Allow style attributes that our sanitizer permits (color, alignment, width).
      htmlSupport: {
        allow: [
          {
            name: /^(figure|img|table|td|th|col|span|mark|div|p|h[1-6])$/,
            attributes: ['class', 'style', 'data-*'],
            styles: true,
          },
        ],
      },
      placeholder: placeholder || 'Start writing your reading content…',
      mediaEmbed: { previewsInData: true },
    }),
    [placeholder],
  )

  // Defer mount one paint to keep CKEditor styles from blocking initial render.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="ck-elevate rte-wrap rounded-2xl border border-stone-200/60 bg-white shadow-warm-sm">
      {ready ? (
        <CKEditor
          editor={ClassicEditor}
          config={config}
          data={content || ''}
          onReady={(editor) => {
            const fileRepository = editor.plugins.get('FileRepository')
            fileRepository.createUploadAdapter = (loader) =>
              new SignedUrlUploadAdapter(loader, () => onUploadRef.current)
          }}
          onChange={(_, editor) => {
            onChangeRef.current?.(editor.getData())
          }}
        />
      ) : (
        <div className="flex min-h-[360px] items-center justify-center text-xs text-stone-400">
          Loading editor…
        </div>
      )}
    </div>
  )
}
