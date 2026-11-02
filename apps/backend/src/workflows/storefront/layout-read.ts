import type { MedusaContainer } from "@medusajs/framework/types"
import { renderDoc } from "../../lib/content"
import type { LayoutDocument, PageSection } from "../../lib/storefront/layout"
import { isShowing } from "../../lib/storefront/layout"
import type { MenuLinkInput } from "../../lib/storefront/menus"
import { fillShopDoc, fillShopText } from "../../lib/shop/tokens"
import type { ShopInfoValues } from "../../lib/shop/tokens"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { cardTargets } from "../../api/store/content/cards"
import { shopInfoValues } from "../shop/info-values"
import { linksOf } from "./layout-check"
import { resolveLinks } from "./menu-links"

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
  const home = doc.home.filter((section) => isShowing(section, now))
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
