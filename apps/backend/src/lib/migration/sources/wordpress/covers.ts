import { uploadStem } from "../../../seo/legacy/files"
import type { WordpressContext } from "./context"
import { note } from "./context"
import type { WxrItem, WxrTerm } from "./reader"

/**
 * A product category's own picture (adr/0042 Ek 2026-11-06): WooCommerce
 * keeps it as the term's `thumbnail_id` meta, the id of an attachment of
 * the media library, whose file is its `wp:attachment_url`. Any
 * WooCommerce shop's export carries it the same way. A picture the export
 * names but its media library lacks is a note, never a stop.
 */

/** A category's picture: its file on the old site and its alt text. */
export interface CategoryCover {
  url: string
  alt: string
}

/** The attachment id a term names as its picture; none for none, `0` or a value that is no id. */
export function thumbnailIdOf(meta: ReadonlyMap<string, string>): string | null {
  const id = (meta.get("thumbnail_id") ?? "").trim()
  return /^\d+$/.test(id) && !/^0+$/.test(id) ? id : null
}

const oneLine = (text: string) =>
  text
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

// Letters and digits only, marks dropped (`Şef` ~ `sef`), to compare a title with a file's name
const bare = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/ı/g, "i")

/**
 * The file's name without its extension and WordPress's size suffixes
 * (`IMG_2026-scaled.jpg` → `img_2026`): the name an upload is titled with.
 */
function fileStem(url: string): string {
  const last = url.split(/[?#]/)[0]?.split("/").pop() ?? ""
  let name = last
  try {
    name = decodeURIComponent(last)
  } catch {
    // A broken escape: compared as written
  }
  return uploadStem(name.toLowerCase())
}

/**
 * Whether a title is only a file's name: the upload's own (WordPress titles
 * an upload so; `-1` it adds to a name taken aside), or one word of
 * hyphens and underscores (`my-larte-el-yapımı-çakı`), which no one writes
 * as a description.
 */
function namesTheFile(title: string, url: string): boolean {
  const stem = fileStem(url)
  return (
    [stem, stem.replace(/-\d+$/, "")].some((name) => bare(name) === bare(title)) ||
    (!/\s/.test(title) && /[-_]/.test(title))
  )
}

/**
 * The picture's alt text: the media library's alt, else the attachment's
 * title unless it only names the file, else the category's name.
 */
export function coverAlt(attachment: WxrItem, categoryName: string): string {
  const alt = oneLine(attachment.meta.get("_wp_attachment_image_alt") ?? "")
  if (alt !== "") {
    return alt
  }
  const title = oneLine(attachment.title)
  if (title !== "" && !namesTheFile(title, attachment.attachmentUrl)) {
    return title
  }
  return oneLine(categoryName)
}

/** What a category's `thumbnail_id` came to: its picture, or the id the media library lacks. */
export type CoverOf = { image: CategoryCover } | { image_missing: string } | null

/**
 * A category term's picture, resolved through the media library; a
 * missing attachment, or one whose file is no web address, noted for the
 * report under the category's key and the id it named.
 */
export function categoryCoverOf(
  context: WordpressContext,
  term: WxrTerm,
  sourceKey: string
): CoverOf {
  const id = thumbnailIdOf(term.meta)
  if (!id) {
    return null
  }
  const attachment = context.attachments.get(id)
  if (!attachment || !/^https?:\/\//i.test(attachment.attachmentUrl)) {
    note(context, "category", `${sourceKey} #${id}`, "migration.wordpress_category_image_missing")
    return { image_missing: id }
  }
  return { image: { url: attachment.attachmentUrl, alt: coverAlt(attachment, term.name) } }
}
