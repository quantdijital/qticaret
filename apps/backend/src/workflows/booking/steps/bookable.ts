import type { Link } from "@medusajs/framework/modules-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { DEFAULT_TRAVELER_FIELDS } from "../../../lib/booking/settings"
import type { BookableSettingsType } from "../../../lib/booking/settings"
import { BOOKING_MODULE } from "../../../modules/booking"
import type BookingModuleService from "../../../modules/booking/service"
import { checkVariants, datedProduct } from "../product"
import type { BookableRow } from "../product"

type Undo =
  | { created: string; productId: string }
  | { updated: string; previous: Partial<BookableRow> }
  | null

const SETTING_KEYS = [
  "cutoff_hours",
  "hold_minutes",
  "max_units_per_cart",
  "min_participants",
  "traveler_fields",
  "cancellation_tiers",
  "pax_by_variant",
  "timezone",
  "reminder_days",
  "sale_mode",
] as const

// The JSON columns are typed as objects; the tiers are a list (lib/booking/settings)
type BookableWrite = Parameters<BookingModuleService["createBookables"]>[0][number] & {
  id?: string
}

const linkOf = (productId: string, bookableId: string) => ({
  [Modules.PRODUCT]: { product_id: productId },
  [BOOKING_MODULE]: { bookable_id: bookableId },
})

/** A settings row from the defaults and what the save sent, linked to the product. */
async function makeBookable(
  container: MedusaContainer,
  productId: string,
  set: Record<string, unknown>
): Promise<{ id: string }> {
  const made = await container.resolve<BookingModuleService>(BOOKING_MODULE).createBookables({
    product_id: productId,
    mode: "departure",
    traveler_fields: DEFAULT_TRAVELER_FIELDS,
    cancellation_tiers: [],
    pax_by_variant: {},
    ...set,
  } as unknown as BookableWrite)
  await container.resolve<Link>(ContainerRegistrationKeys.LINK).create(linkOf(productId, made.id))
  return made
}

/**
 * A dated product's settings made (with the link to the product) or
 * changed; fields left out keep their values, a new row starts from the
 * defaults. Undone by removing what it made or writing back what it
 * changed.
 */
export const setBookableStep = createStep(
  "booking-set-bookable",
  async (input: { product_id: string; settings: BookableSettingsType }, { container }) => {
    const product = await datedProduct(container, input.product_id)
    checkVariants(product, Object.keys(input.settings.pax_by_variant ?? {}), "pax_by_variant")
    const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
    const set = Object.fromEntries(
      SETTING_KEYS.filter((key) => input.settings[key] !== undefined).map((key) => [
        key,
        input.settings[key],
      ])
    )
    if (!product.bookable) {
      const made = await makeBookable(container, product.id, set)
      return new StepResponse(made.id, { created: made.id, productId: product.id })
    }
    const current = product.bookable
    if (Object.keys(set).length === 0) {
      return new StepResponse(current.id, null as Undo)
    }
    const previous = Object.fromEntries(
      Object.keys(set).map((key) => [key, current[key as keyof BookableRow]])
    ) as Partial<BookableRow>
    await service.updateBookables({ id: current.id, ...set } as unknown as BookableWrite)
    return new StepResponse(current.id, { updated: current.id, previous })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await undoBookable(container, undo)
  }
)

async function undoBookable(container: MedusaContainer, undo: NonNullable<Undo>) {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  if ("created" in undo) {
    await container
      .resolve<Link>(ContainerRegistrationKeys.LINK)
      .dismiss(linkOf(undo.productId, undo.created))
    await service.deleteBookables(undo.created)
    return
  }
  await service.updateBookables({ id: undo.updated, ...undo.previous } as unknown as BookableWrite)
}

/** The product's settings row, made with the defaults when it has none; for new slots. */
export const ensureBookableStep = createStep(
  "booking-ensure-bookable",
  async (input: { product_id: string }, { container }) => {
    const product = await datedProduct(container, input.product_id)
    if (product.bookable) {
      return new StepResponse({ id: product.bookable.id, variantIds: product.variantIds }, null)
    }
    const made = await makeBookable(container, product.id, {})
    return new StepResponse(
      { id: made.id, variantIds: product.variantIds },
      {
        created: made.id,
        productId: product.id,
      }
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await undoBookable(container, undo)
    }
  }
)
