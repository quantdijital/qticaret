import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { Restriction } from "../../../lib/catalog"
import type { AddonInput, StoredAddons } from "../../../lib/catalog/addons"
import { descriptionChanges } from "../../../lib/catalog/description"
import type { DescriptionDoc } from "../../../lib/catalog/description"
import type { SummaryDoc } from "../../../lib/catalog/summary"
import type { ContentDoc } from "../../../lib/content"
import { hasText } from "../../../lib/content/plain"
import { addonsToWrite } from "../addons"
import { bookingModeOf, bookingVariantsToAlign } from "../booking-mode"
import type { BookingMode, StockVariant } from "../booking-mode"
import { giftCardKind, kindShipping } from "../kind-rules"
import { checkSuccessor } from "../successor"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount } from "../../../lib/money"
import type { PRODUCT_CONDITIONS } from "../../../modules/catalog-extension/models/product-extension"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { RESTRICTED_PRODUCTS } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { NO_SHIPPING_CHANGES, SHIPPING_FIELDS } from "../shipping-kind"
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
  /** Its add-ons (adr/0052); null or none clears them. */
  addons?: AddonInput[] | null | undefined
  /**
   * Its long description as a checked document (adr/0055): its plain text
   * becomes `product.description`; one without text clears both; null drops
   * the document and keeps the text.
   */
  description_doc?: ContentDoc | null | undefined
  /**
   * Its short description as a checked document (adr/0055 Ek 2026-11-06,
   * `lib/catalog/summary`); one without text, or null, clears it.
   */
  summary_doc?: SummaryDoc | null | undefined
  /** How it is booked (adr/0076 §2, `booking-mode.ts`). */
  booking_mode?: BookingMode | undefined
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
  addons: StoredAddons | null
  description_doc: DescriptionDoc | null
  summary_doc: SummaryDoc | null
  booking_mode: BookingMode
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
  /** The product's own description, when the document's plain text changes it (adr/0055). */
  description?: string | undefined
  /** A dated product's variants stop tracking stock and selling past it (adr/0076 §3). */
  alignBookingVariants: boolean
}

type ShippingVariant = NonNullable<NonNullable<ShippingRow["variants"]>[number]>

interface ProductRow extends ShippingRow {
  id: string
  description?: string | null
  categories?: ({ id: string } | null)[] | null
  variants?: (
    | (ShippingVariant &
        StockVariant & {
          id: string
          variant_extension?: ({ id: string } & VariantFields) | null
        })
    | null
  )[]
  product_extension?: (ExtensionFields & { id: string }) | null
}

async function productRow(container: MedusaContainer, id: string, fields: string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields, filters: { id } })
  return data[0] as ProductRow | undefined
}

const EXTENSION_KEYS = [
  "condition",
  "kind",
  "primary_category_id",
  "successor_product_id",
  "withdrawal_excluded",
  "restriction",
  "is_gift_card",
  "addons",
  "description_doc",
  "summary_doc",
  "booking_mode",
] as const

type ExtensionChanges = Omit<SetProductCatalogInput, "addons"> & {
  addons?: StoredAddons | null | undefined
}

/** The fields the save sends (absent ones keep their values) and what they hold now. */
function changesOf(input: ExtensionChanges, current: ExtensionFields | null) {
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
      "description",
      "categories.id",
      "variants.id",
      "variants.variant_extension.*",
      "product_extension.*",
      "variants.manage_inventory",
      "variants.allow_backorder",
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
    const currentMode = extension?.booking_mode ?? "none"
    const bookingMode = await bookingModeOf(
      container,
      input.booking_mode,
      currentMode,
      kind ?? extension?.kind ?? "physical"
    )
    const addons = await addonsToWrite(container, input.addons)
    const description = descriptionChanges(input.description_doc, {
      doc: extension?.description_doc ?? null,
      description: product.description ?? null,
    })
    // A short description without text is kept as none
    const summary =
      input.summary_doc === undefined
        ? undefined
        : input.summary_doc && hasText(input.summary_doc)
          ? input.summary_doc
          : null
    const { set, previous } = changesOf(
      {
        ...input,
        kind,
        addons,
        description_doc: description.doc,
        summary_doc: summary,
        booking_mode: bookingMode,
      },
      extension
    )
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
      ...(description.description === undefined ? {} : { description: description.description }),
      alignBookingVariants: bookingVariantsToAlign(
        bookingMode ?? currentMode,
        product.variants ?? []
      ),
    }
    return new StepResponse(plan)
  }
)
