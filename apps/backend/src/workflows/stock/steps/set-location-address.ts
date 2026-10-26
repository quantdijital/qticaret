import type { StockLocationAddressInput } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

/** A warehouse's address as Medusa stores it; F1.4: il in `province`, ilçe in `city`, mahalle in `address_2`. */
export interface LocationAddressInput {
  address_1: string
  address_2?: string | null | undefined
  city?: string | null | undefined
  province?: string | null | undefined
  postal_code?: string | null | undefined
  phone?: string | null | undefined
  country_code: string
}

const OPTIONAL_FIELDS = ["address_2", "city", "province", "postal_code", "phone"] as const

/** What Medusa writes: a field left out keeps what is stored, null clears it. */
export function addressValues(address: LocationAddressInput): StockLocationAddressInput {
  const values: StockLocationAddressInput = {
    address_1: address.address_1,
    country_code: address.country_code,
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = address[field]
    if (value !== undefined) {
      values[field] = value
    }
  }
  return values
}

const FIELDS = [
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "phone",
  "country_code",
] as const

type Undo =
  | { kind: "updated"; addressId: string; previous: LocationAddressInput }
  | { kind: "created"; addressId: string }

/**
 * Writes a warehouse's address. Medusa's update workflow (2.21.2) changes
 * an address in place but cannot give one to a location that has none: it
 * creates the row and drops the link (and `address_id` is not written on
 * an update). The module links a new address given whole, so that is how
 * one is added here; an existing one is changed. Undone by putting back
 * the old values, or by removing the new address (the location then reads
 * as having none).
 */
export const setLocationAddressStep = createStep(
  "stock-set-location-address",
  async (
    input: { location_id: string; address?: LocationAddressInput | undefined },
    { container }
  ) => {
    // No address given: the stored one stays
    if (!input.address) {
      return new StepResponse<void, Undo | undefined>(undefined, undefined)
    }
    const locations = container.resolve(Modules.STOCK_LOCATION)
    const [location] = await locations.listStockLocations(
      { id: input.location_id },
      { relations: ["address"], take: 1 }
    )
    if (!location) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "stock.location_unknown")
    }
    const current = location.address
    if (current?.id) {
      const previous = Object.fromEntries(
        FIELDS.map((field) => [field, current[field] ?? null])
      ) as unknown as LocationAddressInput
      await locations.upsertStockLocationAddresses([
        { id: current.id, ...addressValues(input.address) },
      ])
      return new StepResponse<void, Undo | undefined>(undefined, {
        kind: "updated",
        addressId: current.id,
        previous,
      })
    }
    // The module creates the address and links it when given whole
    await locations.updateStockLocations(input.location_id, {
      address: addressValues(input.address),
    })
    const [linked] = await locations.listStockLocations(
      { id: input.location_id },
      { relations: ["address"], take: 1 }
    )
    const created = linked?.address
    if (!created?.id) {
      throw new Error("the stock location module did not link the new address")
    }
    return new StepResponse<void, Undo | undefined>(undefined, {
      kind: "created",
      addressId: created.id,
    })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const locations = container.resolve(Modules.STOCK_LOCATION)
    if (undo.kind === "updated") {
      await locations.upsertStockLocationAddresses([
        { id: undo.addressId, ...addressValues(undo.previous) },
      ])
      return
    }
    await locations.deleteStockLocationAddresses([undo.addressId])
  }
)
