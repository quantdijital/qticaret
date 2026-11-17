import { ResponsiveImage } from "@qticaret/ui"
import { blockMark } from "./shared"
import type { BlockProps } from "./shared"

/** The widest a picture shows at each width step (`data-width`), in CSS pixels. */
const CAP = { small: 160, medium: 256 } as const

/**
 * The browser's `sizes` for a column picture: its column's share of the
 * container from 1024 px, half of it from 768 px (two columns side by
 * side), the phone's width below; `small` and `medium` never past their cap.
 */
export function imageSizes(width: "small" | "medium" | "full", share: number): string {
  if (width !== "full") {
    return `${String(CAP[width])}px`
  }
  const wide = Math.max(1, Math.round(share * 100))
  return `(min-width: 1024px) ${String(wide)}vw, (min-width: 768px) 50vw, 100vw`
}

/**
 * A picture from the media library (its alt text required; adr/0070 §2),
 * loaded lazily: every page draws the footer, never above the fold. With a
 * link the picture is the link, its alt text the link's name.
 */
export function ImageBlock({ block, editor, share }: BlockProps<"image"> & { share: number }) {
  const picture = (
    <ResponsiveImage
      image={block.image}
      sizes={imageSizes(block.width, share)}
      className="h-auto w-full rounded-inner object-contain"
    />
  )
  return (
    <div
      className="gf-foot-image"
      data-width={block.width}
      {...blockMark(editor, block.at, "image")}
    >
      {block.link ? (
        <a
          href={block.link.path}
          {...(/^https?:/i.test(block.link.path) ? { rel: "noopener noreferrer" } : {})}
          className="block rounded-inner"
        >
          {picture}
        </a>
      ) : (
        picture
      )}
    </div>
  )
}
