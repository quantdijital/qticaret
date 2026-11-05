import { toSlug } from "../../seo/slug"
import type { AttributeOption, AttributeType } from "../../../modules/product-attributes/validation"
import type { MatchTemplate, MatchedRow } from "./match"
import { numberTokens, readNumber } from "./parse"
import { labelKey } from "./text"
import { unitName } from "./units"
import { BOOLEAN_WORDS } from "./vocabulary"

/**
 * A field the template could take for labels none of its fields names
 * (adr/0013 Ek 2026-11-05): offered in the panel, made only when the shop
 * ticks it. Its kind is read from the values the products give it: all
 * numbers in units of one dimension a number (in the commonest unit), all
 * yes or no a yes/no, a few values shared by several products a choice of
 * them, anything else text. Its section is the one its rows sit under.
 */

export interface FieldSuggestion {
  /** The label folded: what the rows are grouped by. */
  name: string
  /** The commonest way the products write it. */
  label: string
  /** A key free in the template. */
  key: string
  type: AttributeType
  unit: string | null
  options: AttributeOption[] | null
  /** The template's section it would go in; none when the template has none or no row says. */
  group: string | null
  /** How many products give it. */
  products: number
  /** Its values as written, the commonest first (at most 30). */
  values: string[]
}

export interface UnmatchedUse {
  product_id: string
  row: MatchedRow
  /** The section its rows suggest (`groupOf`). */
  group: string | null
}

const MAX_CHOICES = 30
const MAX_SHOWN = 30
const MAX_CHOICE_LENGTH = 100
const KEY = /^[a-z][a-z0-9_]{0,63}$/

const blockOf = (path: string): string => path.split(".").slice(0, 2).join(".")

/**
 * The section a row would go in: the template's group its own section
 * names, else the one most fields matched in its block (the same table or
 * list) are in.
 */
export function groupOf(
  row: MatchedRow,
  rows: readonly MatchedRow[],
  template: MatchTemplate
): string | null {
  const groups = template.groups ?? []
  if (groups.length === 0) {
    return null
  }
  if (row.context) {
    const named = groups.find((group) => labelKey(group.name) === labelKey(row.context ?? ""))
    if (named) {
      return named.key
    }
  }
  const tally = new Map<string, number>()
  for (const other of rows) {
    const field = template.definitions.find((each) => each.key === other.field)
    if (field?.group && blockOf(other.source_path) === blockOf(row.source_path)) {
      tally.set(field.group, (tally.get(field.group) ?? 0) + 1)
    }
  }
  return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const commonest = <T>(items: readonly T[]): T | undefined => {
  const counts = new Map<T, number>()
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1))
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** A free key from a label: snake case, a letter first, unique in `taken`. */
export function keyFor(label: string, taken: Set<string>): string {
  const slug = toSlug(label, 60).replace(/-/g, "_")
  const base = /^[a-z]/.test(slug) ? slug : `a_${slug || "alan"}`.slice(0, 60)
  let key = base
  for (let n = 2; taken.has(key) || key in Object.prototype || !KEY.test(key); n += 1) {
    key = `${base}_${String(n)}`
  }
  taken.add(key)
  return key
}

/** An option's value from its label, as facet URLs take it (digits alone kept). */
function optionValue(label: string, taken: Set<string>): string {
  const ascii = label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const base = (toSlug(label, 90) || ascii.slice(0, 90) || "secenek").replace(/-+$/, "")
  let value = base
  for (let n = 2; taken.has(value); n += 1) {
    value = `${base}-${String(n)}`
  }
  taken.add(value)
  return value
}

/** Whether a value is only numbers and their units ("22 cm", "220 mm (8,7 inç)"). */
export function isNumberish(value: string): boolean {
  const tokens = numberTokens(value)
  let rest = value
  for (const token of [...tokens].reverse()) {
    rest = rest.slice(0, token.start) + rest.slice(token.end)
  }
  return tokens.length > 0 && rest.replace(/[\s/()~≈±,.\-–—x×]/g, "") === ""
}

interface Kind {
  type: AttributeType
  unit: string | null
  options: AttributeOption[] | null
}

/** The kind the values read as. */
export function kindOf(
  values: readonly { value: string; unit?: string | undefined }[],
  products: number
): Kind {
  const written = values.map(({ value, unit }) => numberTokens(value)[0]?.unit ?? unit ?? null)
  const unit = commonest(written.filter((each): each is string => each !== null)) ?? null
  if (
    values.length > 0 &&
    values.every(
      ({ value, unit: labelUnit }) =>
        isNumberish(value) && readNumber(value, unit, labelUnit ?? null).ok
    )
  ) {
    return { type: "number", unit: unit ? unitName(unit) : null, options: null }
  }
  if (
    values.length > 0 &&
    values.every(({ value }) => BOOLEAN_WORDS[labelKey(value)] !== undefined)
  ) {
    return { type: "boolean", unit: null, options: null }
  }
  const distinct = [...new Set(values.map(({ value }) => value))]
  if (
    products >= 2 &&
    distinct.length <= MAX_CHOICES &&
    distinct.length < values.length &&
    distinct.every((value) => value.length <= MAX_CHOICE_LENGTH)
  ) {
    const taken = new Set<string>()
    const byKey = new Map<string, string>()
    distinct.forEach((value) => byKey.set(labelKey(value) || value, value))
    return {
      type: "select",
      unit: null,
      options: [...byKey.values()].map((label) => ({ value: optionValue(label, taken), label })),
    }
  }
  return { type: "text", unit: null, options: null }
}

/** The fields a template could take for the labels its fields do not name, the commonest first. */
export function suggestFields(
  uses: readonly UnmatchedUse[],
  template: MatchTemplate
): FieldSuggestion[] {
  const byName = new Map<string, UnmatchedUse[]>()
  for (const use of uses) {
    const name = labelKey(use.row.label)
    if (name !== "") {
      byName.set(name, [...(byName.get(name) ?? []), use])
    }
  }
  const taken = new Set(template.definitions.map((field) => field.key))
  return [...byName]
    .map(([name, own]) => ({
      name,
      own,
      products: new Set(own.map((use) => use.product_id)).size,
    }))
    .sort((a, b) => b.products - a.products || a.name.localeCompare(b.name))
    .map(({ name, own, products }) => {
      const label = commonest(own.map((use) => use.row.label)) ?? name
      const kind = kindOf(
        own.map((use) => ({
          value: use.row.value,
          ...(use.row.unit ? { unit: use.row.unit } : {}),
        })),
        products
      )
      const counts = new Map<string, number>()
      own.forEach((use) => counts.set(use.row.value, (counts.get(use.row.value) ?? 0) + 1))
      return {
        name,
        label,
        key: keyFor(label, taken),
        ...kind,
        group: commonest(own.flatMap((use) => (use.group ? [use.group] : []))) ?? null,
        products,
        values: [...counts]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
          .slice(0, MAX_SHOWN)
          .map(([value]) => value),
      }
    })
}
