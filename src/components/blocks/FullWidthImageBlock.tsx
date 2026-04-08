import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type Props = {
  sectionLabel?: string
  image: any
  aspectRatio?: string
  wrapper?: WrapperProps
}

export function FullWidthImageBlock({ sectionLabel, image, aspectRatio = '16/9', wrapper }: Props) {
  const imgUrl = typeof image === 'object' ? image?.url : null
  if (!imgUrl) return null

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'sm'}>
      {sectionLabel && (
        <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase mb-6 md:mb-8">{sectionLabel}</h2>
      )}
      <div className="overflow-hidden" style={{ aspectRatio }}>
        <img src={imgUrl} alt={image?.alt || ''} className="img-cover" />
      </div>
    </BlockWrapper>
  )
}
