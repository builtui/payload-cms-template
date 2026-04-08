import Image from 'next/image'

type Props = {
  image: any
  sizes?: string
  priority?: boolean
}

/**
 * Renders a Payload media image using Next.js <Image> with fill mode.
 * Must be placed inside a container with position: relative and defined dimensions
 * (e.g. via aspect-ratio).
 *
 * Usage:
 *   <div className="relative aspect-[16/9] overflow-hidden">
 *     <PayloadImage image={data.image} sizes="100vw" />
 *   </div>
 */
export function PayloadImage({ image, sizes = '100vw', priority = false }: Props) {
  if (!image || typeof image !== 'object' || !image.url) return null

  return (
    <Image
      src={image.url}
      alt={image.alt || ''}
      fill
      sizes={sizes}
      className="object-cover"
      priority={priority}
    />
  )
}
