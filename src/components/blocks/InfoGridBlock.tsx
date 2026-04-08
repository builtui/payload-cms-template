import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type InfoItem = {
  label: string
  text: string
}

type Props = {
  sectionLabel?: string
  items?: InfoItem[]
  wrapper?: WrapperProps
}

export function InfoGridBlock({ sectionLabel, items, wrapper }: Props) {
  if (!items?.length) return null

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'}>
      <div className="md:grid md:grid-cols-12 gap-6 md:gap-8">
        {sectionLabel && (
          <div className="md:col-span-3 lg:col-span-2">
            <h3 className="text-[12px] font-bold tracking-[0.12em] uppercase mb-4 md:mb-0">{sectionLabel}</h3>
          </div>
        )}
        <div className={sectionLabel ? 'md:col-span-9 lg:col-span-8' : 'md:col-span-12'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {items.map((item, i) => (
              <div key={i}>
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">{item.label}</span>
                <p className="text-sm text-anthracite mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}
