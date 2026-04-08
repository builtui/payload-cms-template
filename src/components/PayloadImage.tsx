import Image from 'next/image'

type Props = {
  image: any
  className?: string
  sizes?: string
  priority?: boolean
}

export function PayloadImage({ image, className = '', sizes = '100vw', priority = false }: Props) {
  if (!image || typeof image !== 'object' || !image.url) return null

  return (
    <Image
      src={image.url}
      alt={image.alt || ''}
      width={image.width || 1200}
      height={image.height || 800}
      sizes={sizes}
      className={className}
      priority={priority}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}
