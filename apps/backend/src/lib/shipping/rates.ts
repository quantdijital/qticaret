import { kurus } from "../money"
import type { Kurus } from "../money"
import type { ShippingRate } from "../../modules/platform-settings/sections"

/**
 * The shop's price for a parcel of `desi` from its table (F7.8): the
 * first band that holds it, or the last band's price plus the per-desi
 * price for every (started) desi past it. Null when the table is empty,
 * or the parcel is past the last band with no price for that.
 */
export function tablePrice(
  table: readonly ShippingRate[],
  overDesiPrice: number,
  desi: number
): Kurus | null {
  const band = table.find((row) => desi <= row.max_desi + 1e-9)
  if (band) {
    return kurus(band.price)
  }
  const last = table.at(-1)
  if (!last || overDesiPrice <= 0) {
    return null
  }
  return kurus(last.price + Math.ceil(desi - last.max_desi - 1e-9) * overDesiPrice)
}
