import type {
  MediaDerivatives,
  StoreBodyImage,
  StoreContentAuthorDetail,
  StoreContentTerm,
} from "@qticaret/types"

/** A content page or post as `GET /store/content/:id` gives it (F3.16, adr/0019). */
export interface ContentEntry {
  id: string
  kind: "page" | "post"
  title: string
  /** Its address on the shop (`/{handle}`). */
  path?: string
  html: string
  published_at: string | null
  image_url: string | null
  image_alt: string | null
  image_width?: number | null
  image_height?: number | null
  image_derivatives?: MediaDerivatives | null
  /** The text's library pictures with their size and versions. */
  images?: StoreBodyImage[]
  author_name: string | null
  /** The chosen author (adr/0060); null: none, the old written name alone if any. */
  author?: StoreContentAuthorDetail | null
  reading_minutes: number
  /** A post's, at their archives (adr/0019 ek 2026-11-03); a page has none. */
  category?: StoreContentTerm | null
  tags?: StoreContentTerm[]
}
