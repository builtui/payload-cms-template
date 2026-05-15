import React from 'react'

type LexicalNode = {
  type: string
  tag?: string
  text?: string
  format?: number
  children?: LexicalNode[]
  direction?: string
  indent?: number
  version?: number
  listType?: string
  value?: number
  [key: string]: unknown
}

type Props = {
  data: { root?: { children?: LexicalNode[] } } | null | undefined
}

function renderNode(node: LexicalNode, i: number): React.ReactNode {
  if (node.type === 'text') {
    let content: React.ReactNode = node.text || ''
    if (node.format && node.format & 1) content = <strong key={i}>{content}</strong>
    if (node.format && node.format & 2) content = <em key={i}>{content}</em>
    return content
  }

  const children = node.children?.map((child, j) => renderNode(child, j))

  // Tailwind v4 Preflight resets margins on every element to 0 — without
  // these explicit classes the paragraphs and lists collapse into one
  // visual block even though the Lexical editor saves them as discrete
  // nodes. The Boothside team hit this when editor-authored multi-paragraph
  // body copy rendered as a wall of text on the frontend. `last:mb-0`
  // keeps the trailing element from adding a phantom gap below the rich
  // text. Lists also need explicit ml + list-style because Preflight
  // strips those too.
  //
  // Empty paragraphs (editor hits Enter twice for a "blank line") are
  // dropped. Rendering them as `<p></p>` produces a 0-height element
  // that still contributes its bottom-margin, inconsistently doubling
  // the visible gap around invisible nodes. Spacing comes from the
  // explicit `mb-*` on real content elements, not from node count.
  if (node.type === 'paragraph') {
    const hasContent = node.children && node.children.some(c => {
      if (c.type === 'text') return (c.text || '').trim().length > 0
      // Inline non-text (links, formatted runs) counts as content.
      return c.type !== 'text'
    })
    if (!hasContent) return null
    return <p key={i} className="mb-6 last:mb-0">{children}</p>
  }
  if (node.type === 'heading') {
    const Tag = (node.tag || 'h2') as keyof React.JSX.IntrinsicElements
    return <Tag key={i} className="mb-3 last:mb-0">{children}</Tag>
  }
  if (node.type === 'list') {
    const Tag = node.listType === 'number' ? 'ol' : 'ul'
    const listStyle = node.listType === 'number' ? 'list-decimal' : 'list-disc'
    return <Tag key={i} className={`mb-6 last:mb-0 ml-6 ${listStyle}`}>{children}</Tag>
  }
  if (node.type === 'listitem') return <li key={i} className="mb-1 last:mb-0">{children}</li>
  if (node.type === 'link') {
    const url = (node.fields as any)?.url || node.url || '#'
    return <a key={i} href={url}>{children}</a>
  }
  if (node.type === 'linebreak') return <br key={i} />

  return <React.Fragment key={i}>{children}</React.Fragment>
}

export function RichText({ data }: Props) {
  if (!data?.root?.children) return null

  return (
    <>
      {data.root.children.map((node, i) => renderNode(node, i))}
    </>
  )
}
