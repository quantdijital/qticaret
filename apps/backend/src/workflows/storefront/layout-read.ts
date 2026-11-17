import type { MedusaContainer } from "@medusajs/framework/types"
import type { BodySection, LayoutDocument } from "../../lib/storefront/layout"
import { isBody, isShowing, readStoredLayout } from "../../lib/storefront/layout"
import { mainSectionsOf, withMainSections } from "../../lib/storefront/layout-main"
import { fillShopDoc, fillShopText, fillShopTextWhole } from "../../lib/shop/tokens"
import type { MenuLinkInput } from "../../lib/storefront/menus"
import { freeBlocksOf } from "../../lib/storefront/sections/footer-rules"
import { footerRowImages, footerRowLinks } from "../../lib/storefront/sections/footer-rows-print"
import type { ShopInfoValues } from "../../lib/shop/tokens"
import { shownSettings } from "../../lib/storefront/layout-settings"
import { newsletterImages, printedNewsletter } from "../../lib/storefront/sections/newsletter"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { shopInfoValues } from "../shop/info-values"
import { layoutRow } from "./layout"
import { legacySettings } from "./layout-shared"
import { defaultLayout } from "./layout-default"
import { headerLinked, imagesOf, linksOf } from "./layout-check"
import { fill, hydrateMarquee, hydrateSection } from "./layout-hydrate"
import type { HydrateContext } from "./layout-hydrate"
import { liveRecords } from "./layout-live"
import { resolveLinks } from "./menu-links"
import type { StoreMenu } from "./menus-read"
import { bandPicks } from "./price-bands"
import { railPicks } from "./rails"

/** The addresses of the images shown with their sizes: openings, slides, strips (not rich text's). */
const imageUrls = (section: BodySection): string[] =>
  section.type === "rich_text" ? [] : imagesOf(section)

/**
 * The design as the storefront shows it at a moment (adr/0049): only the
 * sections showing then, the shop's details in place, links named and
 * placed as their records are now (a broken one left out), images with
 * their sizes, rich text as the backend's HTML. The home, product and
 * category pages' sections alike; a category page's keep their place.
 * Products, categories, brands, posts and reviews are the storefront's to
 * fetch (prices and stock on every request); a sale or best-seller rail's
 * products are picked here, for the shopper's sales channels (`channels`,
 * the publishable key's; null: any), and named by id. The theme's shared
 * settings come applied (adr/0049 Ek 2026-11-06): the badges' and the colour
 * names' as written here, else as the old storefront fields hold them; the
 * theme's settings as written here, else as the theme section holds them
 * (adr/0063 §3). The menu set is the preview's to show (`draftMenus`):
 * the live menus are the module's, so it is null here.
 */
export async function storeLayout(
  container: MedusaContainer,
  stored: LayoutDocument,
  channels: readonly string[] | null = null,
  now = new Date()
) {
  const legacy = await legacySettings(container)
  // A design from before the main sections reads them in, the header's from the theme's
  const doc = withMainSections(stored, shownSettings(stored.settings, legacy).theme.header)
  const showing = <T extends Parameters<typeof isShowing>[0]>(group: readonly T[]) =>
    group.filter((section) => isShowing(section, now))
  const header = showing(doc.header).filter(
    (section): section is Exclude<typeof section, { type: "header_bar" }> =>
      section.type !== "header_bar"
  )
  const footer = showing(doc.footer).filter(
    (section): section is Exclude<typeof section, { type: "footer_bar" }> =>
      section.type !== "footer_bar"
  )
  const pages = {
    home: showing(doc.home),
    product: showing(doc.product).filter(isBody),
    category: showing(doc.category).filter(isBody),
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
  // The header's scrolling strip links like a body section (adr/0049 Ek 2026-11-14 §4.1),
  // the catalog header bar's highlighted link too (it always shows)
  const bar = doc.header.filter((section) => section.type === "header_bar")
  // A free rows footer's shown blocks (adr/0070 §2.2): their pictures and those pictures' links
  const blocks = freeBlocksOf(doc.footer).filter((block) => block.visible)
  const links = [
    ...[...body, ...headerLinked({ header: [...header, ...bar] })].flatMap(linksOf),
    ...footerRowLinks(blocks),
  ]
  const urls = [
    ...body.flatMap(imageUrls),
    ...footer.flatMap(newsletterImages),
    ...footerRowImages(blocks),
  ]
  const [values, resolved, assets, picks, bands] = await Promise.all([
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
    bandPicks(container, home, channels),
  ])
  const at: HydrateContext = {
    values,
    container,
    picks,
    bands,
    live: keepLive.live,
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
  const resolve = (link: MenuLinkInput) => at.links.get(link) ?? null
  return {
    header: header.map((section) =>
      section.type === "marquee"
        ? hydrateMarquee(section, at)
        : {
            id: section.id,
            type: section.type,
            lines: section.lines.map((line) => fillShopText(line, values)),
            // How it shows more than one line (docs/tema/bilesen-denetimi (b) 6), as saved
            mode: section.mode,
            interval: section.interval,
            pause_button: section.pause_button,
            hover_pause: section.hover_pause,
            // Where its lines sit and how big it is (adr/0049 Ek 2026-11-15)
            align: section.align,
            size: section.size,
          }
    ),
    home: await Promise.all(home.map((section) => hydrateSection(section, at))),
    // The footer's box as a page's (adr/0049 Ek 2026-11-17 e-bülten): each new field off its default
    footer: footer.map((section) =>
      printedNewsletter(
        section,
        (text) => fill(text, values),
        (url, alt) =>
          at.images.get(url) ?? { url, alt, width: null, height: null, derivatives: null }
      )
    ),
    product: await Promise.all(product.map((section) => hydrateSection(section, at))),
    category: await Promise.all(
      category.map(async (section) => ({
        ...(await hydrateSection(section, at)),
        placement: section.placement,
      }))
    ),
    main: withShopNote(
      mainSectionsOf(doc, resolve, {
        fill: (text) => fill(text, values),
        doc: (body) => fillShopDoc(body, values),
        // A picture gone from the library since the save: its block is not drawn
        picture: (url) => at.images.get(url) ?? null,
        resolve,
      }),
      values
    ),
    settings: sharedOf(doc, legacy, values),
  }
}

/**
 * The catalog header's strip note with the shop's details in place (adr/0048);
 * a note naming a detail the shop has not given (no free-shipping threshold)
 * is not shown, never as half a sentence.
 */
export function withShopNote<M extends ReturnType<typeof mainSectionsOf>>(
  main: M,
  values: ShopInfoValues
): M {
  const bar = main.header_bar
  if (!("catalog" in bar)) {
    return main
  }
  const note = bar.catalog.strip_note
  const catalog = {
    ...bar.catalog,
    strip_note: note === null ? null : fillShopTextWhole(note, values),
  }
  return { ...main, header_bar: { ...bar, catalog } }
}

/** The shared settings as the storefront draws them: the badges' details in place, the theme applied. */
function sharedOf(
  doc: LayoutDocument,
  legacy: Awaited<ReturnType<typeof legacySettings>>,
  values: Awaited<ReturnType<typeof shopInfoValues>>
) {
  const shown = shownSettings(doc.settings, legacy)
  return {
    trust_badges: shown.trust_badges.map((badge) => ({
      icon: badge.icon,
      title: fillShopText(badge.title, values),
      text: fill(badge.text, values),
    })),
    color_swatches: shown.color_swatches,
    theme: shown.theme,
    menus: null as StoreMenu[] | null,
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
    const shown = row?.published ? readStoredLayout(row.published) : await defaultLayout(container)
    return storeLayout(container, shown, channels)
  })
}
