import Link from 'next/link'
import { ArrowRight } from './icons/ArrowRight'

type Props = {
  label: string
  url: string
  className?: string
}

export function CTALink({ label, url, className = '' }: Props) {
  return (
    <Link href={url} className={`link text-sm font-bold tracking-[0.04em] ${className}`}>
      {label} <ArrowRight />
    </Link>
  )
}
