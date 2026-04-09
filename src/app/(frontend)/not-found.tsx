import Link from 'next/link'
import { ArrowRight } from '@/components/icons/ArrowRight'

export default function NotFound() {
  return (
    <section className="pt-14 md:pt-16">
      <div className="edge pt-10 md:pt-16 min-h-[60vh] flex flex-col justify-center">
        <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray mb-4">404</p>
        <h1 className="text-[clamp(2.5rem,8vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase">
          Seite nicht gefunden
        </h1>
        <p className="text-lg text-anthracite mt-6 max-w-[480px]">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link href="/" className="link text-sm font-bold mt-8 tracking-[0.04em]">
          Zur Startseite <ArrowRight />
        </Link>
      </div>
    </section>
  )
}
