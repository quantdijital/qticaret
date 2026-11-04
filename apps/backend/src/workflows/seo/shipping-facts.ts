import { toMedusaAmount } from "../../lib/money"
import { defaultParcelOf, parcelOf } from "../../lib/shipping/parcel"
import type { Parcel, ParcelUnits } from "../../lib/shipping/parcel"
import { tablePrice } from "../../lib/shipping/rates"
import type { ShippingSettings } from "../../modules/platform-settings/sections"

/** The shop's shipping rules and units, for each offer's `shippingDetails` (F7.8). */
export interface ShippingFacts {
  settings: ShippingSettings
  units: ParcelUnits
  /**
   * Shoppers can pick an option priced by the table: only then is its rate
   * one checkout charges (security review 2026-10-28).
   */
  table_offered: boolean
}

/** A variant's own weight and measures, none of them required (adr/0054). */
export interface MeasuredVariant {
  id: string
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
}

/**
 * One unit's parcel, as checkout would make it: without measures (or with
 * one that cannot be a measure), the shop's default parcel (adr/0054).
 */
export function unitParcelOf(variant: MeasuredVariant, shipping: ShippingFacts): Parcel {
  return parcelOf(
    [
      {
        title: variant.id,
        quantity: 1,
        weight: variant.weight ?? null,
        length: variant.length ?? null,
        width: variant.width ?? null,
        height: variant.height ?? null,
      },
    ],
    shipping.units,
    defaultParcelOf(shipping.settings.default_parcel, shipping.units)
  )
}

/**
 * What the shop's table charges to ship the parcel, in lira; null when no
 * option shoppers see is priced by it, or past the table's bands.
 */
export function shippingRateOf(parcel: Parcel | null, shipping: ShippingFacts): number | null {
  if (!parcel || !shipping.table_offered) {
    return null
  }
  const rate = tablePrice(
    shipping.settings.rate_table,
    shipping.settings.over_desi_price,
    parcel.desi
  )
  return rate === null ? null : Number(toMedusaAmount(rate))
}
