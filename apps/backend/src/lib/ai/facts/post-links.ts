import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { LINK_CHOICES_FIELD } from "../post-draft"
import type { PostDraftAllowed, PostLinkChoice, PostLinkKind } from "../post-draft"
import { POST_LINK_CATEGORIES, POST_LINK_CHOICES } from "../registry/content-tasks"
import { ranked, topicOf } from "./post-topic"
import type { PostTopic } from "./post-topic"
import { allShownCategories } from "./product-card"
import { storefrontChannelIds } from "./storefront-channels"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * The internal link candidates of a post draft (adr/0074 §5 madde 5): the
 * shop's shown categories (none internal or closed, nor under such a
 * parent) and its published products in the storefront's sales channels,
 * each only with a storefront path of its own (the URL registry's active
 * one). Those nearest the post's subject come first (`post-topic`: focus
 * keyword, then title, then summary), ranked before the cut; at most
 * `POST_LINK_CHOICES`, `POST_LINK_CATEGORIES` of them categories. Only a
 * short code and the name are sent (`k1` a category, `u1` a product); the
 * ids and paths stay on the server (`allowed`). Names only: no price,
 * stock or sales figure is read.
 */

/** Published products read to choose from, the newest first. */
export const POST_LINK_PRODUCT_SAMPLE = 200

/** One candidate's longest text in the data block ("Kategori: Üst > Alt"). */
export const LINK_CHOICE_LENGTH = 140

// The URL registry's locale: one language until F19 (`CATALOG_LOCALE`, workflows/catalog/entity-paths)
const LOCALE = "tr"

// The registry's entity types (`CATALOG_ENTITY_TYPES`): not imported, its module reads the settings
const REGISTRY_TYPES: Readonly<Record<PostLinkKind, string>> = {
  category: "product_category",
  product: "product",
}

const LABELS: Readonly<Record<PostLinkKind, string>> = {
  category: "Kategori",
  product: "Ürün",
}

export interface PostLinkFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
  maxItems: Readonly<Record<string, number>>
  allowed: PostDraftAllowed
}

interface Candidate {
  kind: PostLinkKind
  id: string
  name: string
}

/** The published products in one of the storefront's channels, newest first. */
async function shownProducts(container: FactsContainer): Promise<Candidate[]> {
  const rows = await container
    .resolve(Modules.PRODUCT)
    .listProducts(
      { status: "published" },
      { select: ["id", "title"], take: POST_LINK_PRODUCT_SAMPLE, order: { created_at: "DESC" } }
    )
  if (rows.length === 0) {
    return []
  }
  // The safe side: no storefront channel found, no product named
  const channels = await storefrontChannelIds(container)
  if (channels.size === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "sales_channels.id"],
    filters: { id: rows.map((row) => row.id) },
  })
  const shown = new Set(
    (data as { id: string; sales_channels?: ({ id?: string | null } | null)[] | null }[])
      .filter((row) =>
        (row.sales_channels ?? []).some(
          (channel) => typeof channel?.id === "string" && channels.has(channel.id)
        )
      )
      .map((row) => row.id)
  )
  return rows
    .filter((row) => shown.has(row.id) && row.title.trim() !== "")
    .map((row) => ({ kind: "product" as const, id: row.id, name: row.title.trim() }))
}

/** Each record's active storefront path, by id; one without a path has no page to link. */
async function pathsOf(
  container: FactsContainer,
  kind: PostLinkKind,
  ids: readonly string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map()
  }
  const entries = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      { locale: LOCALE, entity_type: REGISTRY_TYPES[kind], entity_id: [...ids], status: "active" },
      { select: ["entity_id", "path"] }
    )
  return new Map(entries.map((entry) => [entry.entity_id, entry.path]))
}

/** The list a post draft names, and the same list as `allowed`. */
export async function postLinkFacts(
  container: FactsContainer,
  topic: PostTopic
): Promise<PostLinkFacts> {
  const post = topicOf(topic)
  // Every shown category, ranked before the cut (a card's alphabetical first 150 would miss some)
  const [categoryRows, products] = await Promise.all([
    allShownCategories(container),
    shownProducts(container),
  ])
  const categories: Candidate[] = categoryRows.map((row) => ({
    kind: "category",
    id: row.id,
    name: row.name,
  }))
  const [categoryPaths, productPaths] = await Promise.all([
    pathsOf(
      container,
      "category",
      categories.map((each) => each.id)
    ),
    pathsOf(
      container,
      "product",
      products.map((each) => each.id)
    ),
  ])
  const withPath = (each: Candidate, paths: ReadonlyMap<string, string>) =>
    paths.has(each.id) ? [{ ...each, path: paths.get(each.id) ?? "" }] : []
  const pickedCategories = ranked(
    categories.flatMap((each) => withPath(each, categoryPaths)),
    post
  ).slice(0, POST_LINK_CATEGORIES)
  const pickedProducts = ranked(
    products.flatMap((each) => withPath(each, productPaths)),
    post
  ).slice(0, POST_LINK_CHOICES - pickedCategories.length)
  const choices: PostLinkChoice[] = [
    ...pickedCategories.map((each, index) => ({ ...each, code: `k${String(index + 1)}` })),
    ...pickedProducts.map((each, index) => ({ ...each, code: `u${String(index + 1)}` })),
  ]
  return {
    fields: {
      [LINK_CHOICES_FIELD]: choices.map((each) => ({
        label: each.code,
        value: `${LABELS[each.kind]}: ${each.name}`,
      })),
    },
    maxLengths: { [LINK_CHOICES_FIELD]: LINK_CHOICE_LENGTH },
    maxItems: { [LINK_CHOICES_FIELD]: POST_LINK_CHOICES },
    allowed: { kind: "post_draft", choices },
  }
}
