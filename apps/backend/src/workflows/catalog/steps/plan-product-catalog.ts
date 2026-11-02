import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { Restriction } from "../../../lib/catalog"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount } from "../../../lib/money"
import type { PRODUCT_CONDITIONS } from "../../../modules/catalog-extension/models/product-extension"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import {
  GIFT_CARDS,
  NON_PHYSICAL_PRODUCTS,
  RESTRICTED_PRODUCTS,
} from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { NO_SHIPPING_CHANGES, SHIPPING_FIELDS, shippingChanges } from "../shipping-kind"
import type { ProductKind, ShippingChanges, ShippingRow } from "../shipping-kind"

type Condition = (typeof PRODUCT_CONDITIONS)[number]

export interface SetProductCatalogInput {
  product_id: string
  // Optional as the request body has them: absent or undefined both mean "keep"
  condition?: Condition | undefined
  kind?: ProductKind | undefined
  primary_category_id?: string | null | undefined
  successor_product_id?: string | null | undefined
  /** Outside the right of withdrawal (F13.6). */
  withdrawal_excluded?: boolean | undefined
  /** Sold to adults only, and why (F13.4); null clears it. */
  restriction?: Restriction | null | undefined
  /** Its variants are gift card amounts (adr/0025 Ek 2026-11-03). */
  is_gift_card?: boolean | undefined
  /** Per variant: the MPN, and the unit cost in lira (VAT excluded, F11.4). */
  variants?:
    | Record<string, { mpn?: string | null | undefined; cost?: number | null | undefined }>
    | undefined
}

/** A variant's own fields; the cost in kuruş. */
export interface VariantFields {
  mpn: string | null
  cost: number | null
}

export interface ExtensionFields {
  condition: Condition
  kind: ProductKind
  primary_category_id: string | null
  successor_product_id: string | null
  withdrawal_excluded: boolean
  restriction: Restriction | null
  is_gift_card: boolean
}

export interface ProductCatalogPlan {
  product_id: string
  /** The product's extension: its row (null: none yet), what changes, what it was. */
  product: { id: string | null; set: Partial<ExtensionFields>; previous: Partial<ExtensionFields> }
  variants: {
    variant_id: string
    id: string | null
    set: Partial<VariantFields>
    previous: Partial<VariantFields>
  }[]
  /** Profile links and inventory items the kind asks to change (F3.2). */
  shipping: ShippingChanges
}

type ShippingVariant = NonNullable<NonNullable<ShippingRow["variants"]>[number]>

interface ProductRow extends ShippingRow {
  id: string
  categories?: ({ id: string } | null)[] | null
  variants?: (
    | (ShippingVariant & {
        id: string
        variant_extension?: ({ id: string } & VariantFields) | null
      })
    | null
  )[]
  product_extension?: (ExtensionFields & { id: string }) | null
}

// A successor chain longer than this is refused as if it looped
const MAX_SUCCESSOR_CHAIN = 20

async function productRow(container: MedusaContainer, id: string, fields: string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields, filters: { id } })
  return data[0] as ProductRow | undefined
}

/**
 * The successor is where the product's URL points once it is no longer sold
 * (docs/13 §2.4): another existing product, and following successors from
 * it never comes back to this one (a redirect loop).
 */
async function checkSuccessor(container: MedusaContainer, productId: string, successorId: string) {
  if (successorId === productId) {
    throw new ValidationError("catalog.successor_self", { field: "successor_product_id" })
  }
  let current = successorId
  for (let step = 0; step < MAX_SUCCESSOR_CHAIN; step += 1) {
    const row = await productRow(container, current, [
      "id",
      "product_extension.successor_product_id",
    ])
    if (!row) {
      if (step === 0) {
        throw new ValidationError("catalog.successor_unknown", { field: "successor_product_id" })
      }
      // A deleted product further down ends the chain
      return
    }
    const next = row.product_extension?.successor_product_id
    if (!next) {
      return
    }
    if (next === productId) {
      break
    }
    current = next
  }
  throw new ValidationError("catalog.successor_loop", { field: "successor_product_id" })
}

const EXTENSION_KEYS = [
  "condition",
  "kind",
  "primary_category_id",
  "successor_product_id",
  "withdrawal_excluded",
  "restriction",
  "is_gift_card",
] as const

/** The fields the save sends (absent ones keep their values) and what they hold now. */
function changesOf(input: SetProductCatalogInput, current: ExtensionFields | null) {
  const set: Partial<ExtensionFields> = {}
  const previous: Partial<ExtensionFields> = {}
  for (const key of EXTENSION_KEYS) {
    if (input[key] !== undefined) {
      Object.assign(set, { [key]: input[key] })
      if (current) {
        Object.assign(previous, { [key]: current[key] })
      }
    }
  }
  return { set, previous }
}

/**
 * A kind change (F3.2): digital and service need the flag (a product that
 * already is one may stay so), and shipping follows the kind. Saving the
 * same kind again re-aligns profile and items too.
 */
async function kindShipping(
  container: MedusaContainer,
  product: ProductRow,
  kind: ProductKind,
  current: ProductKind,
  giftCard: boolean
): Promise<ShippingChanges> {
  // A gift card is digital under its own flag (checked when it is marked)
  if (kind !== "physical" && kind !== current && !giftCard) {
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    if (!(await settings.isFeatureEnabled(NON_PHYSICAL_PRODUCTS))) {
      throw new ValidationError("catalog.kind_disabled", { field: "kind" })
    }
  }
  let defaultProfile: string | null = null
  if (kind === "physical" && !product.shipping_profile?.id) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "shipping_profile",
      fields: ["id", "type"],
      filters: {},
    })
    const profiles = data as { id: string; type: string }[]
    defaultProfile =
      (profiles.find((profile) => profile.type === "default") ?? profiles[0])?.id ?? null
  }
  return shippingChanges(product, kind, defaultProfile)
}

/**
 * A gift card product (adr/0025 Ek 2026-11-03): marking one needs the shop's
 * gift cards on (unmarking never does); it is digital, another kind refused
 * while it is one. The kind the save writes, or undefined to keep it.
 */
async function giftCardKind(
  container: MedusaContainer,
  input: SetProductCatalogInput,
  current: ExtensionFields | null
): Promise<ProductKind | undefined> {
  const marking = input.is_gift_card === true && current?.is_gift_card !== true
  if (marking) {
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    if (!(await settings.isFeatureEnabled(GIFT_CARDS))) {
      throw new ValidationError("catalog.gift_card_disabled", { field: "is_gift_card" })
    }
  }
  if (!(input.is_gift_card ?? current?.is_gift_card ?? false)) {
    return input.kind
  }
  if (input.kind !== undefined && input.kind !== "digital") {
    throw new ValidationError("catalog.gift_card_kind", { field: "kind" })
  }
  return input.is_gift_card === true ? "digital" : input.kind
}

/** What a variant's save changes and what it was: only fields asked for and different. */
function variantChangesOf(
  asked: NonNullable<SetProductCatalogInput["variants"]>[string],
  extension: VariantFields | null
): { set: Partial<VariantFields>; previous: Partial<VariantFields> } {
  const now: VariantFields = { mpn: extension?.mpn ?? null, cost: extension?.cost ?? null }
  const wanted: Partial<VariantFields> = {
    ...(asked.mpn === undefined ? {} : { mpn: asked.mpn }),
    ...(asked.cost === undefined
      ? {}
      : { cost: asked.cost === null ? null : fromMedusaAmount(asked.cost) }),
  }
  const keys = (Object.keys(wanted) as (keyof VariantFields)[]).filter(
    (key) => wanted[key] !== now[key]
  )
  return {
    set: Object.fromEntries(keys.map((key) => [key, wanted[key]])),
    previous: Object.fromEntries(keys.map((key) => [key, now[key]])),
  }
}

/** Checks a catalog save against the product and works out the rows to write; writes nothing. */
export const planProductCatalogStep = createStep(
  "catalog-plan-product-catalog",
  async (input: SetProductCatalogInput, { container }) => {
    const product = await productRow(container, input.product_id, [
      "id",
      "categories.id",
      "variants.id",
      "variants.variant_extension.*",
      "product_extension.*",
      ...SHIPPING_FIELDS,
    ])
    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
    }
    const primary = input.primary_category_id
    if (primary && !product.categories?.some((category) => category?.id === primary)) {
      throw new ValidationError("catalog.primary_category_not_assigned", {
        field: "primary_category_id",
      })
    }
    const successor = input.successor_product_id
    // An unchanged successor was checked when it was set
    if (successor && successor !== product.product_extension?.successor_product_id) {
      await checkSuccessor(container, product.id, successor)
    }
    const variants = new Map(
      (product.variants ?? []).flatMap((variant) => (variant ? [[variant.id, variant]] : []))
    )
    const variantChanges = Object.entries(input.variants ?? {}).flatMap(([variantId, asked]) => {
      const variant = variants.get(variantId)
      if (!variant) {
        throw new ValidationError("catalog.variant_unknown", { field: "variants" })
      }
      const extension = variant.variant_extension ?? null
      const { set, previous } = variantChangesOf(asked, extension)
      // Nothing to write: the same values, or clearing ones that were never set
      return Object.keys(set).length === 0
        ? []
        : [{ variant_id: variantId, id: extension?.id ?? null, set, previous }]
    })
    // F13.4: marking needs the flag; clearing a mark never does
    if (input.restriction) {
      const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      if (!(await settings.isFeatureEnabled(RESTRICTED_PRODUCTS))) {
        throw new ValidationError("catalog.restriction_disabled", { field: "restriction" })
      }
    }
    const extension = product.product_extension ?? null
    const kind = await giftCardKind(container, input, extension)
    const { set, previous } = changesOf({ ...input, kind }, extension)
    const plan: ProductCatalogPlan = {
      product_id: product.id,
      product: { id: extension?.id ?? null, set, previous },
      variants: variantChanges,
      shipping: kind
        ? await kindShipping(
            container,
            product,
            kind,
            extension?.kind ?? "physical",
            input.is_gift_card === true
          )
        : NO_SHIPPING_CHANGES,
    }
    return new StepResponse(plan)
  }
)
