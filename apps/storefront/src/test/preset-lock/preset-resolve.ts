import { BRANDS, CATEGORIES, CATEGORY_PATHS, PRODUCTS, RECORD_PATHS } from "./fixture-shop"

/**
 * A preset's references resolved for the fixed shop, as the backend's
 * `resolvePreset` (apps/backend/src/lib/storefront/presets/resolve.ts) does
 * for a real one, and the links placed as `GET /store/storefront-layout`
 * prints them: `{ "$handle": "category:x" }` the record's id, `{ "$href":
 * "/x" }` a link with its path, `{ "$image": "images/x.webp" }` a picture.
 * What the shop lacks goes as there: a list's item taken out, a section's
 * one record or a filled list emptied drops the section, a single link
 * cleared. Each is named in `skipped` and `dropped`, printed at the top of
 * the snapshot, so a preset naming something the fixture has not shows.
 */

const GONE = Symbol("gone")
const NO_SECTION = Symbol("no-section")

/** A field naming one record (`product_id`) or a list of them (`category_ids`). */
const ID_FIELD = /^[a-z]+_(ids?)$/

/** A list's items that go with their one record (resolve.ts `DROPPED_IN_ITEMS`). */
const DROPPED_IN_ITEMS: Readonly<Record<string, { field: string; min: number }>> = {
  bands: { field: "category_id", min: 2 },
  picks: { field: "product_id", min: 0 },
  tiles: { field: "category_id", min: 0 },
}

/** The storefront's own pages a preset links to, by address (the backend's `menu-hrefs`). */
const SYSTEM: Readonly<Record<string, string>> = {
  "/": "home",
  "/magaza": "shop",
  "/blog": "blog",
  "/yorumlar": "reviews",
  "/sepet": "cart",
  "/hesap": "account",
  "/siparis": "order_lookup",
  "/kategoriler": "categories",
  "/markalar": "brands",
  "/kampanyalar": "sale",
}

const RECORDS: ReadonlyMap<string, string> = new Map([
  ...CATEGORIES.map((each) => [`category:${each.handle}`, each.id] as const),
  ...PRODUCTS.map((each) => [`product:${each.handle}`, each.id] as const),
  ...BRANDS.map((each) => [`brand:${each.handle}`, each.id] as const),
])

const NAMES: ReadonlyMap<string, string> = new Map([
  ...CATEGORIES.map((each) => [each.id, each.name] as const),
  ...PRODUCTS.map((each) => [each.id, each.title] as const),
])

const BY_PATH: ReadonlyMap<string, { kind: string; id: string }> = new Map<
  string,
  { kind: string; id: string }
>([
  ...Object.entries(CATEGORY_PATHS).map(([id, path]) => [path, { kind: "category", id }] as const),
  ...Object.entries(RECORD_PATHS).map(
    ([id, path]) => [path, { kind: id.startsWith("prod_") ? "product" : "brand", id }] as const
  ),
])

export interface StoreLink {
  label: string | null
  kind: string
  target: string | null
  path: string | null
}

/** An address as the shop answers it, else null (a path nothing answers: a broken link). */
export function linkOf(href: string, label: string | null): StoreLink | null {
  const system = SYSTEM[href]
  if (system) {
    return { label, kind: "system", target: system, path: null }
  }
  const record = BY_PATH.get(href)
  if (record) {
    // The shop's wording, else the record's name (layout-read.ts)
    return {
      label: label ?? NAMES.get(record.id) ?? null,
      kind: record.kind,
      target: record.id,
      path: href,
    }
  }
  // An address kept as written has no wording of its own
  return href.startsWith("https://") && label !== null
    ? { label, kind: "url", target: null, path: href }
    : null
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

interface Walk {
  where: string
  /** The preset's folder, for its pictures' addresses. */
  images: string
  skipped: string[]
}

function marker(node: Record<string, unknown>, walk: Walk): unknown {
  const handle = text(node["$handle"])
  if (handle !== null) {
    const id = RECORDS.get(handle)
    if (id === undefined) {
      walk.skipped.push(`${walk.where} ${handle}`)
      return GONE
    }
    return id
  }
  const href = text(node["$href"])
  if (href !== null) {
    const link = linkOf(href, text(node["label"]))
    if (!link) {
      walk.skipped.push(`${walk.where} ${href}`)
      return GONE
    }
    return link
  }
  const path = text(node["$image"])
  if (path !== null) {
    return {
      url: `https://cdn.example.com/preset/${walk.images}/${path}`,
      alt: text(node["alt"]),
      width: null,
      height: null,
      derivatives: null,
    }
  }
  return node
}

function resolveList(list: unknown[], key: string | null, walk: Walk): unknown {
  const out: unknown[] = []
  const dropping = key === null ? undefined : DROPPED_IN_ITEMS[key]
  for (const item of list) {
    const resolved = resolveNode(item, walk, null, dropping?.field)
    if (resolved === NO_SECTION) {
      return NO_SECTION
    }
    if (resolved !== GONE) {
      out.push(resolved)
    }
  }
  if (dropping && out.length < dropping.min) {
    return NO_SECTION
  }
  if (key !== null && ID_FIELD.exec(key)?.[1] === "ids" && list.length > 0 && out.length === 0) {
    return NO_SECTION
  }
  return out
}

function resolveNode(
  node: unknown,
  walk: Walk,
  key: string | null = null,
  dropsItem?: string
): unknown {
  if (Array.isArray(node)) {
    return resolveList(node, key, walk)
  }
  if (!isObject(node)) {
    return node
  }
  if (Object.keys(node).some((name) => name.startsWith("$"))) {
    return marker(node, walk)
  }
  const out: Record<string, unknown> = {}
  for (const [name, child] of Object.entries(node)) {
    const resolved = resolveNode(child, walk, name)
    if (resolved === NO_SECTION) {
      return NO_SECTION
    }
    if (resolved === GONE) {
      if (name === dropsItem) {
        return GONE
      }
      if (ID_FIELD.exec(name)?.[1] === "id") {
        return NO_SECTION
      }
      out[name] = null
      continue
    }
    out[name] = resolved
  }
  return out
}

export type Section = Record<string, unknown> & { id: string; type: string }

/** A group's sections resolved; the dropped ones named in `dropped`. */
export function resolveGroup(
  group: string,
  sections: readonly unknown[],
  images: string,
  report: { skipped: string[]; dropped: string[] }
): Section[] {
  return sections.flatMap((section) => {
    const id = isObject(section) && typeof section["id"] === "string" ? section["id"] : "?"
    const where = `${group}.${id}`
    const resolved = resolveNode(section, { where, images, skipped: report.skipped })
    if (resolved === NO_SECTION || resolved === GONE || !isObject(resolved)) {
      report.dropped.push(where)
      return []
    }
    return [{ ...resolved, id, type: String(resolved["type"]) }]
  })
}
