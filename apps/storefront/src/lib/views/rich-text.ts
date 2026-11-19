import type { StoreRichTextSection } from "@qticaret/types"
import { richTextImageSideOf } from "@qticaret/types/section-rich-text"
import { variantOf } from "@qticaret/types/section-variants"
import type { HomeSectionView } from "@qticaret/ui"
import { layoutImage } from "./layout"

type RichTextView = Extract<HomeSectionView, { type: "rich_text" }>

/**
 * The shop's own text as the theme draws it (adr/0019): the backend's
 * HTML under its title; `with_image` (adr/0073 §3) adds the picture beside
 * it (its alt the backend's: the shop's, else the media library's; none,
 * the title) and its side. A variant this build does not know, or a
 * picture variant without its picture, is the pane, printed as it was
 * before variants.
 */
export function richTextView(section: StoreRichTextSection): RichTextView {
  const pane: RichTextView = {
    id: section.id,
    type: "rich_text",
    title: section.title,
    html: section.html,
  }
  if (variantOf("rich_text", section.variant) !== "with_image" || !section.image) {
    return pane
  }
  return {
    ...pane,
    variant: "with_image",
    image: layoutImage(section.image, section.title ?? ""),
    imageSide: richTextImageSideOf(section.image_side),
  }
}
