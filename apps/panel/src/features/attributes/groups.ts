import { toSlug } from "@/lib/slug"
import type { AttributeGroup } from "./types"

/**
 * A template's spec table sections (adr/0013 Ek 2026-11-04) in the editor.
 * The key is made once from the name the group is added with and never
 * shown: a rename changes the name only, so the fields that name the group
 * keep it.
 */
export interface GroupForm {
  key: string
  name: string
}

/** The server's limits (backend product-attributes/validation.ts). */
export const GROUP_LIMITS = { groups: 30, nameLength: 100, keyLength: 40 } as const

// A key with no letter or digit left in its name (one of symbols only)
const FALLBACK_KEY = "group"

/**
 * A key the server takes (`^[a-z0-9][a-z0-9_-]{0,39}$`) from a group's
 * name, Turkish letters folded ("Ölçüler" → "olculer"); one already taken
 * gets a number ("olculer_2").
 */
export function groupKey(name: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base =
    toSlug(name, GROUP_LIMITS.keyLength).replace(/-/g, "_") ||
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, GROUP_LIMITS.keyLength) ||
    FALLBACK_KEY
  if (!used.has(base)) {
    return base
  }
  for (let number = 2; ; number += 1) {
    const suffix = `_${String(number)}`
    const key = `${base.slice(0, GROUP_LIMITS.keyLength - suffix.length)}${suffix}`
    if (!used.has(key)) {
      return key
    }
  }
}

/** The saved sections in their order, for the editor. */
export const groupsForm = (groups: AttributeGroup[] | null | undefined): GroupForm[] =>
  [...(groups ?? [])].sort((a, b) => a.rank - b.rank).map(({ key, name }) => ({ key, name }))

/** The sections as the API takes them; list order becomes `rank`. */
export const groupsApi = (groups: GroupForm[]): AttributeGroup[] =>
  groups.map((group, index) => ({ key: group.key, name: group.name.trim(), rank: index }))
