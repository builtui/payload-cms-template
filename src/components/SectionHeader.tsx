import Link from 'next/link'
import { ArrowRight } from './icons/ArrowRight'

type Props = {
  label: string
  linkLabel?: string
  linkUrl?: string
}

export function SectionHeader({ label, linkLabel, linkUrl }: Props) {
  return (
    <div className="flex items-baseline justify-between mb-10 md:mb-12">
      <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase">{label}</h2>
      {linkLabel && linkUrl && (
        <Link href={linkUrl} className="link text-[12px] font-medium tracking-[0.04em]">
          {linkLabel} <ArrowRight />
        </Link>
      )}
    </div>
  )
}
