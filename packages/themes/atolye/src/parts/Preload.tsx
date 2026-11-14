import type { ImageView } from "@qticaret/ui"

/**
 * An opening's LCP picture asked for first, before the parser reaches it
 * (React puts the link in <head>): its modern set at the sizes it is drawn
 * at, a phone's own picture under `media`. One per page: only the first
 * section draws it.
 */
export function Preload({
  image,
  sizes,
  media,
}: {
  image: ImageView
  sizes: string
  media?: string | undefined
}) {
  const set = image.sources.avif ?? image.sources.webp
  return (
    <link
      rel="preload"
      as="image"
      href={image.src}
      {...(set
        ? {
            imageSrcSet: set,
            imageSizes: sizes,
            type: image.sources.avif ? "image/avif" : "image/webp",
          }
        : {})}
      {...(media ? { media } : {})}
      fetchPriority="high"
    />
  )
}
