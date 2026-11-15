import "server-only"
import type { StoreStripGalleryItem, StoreStripGallerySection } from "@qticaret/types"
import { stripGallerySettingsOf } from "@qticaret/types/section-strips"
import type {
  ImageView,
  StripGalleryItemView,
  StripGallerySectionView,
  Translate,
} from "@qticaret/ui"
import { layoutImage, layoutLink } from "./layout"
import { type SourceFacts, type SourceMap, sourceKey, stripSources } from "./strip-sources"

/**
 * One strip as the theme draws it: the shop's own picture, words and link
 * over its source's (adr/0049 Ek 2026-11-16). A source with no live page
 * here, or a strip with no picture at all, is left out (null).
 */
export function stripItemView(
  item: StoreStripGalleryItem,
  sources: SourceMap,
  captions: boolean,
  t: Translate
): StripGalleryItemView | null {
  const source: SourceFacts | null =
    item.source.kind === "custom"
      ? null
      : (sources.get(sourceKey(item.source.kind, item.source.target)) ?? null)
  if (item.source.kind !== "custom" && source === null) {
    return null
  }
  const title = captions ? (item.title ?? source?.name ?? null) : null
  const note = captions ? (item.note ?? source?.note ?? null) : null
  const picture: ImageView | null = item.image
    ? layoutImage(item.image, "")
    : (source?.image ?? null)
  if (!picture) {
    return null
  }
  // The heading drawn over it names the link; without one the picture's own words (else the name) do
  const named = item.title ?? source?.name ?? ""
  const alt = title ? (item.image?.alt ?? "") : picture.alt.trim() || named
  return {
    at: item.at,
    image: { ...picture, alt },
    title,
    note,
    href: layoutLink(item.link, t)?.path ?? source?.path ?? null,
  }
}

/**
 * The strip gallery (`strip_gallery`, adr/0049 Ek 2026-11-16): its
 * strips' sources fetched live, each strip resolved; none left, no section.
 */
export async function stripGalleryView(
  section: StoreStripGallerySection,
  t: Translate
): Promise<StripGallerySectionView | null> {
  const settings = stripGallerySettingsOf(section)
  const named = section.items.flatMap((item) =>
    item.source.kind === "custom" ? [] : [item.source]
  )
  const sources = await stripSources(named, t)
  const items = section.items.flatMap(
    (item) => stripItemView(item, sources, settings.captions === "on", t) ?? []
  )
  return items.length > 0
    ? {
        id: section.id,
        type: "strip_gallery",
        title: section.title,
        text: section.text,
        items,
        ...settings,
      }
    : null
}
