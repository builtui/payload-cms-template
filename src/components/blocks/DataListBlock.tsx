import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type DataItem = {
  label: string
  value: string
}

type Props = {
  sectionLabel?: string
  items?: DataItem[]
  alignment?: 'left' | 'right'
  wrapper?: WrapperProps
}

export function DataListBlock({ sectionLabel, items, alignment = 'left', wrapper }: Props) {
  if (!items?.length) return null

  const isRight = alignment === 'right'

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'} dividerTop={wrapper?.dividerTop ?? true}>
      <div className="md:grid md:grid-cols-12 gap-6 md:gap-8">
        {sectionLabel && (
          <div className="md:col-span-3 lg:col-span-2">
            <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase mb-6 md:mb-0">{sectionLabel}</h2>
          </div>
        )}
        <div className={`${sectionLabel
          ? (isRight ? 'md:col-span-4 md:col-start-9' : 'md:col-span-7 lg:col-span-6')
          : (isRight ? 'md:col-span-4 md:col-start-9' : 'md:col-span-8 lg:col-span-7')
        }`}>
          <div className="space-y-4">
            {items.map((item, i) => (
              <div key={i} className={`flex justify-between items-baseline ${i < items.length - 1 ? 'border-b border-line pb-3' : ''}`}>
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-warm-gray">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}
