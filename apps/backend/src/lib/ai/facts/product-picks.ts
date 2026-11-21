import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { aiValidationError } from "../errors"
import type { PickAllowed, PickChoice } from "../product-picks"
import { MAX_TAG_CHOICES } from "../registry/product-page-tasks"
import { MAX_CARD_CATEGORIES, shownCategories } from "./product-card"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * The shop's lists a pick task names beside the product's own facts
 * (adr/0074 §5 madde 2; adr/0071 §10): its tags by name, its shown
 * categories by name ("Üst > Alt"), each under a short code. A category
 * internal or closed, or under such a parent, is never named; those the
 * product already has are left out of either list. Ids, never sent, stay
 * on the server as `allowed`: the only records the answer may name. No
 * price, stock, order, customer or staff field is read.
 */

/** The data block's list fields: what the instruction names. */
export const TAG_CHOICES_FIELD = "tag_choices"
export const CATEGORY_CHOICES_FIELD = "category_choices"

/**
 * One listed name's longest text (#251 D2): short, so a full list (200
 * tags, 150 categories) stays far under the data block's ceiling and is
 * never the field it drops. A category's "Üst > Alt" takes two names.
 */
export const TAG_CHOICE_LENGTH = 60
export const CATEGORY_CHOICE_LENGTH = 120

interface OwnRow {
  tags?: ({ id?: string | null; value?: string | null } | null)[] | null
  categories?: ({ id?: string | null } | null)[] | null
}

export interface PickFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
  maxItems: Readonly<Record<string, number>>
  allowed: PickAllowed
}

/**
 * Whether the data block carries the whole list (#251 D2): every listed
 * code, in order. A block that lost the list, or part of it, is not sent:
 * the answer would name codes the service never saw.
 */
export function sentWhole(data: string, facts: PickFacts): boolean {
  const field = facts.allowed.kind === "product_tags" ? TAG_CHOICES_FIELD : CATEGORY_CHOICES_FIELD
  const codes = facts.allowed.choices.map((each) => each.code)
  let sent: unknown
  try {
    sent = (JSON.parse(data) as { data?: Record<string, unknown> }).data?.[field]
  } catch {
    return false
  }
  if (sent === undefined) {
    return codes.length === 0
  }
  return (
    Array.isArray(sent) &&
    sent.length === codes.length &&
    sent.every((each, index) => (each as { label?: unknown } | null)?.label === codes[index])
  )
}

/** The product's own tags and categories: what is not offered again. */
async function ownOf(container: FactsContainer, productId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "tags.id", "tags.value", "categories.id"],
    filters: { id: productId },
  })
  const row = data[0] as OwnRow | undefined
  if (!row) {
    throw aiValidationError("ai.unknown_entity")
  }
  const tags = (row.tags ?? []).filter(
    (tag): tag is { id: string; value: string } =>
      typeof tag?.id === "string" && typeof tag.value === "string"
  )
  const categories = (row.categories ?? [])
    .map((category) => category?.id)
    .filter((id): id is string => typeof id === "string")
  return { tags, categories }
}

/** The shop's tags by name, the product's own left out, `MAX_TAG_CHOICES` at most, under `e1`, `e2`… */
async function tagChoices(
  container: FactsContainer,
  leaveOut: ReadonlySet<string>
): Promise<PickChoice[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_tag",
    fields: ["id", "value"],
    pagination: { take: MAX_TAG_CHOICES + leaveOut.size, order: { value: "ASC" } },
  })
  return (data as { id: string; value?: string | null }[])
    .filter((row) => !leaveOut.has(row.id) && typeof row.value === "string" && row.value.trim())
    .slice(0, MAX_TAG_CHOICES)
    .map((row, index) => ({ code: `e${String(index + 1)}`, id: row.id, name: row.value ?? "" }))
}

const listOf = (choices: readonly PickChoice[]) =>
  choices.map((each) => ({ label: each.code, value: each.name }))

/** The list a pick task names, and the same list as `allowed`. */
export async function productPickFacts(
  container: FactsContainer,
  kind: PickAllowed["kind"],
  productId: string
): Promise<PickFacts> {
  const own = await ownOf(container, productId)
  if (kind === "product_tags") {
    const choices = await tagChoices(container, new Set(own.tags.map((tag) => tag.id)))
    return {
      fields: { [TAG_CHOICES_FIELD]: listOf(choices) },
      maxLengths: { [TAG_CHOICES_FIELD]: TAG_CHOICE_LENGTH },
      maxItems: { [TAG_CHOICES_FIELD]: MAX_TAG_CHOICES },
      allowed: { kind, choices, taken: own.tags.map((tag) => tag.value) },
    }
  }
  const choices = await shownCategories(container, new Set(own.categories))
  return {
    fields: { [CATEGORY_CHOICES_FIELD]: listOf(choices) },
    maxLengths: { [CATEGORY_CHOICES_FIELD]: CATEGORY_CHOICE_LENGTH },
    maxItems: { [CATEGORY_CHOICES_FIELD]: MAX_CARD_CATEGORIES },
    allowed: { kind, choices, taken: [] },
  }
}
