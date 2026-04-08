import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type Props = {
  title: string
  subtitle?: string
  size?: 'large' | 'medium'
  wrapper?: WrapperProps
}

export function PageTitleBlock({ title, subtitle, size = 'large', wrapper }: Props) {
  const headlineClass = size === 'large'
    ? 'text-[clamp(3rem,10vw,8rem)] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase'
    : 'text-[clamp(2.5rem,8vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase'

  return (
    <BlockWrapper
      {...wrapper}
      paddingBottom={wrapper?.paddingBottom || 'none'}
      headerOffset
    >
      <div className="pt-10 md:pt-16 pb-8 md:pb-10">
        <h1 className={headlineClass}>{title}</h1>
        {subtitle && (
          <p className="text-lg md:text-xl text-anthracite mt-4">{subtitle}</p>
        )}
      </div>
    </BlockWrapper>
  )
}
