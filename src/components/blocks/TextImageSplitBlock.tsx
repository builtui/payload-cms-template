import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { SmartLink } from '@/components/SmartLink'
import { RichText } from '@/components/RichText'

type Props = {
  sectionLabel?: string
  body: any
  cta?: any
  image: any
  imagePosition?: 'left' | 'right'
  wrapper?: WrapperProps
}

export function TextImageSplitBlock({ sectionLabel, body, cta, image, imagePosition = 'right', wrapper }: Props) {
  const imgUrl = typeof image === 'object' ? image?.url : image
  const imgAlt = typeof image === 'object' ? image?.alt || '' : ''
  const isImageLeft = imagePosition === 'left'

  const textCol = (
    <div className={`md:col-span-4 lg:col-span-3 flex flex-col justify-between ${isImageLeft ? 'md:col-start-10 lg:col-start-10' : ''}`}>
      <div>
        {sectionLabel && (
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase mb-6 md:mb-8">{sectionLabel}</h2>
        )}
        <div className="richtext-body">
          <RichText data={body} />
        </div>
      </div>
      <SmartLink link={cta} className="link text-sm font-bold mt-8 tracking-[0.04em]" />
    </div>
  )

  const imageCol = (
    <div className={`mt-8 md:mt-0 ${isImageLeft ? 'md:col-span-7 lg:col-span-7' : 'md:col-span-7 lg:col-span-7 md:col-start-6 lg:col-start-6'}`}>
      <div className="aspect-[4/3] md:aspect-[16/10] overflow-hidden">
        {imgUrl && <img src={imgUrl} alt={imgAlt} className="img-cover" />}
      </div>
    </div>
  )

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'} dividerTop={wrapper?.dividerTop ?? true}>
      <div className="md:grid md:grid-cols-12 gap-6 md:gap-8">
        {isImageLeft ? (
          <>{imageCol}{textCol}</>
        ) : (
          <>{textCol}{imageCol}</>
        )}
      </div>
    </BlockWrapper>
  )
}
