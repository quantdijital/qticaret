import type { ImageView } from "@qticaret/ui"

/** A phone's own picture shows under 640 px. */
const PHONE = "(max-width: 39.99rem)"

/**
 * A band's picture (`banner`): a phone's own under 640 px when the shop
 * gave one (the wide one then never downloaded there), else the wide one
 * cropped; sized for where it stands, its width and height set (no shift).
 */
export function BandPicture({
  image,
  phone,
  sizes,
  eager,
  mark = {},
}: {
  image: ImageView
  phone: ImageView | null
  sizes: string
  eager: boolean
  /** The editor's field mark for the picture (adr/0065 Faz 2b); none elsewhere. */
  mark?: { "data-qf"?: string }
}) {
  return (
    <picture>
      {phone?.sources.avif && (
        <source media={PHONE} type="image/avif" srcSet={phone.sources.avif} sizes="100vw" />
      )}
      {phone?.sources.webp && (
        <source media={PHONE} type="image/webp" srcSet={phone.sources.webp} sizes="100vw" />
      )}
      {phone && !phone.sources.avif && !phone.sources.webp && (
        <source media={PHONE} srcSet={phone.src} />
      )}
      {image.sources.avif && <source type="image/avif" srcSet={image.sources.avif} sizes={sizes} />}
      {image.sources.webp && <source type="image/webp" srcSet={image.sources.webp} sizes={sizes} />}
      <img
        src={image.src}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding={eager ? "sync" : "async"}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        {...mark}
      />
    </picture>
  )
}
