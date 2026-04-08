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

  if (node.type === 'paragraph') return <p key={i}>{children}</p>
  if (node.type === 'heading') {
    const Tag = (node.tag || 'h2') as keyof React.JSX.IntrinsicElements
    return <Tag key={i}>{children}</Tag>
  }
  if (node.type === 'list') {
    const Tag = node.listType === 'number' ? 'ol' : 'ul'
    return <Tag key={i}>{children}</Tag>
  }
  if (node.type === 'listitem') return <li key={i}>{children}</li>
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
