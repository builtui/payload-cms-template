import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { SmartLink } from '@/components/SmartLink'
import { RichText } from '@/components/RichText'

type Props = {
  sectionLabel?: string
  body: any
  cta?: any
  wrapper?: WrapperProps
}

export function ProseSectionBlock({ sectionLabel, body, cta, wrapper }: Props) {
  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'md'}>
      <div className="md:grid md:grid-cols-12 gap-6 md:gap-8">
        {sectionLabel && (
          <div className="md:col-span-3 lg:col-span-2">
            <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase mb-4 md:mb-0">{sectionLabel}</h2>
          </div>
        )}
        <div className={`${sectionLabel ? 'md:col-span-7 lg:col-span-6' : 'md:col-span-8 lg:col-span-7'}`}>
          <div className="richtext-prose">
            <RichText data={body} />
          </div>
          <SmartLink link={cta} className="link text-sm font-bold mt-8 tracking-[0.04em]" />
        </div>
      </div>
    </BlockWrapper>
  )
}
