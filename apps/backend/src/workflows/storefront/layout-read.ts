import type { MedusaContainer } from "@medusajs/framework/types"
import { renderDoc } from "../../lib/content"
import type { LayoutDocument, PageSection } from "../../lib/storefront/layout"
import { isShowing, layoutDocument } from "../../lib/storefront/layout"
import type { MenuLinkInput, RecordLinkKind } from "../../lib/storefront/menus"
import { fillShopDoc, fillShopText } from "../../lib/shop/tokens"
import type { ShopInfoValues } from "../../lib/shop/tokens"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { cardTargets } from "../../api/store/content/cards"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { shopInfoValues } from "../shop/info-values"
import { layoutRow } from "./layout"
import { defaultLayout } from "./layout-default"
import { linksOf } from "./layout-check"
import { resolveLinks } from "./menu-links"
import type { StoredLink } from "./menu-links"

/** A button or slide link as the storefront prints it; a broken one is not there. */
export interface StoreLayoutLink {
  /** The shop's wording, else the record's name; null: the storefront's own name. */
  label: string | null
  kind: MenuLinkInput["kind"]
  target: string | null
  /** The record's live path or the address; null: a storefront page or a legal text. */
  path: string | null
}

/** An image with what the media library knows of it: its size and versions. */
export interface StoreLayoutImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: unknown
}

type Hydrated = Record<string, unknown> & { id: string; type: string }

interface Context {
  values: ShopInfoValues
  links: Map<MenuLinkInput, StoreLayoutLink | null>
  images: Map<string, StoreLayoutImage>
  container: MedusaContainer
}

const fill = (text: string | null, values: ShopInfoValues) =>
  text === null ? null : fillShopText(text, values)

async function hydrateSection(section: PageSection, at: Context): Promise<Hydrated> {
  const { id, type } = section
  const image = (url: string, alt: string | null): StoreLayoutImage =>
    at.images.get(url) ?? { url, alt, width: null, height: null, derivatives: null }
  const link = (each: MenuLinkInput | null) => (each ? (at.links.get(each) ?? null) : null)
  switch (section.type) {
    case "hero":
      return {
        id,
        type,
        eyebrow: fill(section.eyebrow, at.values),
        heading: fill(section.heading, at.values),
        text: fill(section.text, at.values),
        links: section.links.flatMap((each) => {
          const shown = link(each)
          return shown ? [shown] : []
        }),
        image: section.image
          ? { ...image(section.image.url, section.image.alt), alt: section.image.alt }
          : null,
      }
    case "banner":
      return {
        id,
        type,
        slides: section.slides.map((slide) => ({
          image: { ...image(slide.image.url, slide.image.alt), alt: slide.image.alt },
          heading: fill(slide.heading, at.values),
          text: fill(slide.text, at.values),
          link: link(slide.link),
        })),
      }
    case "products":
      return {
        id,
        type,
        title: section.title,
        source: section.source,
        limit: section.limit,
        more: link(section.more),
      }
    case "rich_text": {
      const body = fillShopDoc(section.body, at.values)
      return {
        id,
        type,
        title: section.title,
        html: renderDoc(body, await cardTargets(at.container, body)),
      }
    }
    case "newsletter":
    case "help":
      return { id, type, title: section.title, text: fill(section.text, at.values) }
    case "categories":
      return { id, type, title: section.title, category_ids: section.category_ids }
    case "brands":
      return { id, type, title: section.title, brand_ids: section.brand_ids }
    case "posts":
    case "reviews":
      return { id, type, title: section.title, limit: section.limit }
    case "trust_badges":
      return { id, type }
  }
}

/**
 * The sections with only the records live now (security review 2026-11-02,
 * L8): a draft product's or an inactive category's id never leaves the
 * backend. A section whose every chosen record is gone, or whose rail's
 * category or collection is, is left out (an emptied choice would read as
 * "the top categories" or "every brand").
 */
async function liveSections(
  container: MedusaContainer,
  sections: PageSection[]
): Promise<PageSection[]> {
  const wanted = new Map<string, StoredLink>()
  const want = (kind: RecordLinkKind, target: string) =>
    wanted.set(`${kind}:${target}`, {
      id: `${kind}:${target}`,
      parent_id: null,
      rank: 0,
      label: null,
      kind,
      target,
      url: null,
    })
  for (const section of sections) {
    if (section.type === "categories") {
      section.category_ids.forEach((id) => want("category", id))
    } else if (section.type === "brands") {
      section.brand_ids.forEach((id) => want("brand", id))
    } else if (section.type === "products") {
      const { source } = section
      if (source.kind === "category") want("category", source.category_id)
      if (source.kind === "collection") want("collection", source.collection_id)
      if (source.kind === "manual") source.product_ids.forEach((id) => want("product", id))
    }
  }
  if (wanted.size === 0) {
    return sections
  }
  const resolved = await resolveLinks(container, [...wanted.values()])
  const live = (kind: RecordLinkKind) => (id: string) =>
    resolved.get(`${kind}:${id}`)?.broken === false
  return sections.flatMap((section): PageSection[] => {
    if (section.type === "categories" && section.category_ids.length > 0) {
      const ids = section.category_ids.filter(live("category"))
      return ids.length > 0 ? [{ ...section, category_ids: ids }] : []
    }
    if (section.type === "brands" && section.brand_ids.length > 0) {
      const ids = section.brand_ids.filter(live("brand"))
      return ids.length > 0 ? [{ ...section, brand_ids: ids }] : []
    }
    if (section.type === "products") {
      const { source } = section
      if (source.kind === "category") {
        return live("category")(source.category_id) ? [section] : []
      }
      if (source.kind === "collection") {
        return live("collection")(source.collection_id) ? [section] : []
      }
      if (source.kind === "manual") {
        const ids = source.product_ids.filter(live("product"))
        return ids.length > 0 ? [{ ...section, source: { ...source, product_ids: ids } }] : []
      }
    }
    return [section]
  })
}

/**
 * The design as the storefront shows it at a moment (adr/0049): only the
 * sections showing then, the shop's details in place, links named and
 * placed as their records are now (a broken one left out), images with
 * their sizes, rich text as the backend's HTML. Products, categories,
 * brands, posts and reviews are the storefront's to fetch (prices and
 * stock on every request).
 */
export async function storeLayout(
  container: MedusaContainer,
  doc: LayoutDocument,
  now = new Date()
) {
  const header = doc.header.filter((section) => isShowing(section, now))
  const home = await liveSections(
    container,
    doc.home.filter((section) => isShowing(section, now))
  )
  const footer = doc.footer.filter((section) => isShowing(section, now))
  const links = home.flatMap(linksOf)
  const urls = home.flatMap((section) =>
    section.type === "hero" && section.image
      ? [section.image.url]
      : section.type === "banner"
        ? section.slides.map((slide) => slide.image.url)
        : []
  )
  const [values, resolved, assets] = await Promise.all([
    shopInfoValues(container),
    resolveLinks(
      container,
      links.map((each, index) => ({
        id: String(index),
        parent_id: null,
        rank: index,
        label: each.label,
        kind: each.kind,
        target: "target" in each ? each.target : null,
        url: "url" in each ? each.url : null,
      }))
    ),
    urls.length
      ? container
          .resolve<MediaModuleService>(MEDIA_MODULE)
          .listMediaAssets(
            { url: [...new Set(urls)] },
            { select: ["url", "alt", "width", "height", "derivatives"] }
          )
      : Promise.resolve([]),
  ])
  const at: Context = {
    values,
    container,
    images: new Map(
      assets.map((asset) => [
        asset.url,
        {
          url: asset.url,
          alt: asset.alt ?? null,
          width: asset.width ?? null,
          height: asset.height ?? null,
          derivatives: asset.derivatives ?? null,
        },
      ])
    ),
    links: new Map(
      links.map((each, index) => {
        const shown = resolved.get(String(index))
        return [
          each,
          !shown || shown.broken
            ? null
            : {
                label: each.label ?? shown.name,
                kind: each.kind,
                target: "target" in each ? each.target : null,
                path: shown.path,
              },
        ]
      })
    ),
  }
  return {
    header: header.map((section) => ({
      id: section.id,
      type: section.type,
      lines: section.lines.map((line) => fillShopText(line, values)),
    })),
    home: await Promise.all(home.map((section) => hydrateSection(section, at))),
    footer: footer.map((section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      text: fill(section.text, values),
    })),
  }
}

type Shown = Awaited<ReturnType<typeof storeLayout>>

// The live design, hydrated once a minute per process at most (security review
// 2026-11-02, L2): the public endpoint's cost is not the visitor's to choose
const shownCache = createTtlCache<Shown>({ ttlMs: 60_000, maxEntries: 4 })

/** The published design (else the default) as shown now; a new publication is seen at once. */
export async function publishedLayout(container: MedusaContainer): Promise<Shown> {
  const row = await layoutRow(container)
  const key = row?.published ? `revision:${String(row.revision)}` : "default"
  return shownCache(key, async () => {
    const doc = row?.published
      ? layoutDocument.parse(row.published)
      : await defaultLayout(container)
    return storeLayout(container, doc)
  })
}
