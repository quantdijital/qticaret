import type { ImageView } from "./views"

interface ResponsiveImageProps {
  image: ImageView
  /** The `sizes` attribute: how wide the picture shows at each viewport. */
  sizes: string
  /** The page's largest picture (LCP): loaded at once and first (docs/03 F18). */
  priority?: boolean
  className?: string
}

/**
 * A product picture in AVIF and WebP with the original as fallback
 * (adr/0016). Width and height are always set when known, so the page does
 * not shift when it loads (CLS).
 */
export function ResponsiveImage({
  image,
  sizes,
  priority = false,
  className,
}: ResponsiveImageProps) {
  return (
    <picture>
      {image.sources.avif && <source type="image/avif" srcSet={image.sources.avif} sizes={sizes} />}
      {image.sources.webp && <source type="image/webp" srcSet={image.sources.webp} sizes={sizes} />}
      <img
        src={image.src}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding={priority ? "sync" : "async"}
        className={className}
      />
    </picture>
  )
}
