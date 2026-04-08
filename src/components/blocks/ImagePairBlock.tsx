import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type Props = {
  imageLeft: any
  imageRight: any
  wrapper?: WrapperProps
}

export function ImagePairBlock({ imageLeft, imageRight, wrapper }: Props) {
  const leftUrl = typeof imageLeft === 'object' ? imageLeft?.url : null
  const rightUrl = typeof imageRight === 'object' ? imageRight?.url : null

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'md'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <div className="aspect-[4/3] overflow-hidden">
          {leftUrl && <img src={leftUrl} alt={imageLeft?.alt || ''} className="img-cover" />}
        </div>
        <div className="aspect-[4/3] overflow-hidden">
          {rightUrl && <img src={rightUrl} alt={imageRight?.alt || ''} className="img-cover" />}
        </div>
      </div>
    </BlockWrapper>
  )
}
