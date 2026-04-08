import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type GalleryImage = {
  image: any
  title?: string
  caption?: string
}

type GalleryRow = {
  preset: '1-full' | '2-asymmetric' | '2-symmetric' | '3-equal'
  images?: GalleryImage[]
}

type Props = {
  rows?: GalleryRow[]
  wrapper?: WrapperProps
}

function getColClasses(preset: string, index: number): string {
  switch (preset) {
    case '1-full': return 'col-span-2 md:col-span-12'
    case '2-asymmetric': return index === 0 ? 'col-span-2 md:col-span-7' : 'col-span-2 md:col-span-5'
    case '2-symmetric': return 'col-span-2 md:col-span-6'
    case '3-equal': return 'col-span-1 md:col-span-4'
    default: return 'col-span-2 md:col-span-12'
  }
}

function getAspect(preset: string, index: number): string {
  switch (preset) {
    case '1-full': return 'aspect-[16/9]'
    case '2-asymmetric': return index === 0 ? 'aspect-[16/10]' : 'aspect-[3/4]'
    case '2-symmetric': return 'aspect-[4/5]'
    case '3-equal': return 'aspect-[4/5]'
    default: return 'aspect-[16/9]'
  }
}

export function GalleryGridBlock({ rows, wrapper }: Props) {
  if (!rows?.length) return null

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'} dividerTop={wrapper?.dividerTop ?? true}>
      <div className="flex flex-col gap-4 md:gap-5">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-5">
            {row.images?.map((item, ii) => {
              const imgUrl = typeof item.image === 'object' ? item.image?.url : null
              return (
                <div key={ii} className={getColClasses(row.preset, ii)}>
                  <div className={`${getAspect(row.preset, ii)} overflow-hidden`}>
                    {imgUrl && <img src={imgUrl} alt={item.image?.alt || ''} className="img-cover" />}
                  </div>
                  {item.title && <p className="text-sm font-bold mt-3">{item.title}</p>}
                  {item.caption && <p className="text-[11px] text-warm-gray mt-0.5">{item.caption}</p>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </BlockWrapper>
  )
}
