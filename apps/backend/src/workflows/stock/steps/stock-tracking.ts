import type {
  IInventoryService,
  IProductModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import type { Link } from "@medusajs/framework/modules-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { planTracking } from "../tracking-plan"
import type { ItemToLink, SkuItem, TrackingInput, TrackingVariantRow } from "../tracking-plan"

const VARIANT_FIELDS = [
  "id",
  "title",
  "sku",
  "manage_inventory",
  "weight",
  "length",
  "height",
  "width",
  "origin_country",
  "hs_code",
  "mid_code",
  "material",
  "product.product_extension.kind",
  "product.product_extension.booking_mode",
  "inventory_items.inventory_item_id",
  "inventory_items.required_quantity",
  "inventory_items.inventory.location_levels.location_id",
  "inventory_items.inventory.location_levels.stocked_quantity",
  "inventory_items.inventory.location_levels.reserved_quantity",
]

// A level's quantities may come back as big-number values
const count = (value: unknown): number => Number(value)

/** Items carrying the SKUs of variants that have none linked, and whether one is linked elsewhere. */
async function itemsBySku(
  container: MedusaContainer,
  rows: TrackingVariantRow[]
): Promise<SkuItem[]> {
  const skus = rows.flatMap((row) =>
    (row.inventory_items ?? []).some(Boolean) || !row.sku?.trim() ? [] : [row.sku.trim()]
  )
  if (skus.length === 0) {
    return []
  }
  const inventory = container.resolve<IInventoryService>(Modules.INVENTORY)
  const items = await inventory.listInventoryItems({ sku: skus }, { select: ["id", "sku"] })
  if (items.length === 0) {
    return []
  }
  const ids = items.map((item) => item.id)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: links }, levels] = await Promise.all([
    query.graph({
      entity: "product_variant_inventory_item",
      fields: ["inventory_item_id"],
      filters: { inventory_item_id: ids },
    }),
    inventory.listInventoryLevels(
      { inventory_item_id: ids },
      { select: ["inventory_item_id", "location_id", "stocked_quantity", "reserved_quantity"] }
    ),
  ])
  const linked = new Set((links as { inventory_item_id: string }[]).map((l) => l.inventory_item_id))
  const held = new Set(
    levels.filter((level) => count(level.reserved_quantity) > 0).map((l) => l.inventory_item_id)
  )
  return items.map((item) => ({
    id: item.id,
    sku: item.sku ?? "",
    // One that orders hold is not taken over: its holds are some other sale's
    linked: linked.has(item.id) || held.has(item.id),
    levels: levels
      .filter((level) => level.inventory_item_id === item.id)
      .map((level) => ({
        location_id: level.location_id,
        stocked_quantity: count(level.stocked_quantity),
        reserved_quantity: count(level.reserved_quantity),
      })),
  }))
}

/** Reads the product's named variants, its default location and any items to link again; plans. */
export const planStockTrackingStep = createStep(
  "stock-plan-tracking",
  async (input: TrackingInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const ids = [...new Set(input.variants.map((each) => each.id))]
    const [{ data }, { data: stores }] = await Promise.all([
      query.graph({
        entity: "product_variant",
        fields: VARIANT_FIELDS,
        filters: { id: ids, product_id: input.product_id },
      }),
      query.graph({ entity: "store", fields: ["default_location_id"] }),
    ])
    const rows = data as TrackingVariantRow[]
    // Another product's variant, or none at all, is not this product's to change
    if (rows.length !== ids.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "stock_tracking.variant_unknown")
    }
    const locationId =
      (stores[0] as { default_location_id?: string | null } | undefined)?.default_location_id ??
      null
    const skuItems = input.tracked ? await itemsBySku(container, rows) : []
    return new StepResponse(planTracking(input, rows, locationId, skuItems))
  }
)

export interface LinkedItem {
  variant_id: string
  inventory_item_id: string
  /** Made here, not linked again: deleted if the change is undone. */
  created: boolean
}

const linkOf = ({ variant_id, inventory_item_id }: LinkedItem) => ({
  [Modules.PRODUCT]: { variant_id },
  [Modules.INVENTORY]: { inventory_item_id },
})

/**
 * Links each variant to its item: an unlinked one with its SKU, or one
 * made as Medusa makes its default item. Undone by dropping the links and
 * deleting the items made.
 */
export const linkVariantItemsStep = createStep(
  "stock-link-variant-items",
  async (items: ItemToLink[], { container }) => {
    if (items.length === 0) {
      return new StepResponse([] as LinkedItem[], [] as LinkedItem[])
    }
    const fresh = items.flatMap((each) =>
      each.create ? [{ variant_id: each.variant_id, create: each.create }] : []
    )
    const made =
      fresh.length > 0
        ? await container
            .resolve<IInventoryService>(Modules.INVENTORY)
            .createInventoryItems(fresh.map((each) => each.create))
        : []
    const madeFor = new Map(fresh.map((each, at) => [each.variant_id, made[at]?.id ?? ""]))
    const linked: LinkedItem[] = items.map((each) => ({
      variant_id: each.variant_id,
      inventory_item_id: each.relink ?? madeFor.get(each.variant_id) ?? "",
      created: each.relink === null,
    }))
    try {
      await container
        .resolve<Link>(ContainerRegistrationKeys.LINK)
        .create(linked.map((each) => ({ ...linkOf(each), data: { required_quantity: 1 } })))
    } catch (error) {
      // A step that throws gets no compensation: the items made here go with it
      if (made.length > 0) {
        await container
          .resolve<IInventoryService>(Modules.INVENTORY)
          .deleteInventoryItems(made.map((item) => item.id))
      }
      throw error
    }
    return new StepResponse(linked, linked)
  },
  async (linked, { container }) => {
    if (!linked || linked.length === 0) {
      return
    }
    await container.resolve<Link>(ContainerRegistrationKeys.LINK).dismiss(linked.map(linkOf))
    const made = linked.flatMap((each) => (each.created ? [each.inventory_item_id] : []))
    if (made.length > 0) {
      await container.resolve<IInventoryService>(Modules.INVENTORY).deleteInventoryItems(made)
    }
  }
)

/**
 * Sets the stock flag on the variants straight on the product module: the
 * core variant workflow drops an item's link when tracking goes off, and
 * here the item and its levels stay for turning it back on.
 */
export const setManageInventoryStep = createStep(
  "stock-set-manage-inventory",
  async (input: { ids: string[]; tracked: boolean }, { container }) => {
    if (input.ids.length === 0) {
      return new StepResponse(undefined, undefined)
    }
    await container
      .resolve<IProductModuleService>(Modules.PRODUCT)
      .updateProductVariants({ id: input.ids }, { manage_inventory: input.tracked })
    return new StepResponse(undefined, input)
  },
  async (undo, { container }) => {
    if (!undo || undo.ids.length === 0) {
      return
    }
    await container
      .resolve<IProductModuleService>(Modules.PRODUCT)
      .updateProductVariants({ id: undo.ids }, { manage_inventory: !undo.tracked })
  }
)
