import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type Props = {
  quote: string
  wrapper?: WrapperProps
}

export function BlockquoteBlock({ quote, wrapper }: Props) {
  if (!quote) return null

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'md'} dividerTop={wrapper?.dividerTop ?? true}>
      <blockquote className="text-[clamp(1.5rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.02em] max-w-[900px]">
        {quote}
      </blockquote>
    </BlockWrapper>
  )
}
