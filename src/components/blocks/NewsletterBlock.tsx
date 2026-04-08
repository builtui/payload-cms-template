import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { ArrowRight } from '@/components/icons/ArrowRight'

type Props = {
  headline?: string
  description?: string
  wrapper?: WrapperProps
}

export function NewsletterBlock({ headline, description, wrapper }: Props) {
  const headlineText = headline || 'Auf dem Laufenden bleiben.'
  const words = headlineText.replace('.', '').split(' ')

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'} dividerTop={wrapper?.dividerTop ?? true}>
      <div className="md:flex md:items-end md:justify-between gap-8">
        <div className="max-w-[480px]">
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.03em]">
            {words.map((word, i) => (
              <span key={i}>
                {word}
                {i < words.length - 1 ? <br /> : '.'}
              </span>
            ))}
          </h2>
          {description && (
            <p className="text-sm text-anthracite mt-4 leading-relaxed">{description}</p>
          )}
        </div>
        <form className="mt-8 md:mt-0 shrink-0 md:w-[380px]">
          <div className="flex gap-4 mb-4">
            <input type="text" placeholder="Vorname" className="input-underline flex-1" required />
            <input type="text" placeholder="Name" className="input-underline flex-1" required />
          </div>
          <div className="flex gap-3 items-end">
            <input type="email" placeholder="E-Mail-Adresse" className="input-underline flex-1" required />
            <button type="submit" className="btn-outline whitespace-nowrap inline-flex items-center gap-1">
              Anmelden <ArrowRight />
            </button>
          </div>
        </form>
      </div>
    </BlockWrapper>
  )
}
