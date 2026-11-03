import type {
  MigrationSource,
  SourceBrand,
  SourcePage,
  SourcePost,
  SourceReview,
} from "../../types"
import type { WordpressProduct } from "./attributes"
import { pageOf, postOf } from "./content"
import type { Note, WordpressContext } from "./context"
import { note } from "./context"
import type { AttributeUse } from "./products"
import { productOf } from "./products"
import type { WxrItem } from "./reader"
import { readWxr } from "./reader"
import { reviewsOf } from "./reviews"
import type { WordpressSummary } from "./summary"
import { LEFT_OUT, notMovedOf, wordpressSummary } from "./summary"
import type { Bases, WordpressCategory } from "./terms"
import { BRAND_TAXONOMIES, Taxonomies, brandsOf, categoriesOf } from "./terms"
import { detectBase, linkedPaths, normalBase, oldPathOf } from "./urls"

export type { ProductAttribute, WordpressProduct } from "./attributes"
export { MAX_WXR_BYTES, looksLikeWxr, wxrText } from "./file"
export type { NotMoved, WordpressSummary } from "./summary"
export type { WordpressCategory } from "./terms"

/**
 * A WordPress + WooCommerce site's export (WXR) as a migration source
 * (F14, adr/0042 Ek 2026-11-03): product categories with their SEO fields,
 * brands, products with their variations, pictures and descriptive
 * attributes, reviews, blog posts with their categories and tags, content
 * pages, and every old address for its 301. Menus and coupons and product
 * tags do not move: they are named in the report. A descriptive attribute
 * moves where the shop's attribute template has a field for it, else the
 * run names it with its values (workflows/migration/attributes.ts). The
 * file is read once and whole, then given out kind by kind; its customers
 * and orders are not in an export.
 */

export interface WordpressOptions {
  /** The product categories' address base (`/urun-kategori/`); left out, read from the site's own links. */
  categoryBase?: string | null | undefined
}

export interface WordpressRecords {
  id: string
  bases: Bases
  categories: WordpressCategory[]
  brands: SourceBrand[]
  products: WordpressProduct[]
  reviews: SourceReview[]
  posts: SourcePost[]
  pages: SourcePage[]
  /** Descriptive attributes by their key, for the attribute template the shop sets up. */
  attributes: ReadonlyMap<string, AttributeUse>
  /** The job summary's block: attributes by slug, what does not move. */
  summary: WordpressSummary
  notes: Note[]
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "")

function groupVariations(items: readonly WxrItem[]): Map<string, WxrItem[]> {
  const byParent = new Map<string, WxrItem[]>()
  for (const item of items.filter((each) => each.type === "product_variation")) {
    byParent.set(item.parent, [...(byParent.get(item.parent) ?? []), item])
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id))
  }
  return byParent
}

/**
 * The archives' bases: as given, else as the site's own links show them,
 * else WordPress's defaults. A slug two kinds share (a blog category named
 * as a product category) and a link to a post or page tell nothing.
 */
function basesOf(
  taxonomies: Taxonomies,
  items: readonly WxrItem[],
  options: WordpressOptions
): Bases {
  const { wxr } = taxonomies
  const permalinks = new Set(
    items.map((item) => (oldPathOf(item.link, wxr.site) ?? "").replace(/\/+$/, "").toLowerCase())
  )
  const linked = linkedPaths(
    [...items.map((item) => item.content), ...wxr.terms.map((term) => term.description)],
    wxr.site
  ).filter((path) => !permalinks.has(path))
  const paths = (names: readonly string[]) =>
    names.flatMap((taxonomy) =>
      taxonomies.of(taxonomy).map((term) => taxonomies.slugPath(taxonomy, term.slug).join("/"))
    )
  const kinds = {
    category: paths(["product_cat"]),
    brand: paths(BRAND_TAXONOMIES),
    postCategory: paths(["category"]),
    postTag: paths(["post_tag"]),
  }
  const lastOf = (path: string) => path.split("/").pop() ?? path
  const owners = new Map<string, number>()
  for (const list of Object.values(kinds)) {
    for (const slug of new Set(list.map(lastOf))) {
      owners.set(slug, (owners.get(slug) ?? 0) + 1)
    }
  }
  const telling = (list: string[]) => list.filter((path) => owners.get(lastOf(path)) === 1)
  return {
    category: options.categoryBase
      ? normalBase(options.categoryBase)
      : detectBase(linked, telling(kinds.category), "/product-category/"),
    brand: detectBase(linked, telling(kinds.brand), "/brand/"),
    postCategory: detectBase(linked, telling(kinds.postCategory), "/category/"),
    postTag: detectBase(linked, telling(kinds.postTag), "/tag/"),
  }
}

/** Records a second time under a handle another took first are left out, named. */
function unique<T>(
  context: WordpressContext,
  records: T[],
  handleOf: (record: T) => string,
  kind: Note["kind"],
  keyOf: (record: T) => string
): T[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const handle = handleOf(record)
    if (seen.has(handle)) {
      note(context, kind, keyOf(record), "migration.wordpress_handle_duplicate")
      return false
    }
    seen.add(handle)
    return true
  })
}

/** The export's records, every kind, and the notes of what was left out. */
export function wordpressRecords(text: string, options: WordpressOptions = {}): WordpressRecords {
  const wxr = readWxr(text)
  const taxonomies = new Taxonomies(wxr)
  const context: WordpressContext = {
    wxr,
    taxonomies,
    attachments: new Map(
      wxr.items.filter((item) => item.type === "attachment").map((item) => [item.id, item])
    ),
    variations: groupVariations(wxr.items),
    siteHost: wxr.site?.hostname ?? null,
    notes: [],
  }
  const bases = basesOf(taxonomies, wxr.items, options)
  const of = (type: string) => wxr.items.filter((item) => item.type === type)
  const kept = (type: string, kind: Note["kind"]) =>
    of(type).filter((item) => {
      if (item.status === "trash") {
        note(context, kind, `${type}:${item.id}`, "migration.wordpress_trashed")
      }
      return !LEFT_OUT.has(item.status)
    })
  const productIds = new Set(of("product").map((item) => item.id))
  for (const variation of of("product_variation").filter((item) => !productIds.has(item.parent))) {
    note(context, "product", `variation:${variation.id}`, "migration.wordpress_variation_orphan")
  }
  const uses = new Map<string, AttributeUse>()
  const productItems = kept("product", "product")
  const products = unique(
    context,
    productItems.flatMap((item) => productOf(context, item, uses) ?? []),
    (product) => product.handle,
    "product",
    (product) => product.source_key
  )
  const posts = unique(
    context,
    kept("post", "post").flatMap((item) => postOf(context, item, bases) ?? []),
    (post) => post.content.handle,
    "post",
    (post) => post.source_key
  )
  const pages = unique(
    context,
    kept("page", "page").flatMap((item) => pageOf(context, item) ?? []),
    (page) => page.content?.handle ?? page.source_key,
    "page",
    (page) => page.source_key
  )
  const notMoved = notMovedOf(context)
  const used = new Set(
    productItems.flatMap((item) =>
      item.terms.filter((term) => term.domain === "product_cat").map((term) => term.slug)
    )
  )
  return {
    id: wxr.site ? `wordpress:${bareHost(wxr.site.hostname)}` : "wordpress",
    bases,
    categories: categoriesOf(taxonomies, bases.category, used),
    brands: brandsOf(taxonomies, bases.brand),
    products,
    reviews: productItems.flatMap((item) => reviewsOf(context, item)),
    posts,
    pages,
    attributes: uses,
    summary: wordpressSummary(products, notMoved),
    notes: context.notes,
  }
}

// A list already in memory, as a source that reads page by page gives one
const listOf =
  <T>(items: readonly T[]) =>
  (): AsyncIterable<T> => ({
    [Symbol.asyncIterator]: () => {
      const each = items.values()
      return { next: () => Promise.resolve(each.next()) }
    },
  })

/** The export as a migration source: its id is the old site's host, so a run again finds what it made. */
export function wordpressSource(text: string, options: WordpressOptions = {}): MigrationSource {
  return recordsSource(wordpressRecords(text, options))
}

/** Records already read as a migration source. */
export function recordsSource(records: WordpressRecords): MigrationSource {
  return {
    id: records.id,
    categories: listOf(records.categories),
    brands: listOf(records.brands),
    products: listOf(records.products),
    customers: listOf([]),
    orders: listOf([]),
    reviews: listOf(records.reviews),
    pages: listOf(records.pages),
    posts: listOf(records.posts),
    notes: () => records.notes,
  }
}
