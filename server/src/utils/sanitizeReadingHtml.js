import sanitizeHtml from 'sanitize-html'

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  'h1',
  'h2',
  'h3',
  'h4',
  'img',
  'figure',
  'figcaption',
  'picture',
  'source',
  'blockquote',
  'pre',
  'code',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'colgroup',
  'col',
  'caption',
  'span',
  'sub',
  'sup',
  'mark',
  'iframe',
  'div',
  'oembed',
  's',
  'u',
])

// CKEditor 5 image-style classes — keep tightly scoped to known values so
// arbitrary classes can't be smuggled in. These map 1:1 to .prose CSS rules.
const CKEDITOR_IMAGE_CLASSES = [
  /^image$/,
  /^image-inline$/,
  /^image_resized$/,
  /^image-style-(side|inline|block|align-left|align-right|align-center|block-align-left|block-align-right|align-block-left|align-block-right|tight-left|tight-right)$/,
  /^ck-horizontal-line$/,
  /^todo-list(__label)?$/,
  /^marker-(yellow|green|blue|pink|purple)$/,
  /^pen-(red|green)$/,
  // Tiptap legacy alignment classes — kept so old content keeps wrapping correctly.
  /^img-align-(left|right|center)$/,
  /^text-(tiny|small|big|huge)$/,
  /^media$/,
]

const allowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  '*': ['style', 'class', 'data-align'],
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'class', 'style', 'srcset', 'sizes'],
  figure: ['class', 'style'],
  figcaption: ['class', 'style'],
  source: ['srcset', 'type', 'media', 'sizes'],
  iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
  th: ['colspan', 'rowspan', 'style', 'class', 'scope'],
  td: ['colspan', 'rowspan', 'style', 'class'],
  col: ['span', 'style'],
  span: ['style', 'class', 'data-color'],
  mark: ['style', 'class', 'data-color'],
  div: ['class', 'style'],
  oembed: ['url'],
}

const allowedStyles = {
  '*': {
    'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
    color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
    'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
    'min-width': [/^\d+(\.\d+)?(px|%)$/],
    'max-width': [/^\d+(\.\d+)?(px|%)$/],
    width: [/^\d+(\.\d+)?(%|px)$/],
    height: [/^auto$/, /^\d+(\.\d+)?(%|px)$/],
    'aspect-ratio': [/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/],
    float: [/^left$/, /^right$/, /^none$/],
    margin: [/^[\d.\s%pxauto-]+$/],
  },
}

const allowedIframeHostnames = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
]

function classFilter(input) {
  const cls = (input || '').toString().trim()
  if (!cls) return ''
  const kept = cls
    .split(/\s+/)
    .filter((c) => CKEDITOR_IMAGE_CLASSES.some((rx) => rx.test(c)))
  return kept.join(' ')
}

const transformTags = {
  '*': (tagName, attribs) => {
    if (attribs.class) {
      const filtered = classFilter(attribs.class)
      if (filtered) attribs.class = filtered
      else delete attribs.class
    }
    return { tagName, attribs }
  },
}

export function sanitizeReadingHtml(dirty) {
  return sanitizeHtml(dirty || '', {
    allowedTags,
    allowedAttributes,
    allowedStyles,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowedIframeHostnames,
    transformTags,
  })
}
