import type { z } from "zod"
import { HANDLE_KINDS, handleRef, hrefRef, imageRef } from "./preset-schema"
import { SectorPackError, pathText } from "./read-json"

/**
 * The references in a preset's design and demo records (adr/0063 §2): a
 * record, an image and a link are written as `{ "$handle": "kind:handle" }`,
 * `{ "$image": "images/…" }` and `{ "$href": "/…" }`, never as an id, a
 * media address or a link to a record. This finds and checks them; the
 * backend resolves them for the shop it applies the preset to.
 */

const MARKERS: Readonly<Record<string, z.ZodType>> = {
  $handle: handleRef,
  $image: imageRef,
  $href: hrefRef,
}

/** A field that holds a record (`category_ids`, `product_id`): its kind is its name's start. */
const ID_FIELD = /^([a-z]+)_(ids?)$/

/** A Medusa record id (`pcat_01J…`, a ULID): a shop's own, never a preset's. */
const RECORD_ID = /^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$/

/** Fields of a link to a record and of a media image; a preset writes `$href` and `$image`. */
const SHOP_ONLY_FIELDS = new Set(["url", "target"])

export interface PresetRefs {
  /** Every `$image` path. */
  images: Set<string>
  /** Every `$handle`, once each. */
  handles: Set<string>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const kindOf = (value: unknown): string | undefined =>
  isObject(value) && typeof value["$handle"] === "string"
    ? value["$handle"].split(":")[0]
    : undefined

/** The references in `value`, checked; throws naming the file (`where`) and the place. */
export function presetRefs(value: unknown, where: string, refs?: PresetRefs): PresetRefs {
  const out: PresetRefs = refs ?? { images: new Set(), handles: new Set() }
  const fail = (path: readonly PropertyKey[], what: string): never => {
    throw new SectorPackError(`${where} ${pathText(path)}: ${what}`)
  }

  const walkIds = (node: unknown, path: PropertyKey[], kind: string, many: boolean) => {
    if (!(HANDLE_KINDS as readonly string[]).includes(kind)) {
      fail(path, `a ${kind} is no record a preset can name`)
    }
    const items = many ? node : [node]
    if (!Array.isArray(items)) {
      return fail(path, "a list of {$handle} expected")
    }
    items.forEach((item, index) => {
      if (kindOf(item) !== kind) {
        fail(many ? [...path, index] : path, `a {"$handle": "${kind}:…"} expected`)
      }
    })
  }

  const walk = (node: unknown, path: PropertyKey[]): void => {
    if (typeof node === "string" && RECORD_ID.test(node)) {
      fail(path, "a record id; a preset names a record by {$handle}")
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        walk(item, [...path, index])
      })
      return
    }
    if (!isObject(node)) {
      return
    }
    const marker = Object.keys(node).find((key) => key.startsWith("$"))
    if (marker !== undefined) {
      const schema = Object.hasOwn(MARKERS, marker) ? MARKERS[marker] : undefined
      if (!schema) {
        return fail(path, `${marker} is no reference`)
      }
      const parsed = schema.safeParse(node)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return fail([...path, ...(issue?.path ?? [])], issue?.message ?? "not a reference")
      }
      if (marker === "$image") {
        out.images.add(node["$image"] as string)
      } else if (marker === "$handle") {
        out.handles.add(node["$handle"] as string)
      }
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if (SHOP_ONLY_FIELDS.has(key)) {
        fail([...path, key], "a preset writes a link as {$href} and an image as {$image}")
      }
      const field = ID_FIELD.exec(key)
      if (field?.[1] && field[2]) {
        walkIds(child, [...path, key], field[1], field[2] === "ids")
      }
      walk(child, [...path, key])
    }
  }

  walk(value, [])
  return out
}
