import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type Props = {
  headline: string
  subtext?: string
  wrapper?: WrapperProps
}

export function HeroBlock({ headline, subtext, wrapper }: Props) {
  return (
    <BlockWrapper
      {...wrapper}
      paddingTop={wrapper?.paddingTop || 'none'}
      paddingBottom={wrapper?.paddingBottom || 'none'}
      headerOffset
      className="min-h-[80vh] md:min-h-[88vh] flex flex-col justify-end"
    >
      <div className="pb-8 md:pb-12">
        <h1 className="text-[14vw] md:text-[11.5vw] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase ml-[-0.05em]">
          {headline}
        </h1>
        {subtext && (
          <div className="mt-8 md:mt-10 md:flex md:items-end md:justify-between gap-8">
            <p className="text-base md:text-lg leading-relaxed text-anthracite max-w-[400px] md:ml-[12vw]">
              {subtext}
            </p>
            <div className="text-[11px] text-warm-gray tracking-[0.06em] uppercase mt-4 md:mt-0 lg:hidden">
              Friedrichsstr. 25, Kassel · Mi–So, 14–19 Uhr
            </div>
          </div>
        )}
      </div>
    </BlockWrapper>
  )
}
