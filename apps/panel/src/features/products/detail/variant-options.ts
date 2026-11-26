import type { ProductDetail } from "@/features/products/api/products"
import type {
  OptionChanges,
  VariantCreate,
  VariantFill,
  VariantPlan,
} from "@/features/products/api/product-options"
import type { Variant } from "./variant-values"

/**
 * The product's options as the variants card edits them (the owner,
 * 2026-11-25, WooCommerce's flow): options and their values typed as
 * chips, then "Varyantları oluştur" makes every combination the product
 * has no variant for. Nothing is ever deleted and no variant is made twice.
 */

export interface OptionDraft {
  /** The stored option's id; none for an option typed here. */
  id: string | null
  title: string
  values: string[]
}

/** The option a product of no options gets ("Seçenek: Standart", the wizard's): not edited here. */
export interface Placeholder {
  title: string
  value: string
}

type ProductOption = NonNullable<ProductDetail["options"]>[number]

export const MAX_OPTIONS = 3

const isPlaceholder = (option: ProductOption, placeholder: Placeholder) =>
  option.title === placeholder.title &&
  (option.values ?? []).length === 1 &&
  option.values?.[0]?.value === placeholder.value

/** The stored options, the placeholder left out, each value in the order it was made. */
export function savedOptions(product: ProductDetail, placeholder: Placeholder): OptionDraft[] {
  return (product.options ?? [])
    .filter((option) => !isPlaceholder(option, placeholder))
    .map((option) => ({
      id: option.id,
      title: option.title,
      values: (option.values ?? []).map((value) => value.value),
    }))
}

/** The options as stored, the placeholder too: each stays on new variants with its one value. */
function fixedOptions(product: ProductDetail, placeholder: Placeholder): Record<string, string> {
  return Object.fromEntries(
    (product.options ?? []).flatMap((option) =>
      isPlaceholder(option, placeholder) ? [[option.title, placeholder.value]] : []
    )
  )
}

/** A variant's values by its options' titles. */
export function valuesOf(product: ProductDetail, variant: Variant): Record<string, string> {
  const titles = new Map((product.options ?? []).map((option) => [option.id, option.title]))
  return Object.fromEntries(
    (variant.options ?? []).flatMap((value) => {
      const title = value.option_id ? titles.get(value.option_id) : undefined
      return title && value.value ? [[title, value.value]] : []
    })
  )
}

/** "Renk=Mor|Boy=20 cm": the values one variant stands for, in the options' order. */
const keyOf = (titles: readonly string[], values: Record<string, string>) =>
  titles.map((title) => `${title}=${values[title] ?? ""}`).join("|")

/** Every combination of the options' values, in the order they were typed. */
export function combinations(options: readonly OptionDraft[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (rows, option) =>
      rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.title]: value }))),
    [{}]
  )
}

/** Values some variant uses, by option title: they cannot be taken off. */
export function usedValues(product: ProductDetail): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>()
  for (const variant of product.variants ?? []) {
    for (const [title, value] of Object.entries(valuesOf(product, variant))) {
      const set = used.get(title) ?? new Set<string>()
      set.add(value)
      used.set(title, set)
    }
  }
  return used
}

/** What a draft changes on the stored options. */
function optionChanges(
  saved: readonly OptionDraft[],
  drafts: readonly OptionDraft[]
): OptionChanges {
  const kept = new Set(drafts.flatMap((draft) => (draft.id ? [draft.id] : [])))
  return {
    add: drafts
      .filter((draft) => draft.id === null && draft.values.length > 0)
      .map((draft) => ({ title: draft.title.trim(), values: draft.values })),
    remove: saved.flatMap((option) => (option.id && !kept.has(option.id) ? [option.id] : [])),
    update: drafts.flatMap((draft) => {
      const before = saved.find((option) => option.id !== null && option.id === draft.id)
      if (!before?.id) {
        return []
      }
      const add = draft.values.filter((value) => !before.values.includes(value))
      const remove = before.values.filter((value) => !draft.values.includes(value))
      return add.length > 0 || remove.length > 0 ? [{ optionId: before.id, add, remove }] : []
    }),
  }
}

/**
 * The plan for a draft: the option changes, a value for each variant
 * lacking one of the options (the option's first value), and a new
 * variant for each combination no variant stands for. Value ids to take
 * off are resolved from the product.
 */
export function planVariants(
  product: ProductDetail,
  drafts: readonly OptionDraft[],
  placeholder: Placeholder
): VariantPlan {
  const saved = savedOptions(product, placeholder)
  const raw = optionChanges(saved, drafts)
  // The stored value ids of what is taken off
  const valueIds = new Map(
    (product.options ?? []).map((option) => [
      option.id,
      new Map((option.values ?? []).map((value) => [value.value, value.id])),
    ])
  )
  const options: OptionChanges = {
    ...raw,
    update: raw.update.map((each) => ({
      ...each,
      remove: each.remove.flatMap((value) => {
        const id = valueIds.get(each.optionId)?.get(value)
        return id ? [id] : []
      }),
    })),
  }
  const live = drafts.filter((draft) => draft.title.trim() !== "" && draft.values.length > 0)
  const titles = live.map((draft) => draft.title.trim())
  const fixed = fixedOptions(product, placeholder)
  const variants = product.variants ?? []
  const fill: VariantFill[] = []
  const have = new Set<string>()
  for (const variant of variants) {
    const values = valuesOf(product, variant)
    const missing = Object.fromEntries(
      live.flatMap((draft) =>
        values[draft.title.trim()] ? [] : [[draft.title.trim(), draft.values[0] ?? ""]]
      )
    )
    if (Object.keys(missing).length > 0) {
      fill.push({ id: variant.id, options: { ...values, ...missing } })
    }
    have.add(keyOf(titles, { ...values, ...missing }))
  }
  const rank = Math.max(-1, ...variants.map((variant) => variant.variant_rank ?? 0)) + 1
  const tracked = variants[0]?.manage_inventory ?? true
  const create: VariantCreate[] = (live.length > 0 ? combinations(live) : [])
    .filter((combo) => !have.has(keyOf(titles, combo)))
    .map((combo, at) => ({
      title: titles.map((title) => combo[title]).join(" / "),
      options: { ...fixed, ...combo },
      variant_rank: rank + at,
      manage_inventory: tracked,
    }))
  return { options, fill, create }
}

/** Whether the draft differs from what is stored. */
export function draftChanged(saved: readonly OptionDraft[], drafts: readonly OptionDraft[]) {
  return JSON.stringify(saved) !== JSON.stringify(drafts)
}

/** A draft that cannot be saved: an option with no name or a name used twice. */
export function draftProblem(drafts: readonly OptionDraft[]): "name" | "duplicate" | null {
  const names = drafts.map((draft) => draft.title.trim().toLocaleLowerCase("tr"))
  if (drafts.some((draft, at) => names[at] === "" && draft.values.length > 0)) {
    return "name"
  }
  return new Set(names.filter(Boolean)).size < names.filter(Boolean).length ? "duplicate" : null
}
