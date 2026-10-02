import Image from 'next/image'

/** Sprite da criatura, ou um marcador quando ela não tem imagem. */
export function SpeciesSprite({ src, alt, size = 96 }) {
  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-muted text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className="object-contain [image-rendering:pixelated]"
      style={{ width: size, height: size }}
    />
  )
}
