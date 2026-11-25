import { ConflictError, ValidationError } from "../../lib/errors"

/**
 * Turning a variant's stock tracking on or off after it was made (the
 * owner, 2026-11-26: "varyantlı üründe stok miktarını değiştiremiyor
 * muyuz sonradan?"). Pure: what the workflow writes, from what it read.
 */

export interface TrackingInput {
  product_id: string
  /** On: counted, sold while on the shelf. Off: always sold (adr/0018 Ek 2026-11-20). */
  tracked: boolean
  /** The variants to change; `quantity` is the count at the default location, on only. */
  variants: { id: string; quantity?: number | undefined }[]
  actor_id: string | null
}

interface LevelRow {
  location_id: string
  stocked_quantity?: number | null
  reserved_quantity?: number | null
}

export interface TrackingVariantRow {
  id: string
  title?: string | null
  sku?: string | null
  manage_inventory?: boolean | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  origin_country?: string | null
  hs_code?: string | null
  mid_code?: string | null
  material?: string | null
  product?: {
    product_extension?: { kind?: string | null; booking_mode?: string | null } | null
  } | null
  inventory_items?:
    | ({
        inventory_item_id: string
        required_quantity?: number | null
        inventory?: { location_levels?: (LevelRow | null)[] | null } | null
      } | null)[]
    | null
}

/**
 * An item with a variant's SKU, found because the variant has none linked:
 * unlinked (Medusa's own "off" drops the link), it is linked again with its
 * levels; linked to another variant, the SKU is taken and a new item goes
 * without one (the SKU is unique among items).
 */
export interface SkuItem {
  id: string
  sku: string
  linked: boolean
  levels: LevelRow[]
}

/** A new item as Medusa's own default one is made: from the variant's fields. */
export interface NewItem {
  sku: string | null
  title: string
  description: string
  requires_shipping: boolean
  weight?: number
  length?: number
  height?: number
  width?: number
  origin_country?: string
  hs_code?: string
  mid_code?: string
  material?: string
}

export interface ItemToLink {
  variant_id: string
  /** An unlinked item with the variant's SKU, linked again with its levels. */
  relink: string | null
  /** Otherwise a new one. */
  create: NewItem | null
  /** The count a new item's level starts with. */
  quantity: number
}

export interface LevelWrite {
  inventory_item_id: string
  location_id: string
  stocked_quantity: number
}

export interface TrackingPlan {
  /** Items to link or make, each then given a level at the default location. */
  link: ItemToLink[]
  /** Levels of linked items: missing ones made, a typed count written. */
  create: LevelWrite[]
  update: LevelWrite[]
  location_id: string | null
  /** Variants whose flag changes, with the value they had. */
  flip: { id: string; manage_inventory: boolean }[]
  tracked: boolean
}

const linksOf = (variant: TrackingVariantRow) =>
  (variant.inventory_items ?? []).flatMap((link) =>
    link ? [{ id: link.inventory_item_id, link }] : []
  )

const DIMENSIONS = [
  "weight",
  "length",
  "height",
  "width",
  "origin_country",
  "hs_code",
  "mid_code",
  "material",
] as const

function newItem(variant: TrackingVariantRow, sku: string | null): NewItem {
  const kind = variant.product?.product_extension?.kind ?? "physical"
  const title = variant.title ?? ""
  const extra = Object.fromEntries(
    DIMENSIONS.flatMap((field) => {
      const value = variant[field]
      return value === null || value === undefined ? [] : [[field, value]]
    })
  )
  // A digital or service product's item needs no shipping (F3.2, align-shipping.ts)
  return {
    ...extra,
    sku,
    title,
    description: title,
    requires_shipping: kind === "physical",
  }
}

const reservedOn = (variant: TrackingVariantRow) =>
  linksOf(variant).some(({ link }) =>
    (link.inventory?.location_levels ?? []).some((level) => (level?.reserved_quantity ?? 0) > 0)
  )

function planOff(rows: TrackingVariantRow[]): TrackingPlan {
  // What open orders hold stays on the item; untracked, nothing would let it go (adr/0018)
  if (rows.some(reservedOn)) {
    throw new ConflictError("stock_tracking.reserved")
  }
  return {
    link: [],
    create: [],
    update: [],
    location_id: null,
    flip: rows
      .filter((row) => row.manage_inventory === true)
      .map((row) => ({ id: row.id, manage_inventory: true })),
    tracked: false,
  }
}

/**
 * On: every variant gets an item (its own kept one, an unlinked one with
 * its SKU linked again, or a new one) and a level at the shop's default
 * location; a typed count is written there. Off: only the flag, the item
 * and its levels kept for turning it back on.
 */
export function planTracking(
  input: TrackingInput,
  rows: TrackingVariantRow[],
  locationId: string | null,
  items: SkuItem[]
): TrackingPlan {
  if (!input.tracked) {
    return planOff(rows)
  }
  // A dated product's places are the booking module's (adr/0076 §3)
  if (rows.some((row) => row.product?.product_extension?.booking_mode === "departure")) {
    throw new ValidationError("stock_tracking.dated")
  }
  if (!locationId) {
    throw new ValidationError("stock_tracking.no_location")
  }
  const quantities = new Map(input.variants.map((each) => [each.id, each.quantity]))
  const bySku = new Map(items.map((item) => [item.sku, item]))
  const plan: TrackingPlan = {
    link: [],
    create: [],
    update: [],
    location_id: locationId,
    flip: rows
      .filter((row) => row.manage_inventory !== true)
      .map((row) => ({ id: row.id, manage_inventory: false })),
    tracked: true,
  }
  // The count each item was given: two variants on one item must agree
  const seen = new Map<string, number | undefined>()
  // An unlinked item goes back to one variant only
  const relinked = new Set<string>()
  const level = (itemId: string, levels: (LevelRow | null)[], quantity: number | undefined) => {
    if (seen.has(itemId)) {
      const before = seen.get(itemId)
      if (before !== undefined && quantity !== undefined && before !== quantity) {
        throw new ValidationError("stock_tracking.shared_count", { field: "quantity" })
      }
      return
    }
    seen.set(itemId, quantity)
    const found = levels.find((each) => each?.location_id === locationId)
    const key = { inventory_item_id: itemId, location_id: locationId }
    if (!found) {
      plan.create.push({ ...key, stocked_quantity: quantity ?? 0 })
    } else if (quantity !== undefined && (found.stocked_quantity ?? 0) !== quantity) {
      plan.update.push({ ...key, stocked_quantity: quantity })
    }
  }
  for (const row of rows) {
    const quantity = quantities.get(row.id)
    const linked = linksOf(row)
    // A kit's count is its components': this change does not write it
    const kit = linked.length > 1 || linked.some(({ link }) => (link.required_quantity ?? 1) !== 1)
    if (kit && quantity !== undefined) {
      throw new ValidationError("stock_tracking.kit", { field: "quantity" })
    }
    if (linked.length > 0) {
      for (const { id, link } of linked) {
        level(id, link.inventory?.location_levels ?? [], quantity)
      }
      continue
    }
    const sku = row.sku?.trim() ? row.sku.trim() : null
    const known = sku ? bySku.get(sku) : undefined
    if (known && !known.linked && !relinked.has(known.id)) {
      relinked.add(known.id)
      plan.link.push({ variant_id: row.id, relink: known.id, create: null, quantity: 0 })
      level(known.id, known.levels, quantity)
      continue
    }
    plan.link.push({
      variant_id: row.id,
      relink: null,
      create: newItem(row, known ? null : sku),
      quantity: quantity ?? 0,
    })
  }
  return plan
}
