import sanitizeHtml from 'sanitize-html'

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  'h1',
  'h2',
  'h3',
  'h4',
  'img',
  'blockquote',
  'pre',
  'code',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'colgroup',
  'col',
  'span',
  'sub',
  'sup',
  'mark',
  'iframe',
  'div',
])

const allowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  '*': ['style', 'class'],
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
  th: ['colspan', 'rowspan', 'style'],
  td: ['colspan', 'rowspan', 'style'],
  col: ['span', 'style'],
  span: ['style', 'data-color'],
  mark: ['style', 'data-color'],
}

const allowedStyles = {
  '*': {
    'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
    color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
    'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
    'min-width': [/^\d+px$/],
    width: [/^\d+(%|px)$/],
  },
}

const allowedIframeHostnames = ['www.youtube.com', 'www.youtube-nocookie.com']

export function sanitizeReadingHtml(dirty) {
  return sanitizeHtml(dirty || '', {
    allowedTags,
    allowedAttributes,
    allowedStyles,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowedIframeHostnames,
  })
}
