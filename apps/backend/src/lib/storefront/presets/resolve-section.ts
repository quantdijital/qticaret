import type { PresetLookups, SkippedRef } from "./resolve"

/**
 * One section of a preset with its references resolved for this shop
 * (`resolvePreset`, adr/0063 §2, §4): the walk over its fields. What
 * cannot be resolved is left out, never stood in for (the rules are
 * `resolve.ts`'s to say).
 */

/** The value is gone: taken out of its list, or its field cleared. */
const GONE = Symbol("gone")
/** The section cannot stand without it. */
const NO_SECTION = Symbol("no-section")
type Outcome = unknown

/** A field naming one record (`product_id`) or a list of them (`category_ids`). */
const ID_FIELD = /^[a-z]+_(ids?)$/

/**
 * A list's items that go when their one record does, by the list's field:
 * a price band whose category the shop lacks (adr/0049, 2026-11-15). The
 * band is dropped, never turned into a whole-shop price band under the
 * category's own label; the list keeps the others while it has at least
 * `min` (a strip has two to four bands), else the section goes. A
 * catalogue opening's small products and category tiles (H17) are extras
 * of the opening: one the shop lacks goes alone, the opening stays.
 */
const DROPPED_IN_ITEMS: Readonly<Record<string, { field: string; min: number }>> = {
  bands: { field: "category_id", min: 2 },
  picks: { field: "product_id", min: 0 },
  tiles: { field: "category_id", min: 0 },
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

export interface Walk {
  lookups: PresetLookups
  where: string
  skipped: SkippedRef[]
  images: Set<string>
}

function marker(node: Record<string, unknown>, walk: Walk): Outcome {
  const handle = text(node["$handle"])
  if (handle !== null) {
    const id = walk.lookups.records.get(handle)
    if (id === undefined) {
      walk.skipped.push({ where: walk.where, ref: handle })
      return GONE
    }
    return id
  }
  const href = text(node["$href"])
  if (href !== null) {
    const link = walk.lookups.links.get(href)
    const label = text(node["label"])
    // An address kept as written has no wording of its own (the pack's schema asks one)
    if (!link || (link.kind === "url" && label === null)) {
      walk.skipped.push({ where: walk.where, ref: href })
      return GONE
    }
    return { ...link, label }
  }
  const path = text(node["$image"])
  if (path !== null) {
    const url = walk.lookups.images.get(path)
    if (url === undefined) {
      throw new Error(`preset image ${path} was not brought into the library`)
    }
    walk.images.add(path)
    return { url, alt: text(node["alt"]) }
  }
  return node
}

function resolveList(list: unknown[], key: string | null, walk: Walk): Outcome {
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
  // A choice the preset made and the shop has none of: never "every category" instead
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
): Outcome {
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
      // The item goes with its record (a band without its category)
      if (name === dropsItem) {
        return GONE
      }
      // A section's one record is the section; a single link only cleared
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

/** The section resolved; null: it cannot stand without what the shop lacks. */
export function resolveSection(section: unknown, walk: Walk): unknown {
  const resolved = resolveNode(section, walk)
  return resolved === NO_SECTION || resolved === GONE ? null : resolved
}
