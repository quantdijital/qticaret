import type { MedusaContainer } from "@medusajs/framework/types"
import type { BodySection, LayoutDocument } from "../../lib/storefront/layout"
import { isShowing, layoutDocument } from "../../lib/storefront/layout"
import { fillShopText } from "../../lib/shop/tokens"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { shopInfoValues } from "../shop/info-values"
import { layoutRow } from "./layout"
import { defaultLayout } from "./layout-default"
import { linksOf } from "./layout-check"
import { fill, hydrateSection } from "./layout-hydrate"
import type { HydrateContext } from "./layout-hydrate"
import { liveRecords } from "./layout-live"
import { resolveLinks } from "./menu-links"
import { railPicks } from "./rails"

/** The addresses of the images shown with their sizes: openings and slides. */
const imageUrls = (section: BodySection): string[] =>
  section.type === "hero" && section.image
    ? [section.image.url]
    : section.type === "banner"
      ? section.slides.map((slide) => slide.image.url)
      : []

/**
 * The design as the storefront shows it at a moment (adr/0049): only the
 * sections showing then, the shop's details in place, links named and
 * placed as their records are now (a broken one left out), images with
 * their sizes, rich text as the backend's HTML. The home, product and
 * category pages' sections alike; a category page's keep their place.
 * Products, categories, brands, posts and reviews are the storefront's to
 * fetch (prices and stock on every request); a sale or best-seller rail's
 * products are picked here, for the shopper's sales channels (`channels`,
 * the publishable key's; null: any), and named by id.
 */
export async function storeLayout(
  container: MedusaContainer,
  doc: LayoutDocument,
  channels: readonly string[] | null = null,
  now = new Date()
) {
  const showing = <T extends Parameters<typeof isShowing>[0]>(group: readonly T[]) =>
    group.filter((section) => isShowing(section, now))
  const header = showing(doc.header)
  const footer = showing(doc.footer)
  const pages = {
    home: showing(doc.home),
    product: showing(doc.product),
    category: showing(doc.category),
  }
  const keepLive = await liveRecords(container, [
    ...pages.home,
    ...pages.product,
    ...pages.category,
  ])
  const home = keepLive(pages.home)
  const product = keepLive(pages.product)
  const category = keepLive(pages.category)
  const body: BodySection[] = [...home, ...product, ...category]
  const links = body.flatMap(linksOf)
  const urls = body.flatMap(imageUrls)
  const [values, resolved, assets, picks] = await Promise.all([
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
    railPicks(container, home, channels),
  ])
  const at: HydrateContext = {
    values,
    container,
    picks,
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
    product: await Promise.all(product.map((section) => hydrateSection(section, at))),
    category: await Promise.all(
      category.map(async (section) => ({
        ...(await hydrateSection(section, at)),
        placement: section.placement,
      }))
    ),
  }
}

type Shown = Awaited<ReturnType<typeof storeLayout>>

// The live design, hydrated once a minute per process at most (security review
// 2026-11-02, L2): the public endpoint's cost is not the visitor's to choose. One
// per publishable key's sales channels (the shop's keys, not the visitor's words)
const shownCache = createTtlCache<Shown>({ ttlMs: 60_000, maxEntries: 8 })

/**
 * The published design (else the default) as shown now in these sales
 * channels (the rails' picks are theirs); a new publication is seen at once.
 */
export async function publishedLayout(
  container: MedusaContainer,
  channels: readonly string[] | null = null
): Promise<Shown> {
  const row = await layoutRow(container)
  const doc = row?.published ? `revision:${String(row.revision)}` : "default"
  const key = `${doc}|${channels ? [...new Set(channels)].sort().join(",") : "*"}`
  return shownCache(key, async () => {
    const shown = row?.published
      ? layoutDocument.parse(row.published)
      : await defaultLayout(container)
    return storeLayout(container, shown, channels)
  })
}
