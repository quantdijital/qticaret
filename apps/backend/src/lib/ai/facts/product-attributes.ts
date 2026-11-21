import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SUMMARY_TEXT_MAX, storedSummaryText } from "../../catalog/summary"
import { fromColumns } from "../../../modules/product-attributes/values"
import type { StoredColumns } from "../../../modules/product-attributes/values"
import { aiValidationError } from "../errors"
import type { AttributeAllowed, AttributeChoice } from "../product-attributes"
import type { CardAttributeType, CardOption } from "../product-card"
import { READABLE_TYPES } from "./media"
import type { AiImageRef } from "./media"
import {
  ATTRIBUTE_LINE_LENGTH,
  MAX_CARD_ATTRIBUTES,
  MAX_CARD_OPTIONS,
  attributeLine,
} from "./product-card"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * The attributes an attributes suggestion may fill, beside the product's
 * own facts (adr/0074 §5 madde 3; adr/0071 §10): its template's product
 * attributes that are public and have no value yet, each under a short
 * code with its label, kind, unit and options. A filled one is never
 * named (its value is in the product's facts, public ones only), nor one
 * the shop keeps to itself (`is_public: false`), nor a variant's. Keys
 * and ids, never sent, stay on the server as `allowed`. No price, stock,
 * order, customer or staff field is read.
 */

/** The data block's list field: what the instruction names. */
export const ATTRIBUTE_CHOICES_FIELD = "attribute_choices"

interface DefinitionRow {
  key: string
  label: string
  type: CardAttributeType
  unit?: string | null
  options?: CardOption[] | null
  scope?: "product" | "variant" | null
  rank?: number | null
  is_public?: boolean | null
}

interface ValueRow extends StoredColumns {
  definition?: { key: string; type: CardAttributeType } | null
}

export interface AttributeProductRow {
  attribute_template?: { definitions?: (DefinitionRow | null)[] | null } | null
  attribute_values?: (ValueRow | null)[] | null
  product_extension?: { summary_doc?: unknown } | null
}

/** The data block's field for the product's short description (adr/0055 Ek 2026-11-06), as plain text. */
export const SUMMARY_FIELD = "summary"

export interface AttributeFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
  maxItems: Readonly<Record<string, number>>
  allowed: AttributeAllowed
}

const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0)

/** The keys of the attributes the product has a value for. */
function filledKeys(row: AttributeProductRow): Set<string> {
  return new Set(
    (row.attribute_values ?? []).flatMap((value) =>
      value?.definition && !isEmpty(fromColumns(value.definition.type, value))
        ? [value.definition.key]
        : []
    )
  )
}

/** The product's template's public product attributes with no value, in its order, under `a1`, `a2`… */
export function emptyAttributes(row: AttributeProductRow): AttributeChoice[] {
  const filled = filledKeys(row)
  return (row.attribute_template?.definitions ?? [])
    .filter(
      (each): each is DefinitionRow =>
        !!each &&
        (each.scope ?? "product") === "product" &&
        each.is_public !== false &&
        !filled.has(each.key)
    )
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.key.localeCompare(b.key))
    .slice(0, MAX_CARD_ATTRIBUTES)
    .map((each, index) => ({
      code: `a${String(index + 1)}`,
      key: each.key,
      label: each.label,
      type: each.type,
      unit: each.unit ?? null,
      options:
        each.type === "select" || each.type === "multi_select"
          ? (each.options ?? []).slice(0, MAX_CARD_OPTIONS)
          : null,
    }))
}

/**
 * Whether the data block carries the whole list: every code, in order,
 * each with its whole line. A block that lost part of it is not sent: the
 * answer would name codes, or options, the service never saw (#251 D2, as
 * a pick's list; #252 D1, a line clipped at `ATTRIBUTE_LINE_LENGTH`).
 */
export function sentWholeAttributes(data: string, facts: AttributeFacts): boolean {
  const lines = facts.allowed.attributes.map((each) => attributeLine(each))
  if (lines.some((line) => Array.from(line.trim()).length > ATTRIBUTE_LINE_LENGTH)) {
    return false
  }
  const codes = facts.allowed.attributes.map((each) => each.code)
  let sent: unknown
  try {
    sent = (JSON.parse(data) as { data?: Record<string, unknown> }).data?.[ATTRIBUTE_CHOICES_FIELD]
  } catch {
    return false
  }
  return (
    Array.isArray(sent) &&
    sent.length === codes.length &&
    sent.every((each, index) => (each as { label?: unknown } | null)?.label === codes[index])
  )
}

/** The empty attributes the suggestion names, and the same list as `allowed`. */
export async function productAttributeFacts(
  container: FactsContainer,
  productId: string
): Promise<AttributeFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "attribute_template.definitions.key",
      "attribute_template.definitions.label",
      "attribute_template.definitions.type",
      "attribute_template.definitions.unit",
      "attribute_template.definitions.options",
      "attribute_template.definitions.scope",
      "attribute_template.definitions.rank",
      "attribute_template.definitions.is_public",
      "attribute_values.*",
      "attribute_values.definition.key",
      "attribute_values.definition.type",
      // The short description shown under its name: values are often written there
      "product_extension.summary_doc",
    ],
    filters: { id: productId },
  })
  const row = data[0] as AttributeProductRow | undefined
  if (!row) {
    throw aiValidationError("ai.unknown_entity")
  }
  const attributes = emptyAttributes(row)
  const summary = storedSummaryText(row.product_extension?.summary_doc)
  return {
    fields: {
      [ATTRIBUTE_CHOICES_FIELD]: attributes.map((each) => ({
        label: each.code,
        value: attributeLine(each),
      })),
      [SUMMARY_FIELD]: summary === "" ? null : summary,
    },
    maxLengths: {
      [ATTRIBUTE_CHOICES_FIELD]: ATTRIBUTE_LINE_LENGTH,
      [SUMMARY_FIELD]: SUMMARY_TEXT_MAX,
    },
    maxItems: { [ATTRIBUTE_CHOICES_FIELD]: MAX_CARD_ATTRIBUTES },
    allowed: { kind: "product_attributes", attributes },
  }
}

interface PhotoRow {
  thumbnail?: string | null
  images?: ({ url?: string | null; rank?: number | null } | null)[] | null
  media_assets?:
    ({ url?: string | null; file_id?: string | null; mime_type?: string | null } | null)[] | null
}

/**
 * The product's first picture a vision service can read: its main image
 * (the thumbnail, as the storefront shows it first), else its images in
 * their order; only one of its own stored records (a file in the shop's
 * storage, a readable type), never an address. Null when there is none.
 */
export async function productPhotoOf(
  container: FactsContainer,
  productId: string
): Promise<AiImageRef | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "thumbnail",
      "images.url",
      "images.rank",
      "media_assets.url",
      "media_assets.file_id",
      "media_assets.mime_type",
    ],
    filters: { id: productId },
  })
  const row = data[0] as PhotoRow | undefined
  if (!row) {
    return null
  }
  const ordered = (row.images ?? [])
    .flatMap((image) => (image?.url ? [{ url: image.url, rank: image.rank ?? 0 }] : []))
    .sort((a, b) => a.rank - b.rank)
    .map((image) => image.url)
  const urls = [...(row.thumbnail ? [row.thumbnail] : []), ...ordered]
  for (const url of urls) {
    const asset = (row.media_assets ?? []).find((each) => each?.url === url)
    if (asset?.file_id && READABLE_TYPES.has(asset.mime_type ?? "")) {
      return { file_id: asset.file_id }
    }
  }
  return null
}
