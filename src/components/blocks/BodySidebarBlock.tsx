import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { RichText } from '@/components/RichText'

type Props = {
  body: any
  sidebarItems?: { label: string; value: string }[]
  wrapper?: WrapperProps
}

export function BodySidebarBlock({ body, sidebarItems, wrapper }: Props) {
  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'md'}>
      <div className="border-t border-line pt-10 md:pt-14">
        <div className="md:grid md:grid-cols-12 gap-6">
          <div className="md:col-span-7 lg:col-span-6 max-w-[520px]">
            <div className="richtext-body">
              <RichText data={body} />
            </div>
          </div>
          {sidebarItems && sidebarItems.length > 0 && (
            <div className="md:col-span-4 md:col-start-9 mt-8 md:mt-0">
              {sidebarItems.map((item, i) => (
                <div key={i} className={`${i > 0 ? 'border-t border-line pt-4 mt-4' : ''}`}>
                  <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">{item.label}</p>
                  <p className="text-sm mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BlockWrapper>
  )
}
