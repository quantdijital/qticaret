import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStockLocationsWorkflow,
  updateStoresWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { addressValues, setLocationAddressStep } from "./steps/set-location-address"
import type { LocationAddressInput } from "./steps/set-location-address"

/**
 * Warehouses (F3.7) as the panel keeps them: one call each, every part
 * undone if a later one fails. A warehouse sells to the shop's channel
 * (checkout reserves only from locations linked to the cart's channel).
 */

export interface CreateWarehouseInput {
  name: string
  address: LocationAddressInput
}

export interface UpdateWarehouseInput {
  id: string
  name: string
  /** None keeps the address (a foreign one the panel cannot edit). */
  address?: LocationAddressInput | undefined
}

interface StoreRow {
  id: string
  default_sales_channel_id?: string | null
}

interface LocationRow {
  id: string
  sales_channels?: ({ id: string } | null)[] | null
}

// The shop's channel, unless the location sells to it already
const missingChannel = (store: StoreRow | undefined, location: LocationRow | undefined) => {
  const channelId = store?.default_sales_channel_id
  const isLinked = (location?.sales_channels ?? []).some((channel) => channel?.id === channelId)
  return channelId && !isLinked ? [channelId] : []
}

export const createWarehouseWorkflow = createWorkflow(
  "stock-create-warehouse",
  (input: CreateWarehouseInput) => {
    const { data: stores } = useQueryGraphStep({
      entity: "store",
      fields: ["id", "default_sales_channel_id"],
    })
    const created = createStockLocationsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        locations: [{ name: input.name, address: addressValues(input.address) }],
      })),
    })
    const link = transform({ created, stores }, ({ created, stores }) => ({
      id: created[0]?.id ?? "",
      add: missingChannel(stores[0] as StoreRow | undefined, undefined),
    }))
    when({ link }, ({ link }) => link.add.length > 0).then(() => {
      linkSalesChannelsToStockLocationWorkflow.runAsStep({ input: link })
    })
    return new WorkflowResponse(transform({ created }, ({ created }) => ({ id: created[0]?.id })))
  }
)

export const updateWarehouseWorkflow = createWorkflow(
  "stock-update-warehouse",
  (input: UpdateWarehouseInput) => {
    updateStockLocationsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        selector: { id: input.id },
        update: { name: input.name },
      })),
    })
    setLocationAddressStep(
      transform({ input }, ({ input }) => ({ location_id: input.id, address: input.address }))
    )
    return new WorkflowResponse(transform({ input }, ({ input }) => ({ id: input.id })))
  }
)

/**
 * Makes a warehouse the store's default: new products' stock and the
 * stock page write there, so it sells to the shop's channel first.
 */
export const makeDefaultWarehouseWorkflow = createWorkflow(
  "stock-make-default-warehouse",
  (input: { id: string }) => {
    const { data: stores } = useQueryGraphStep({
      entity: "store",
      fields: ["id", "default_sales_channel_id"],
    }).config({ name: "get-store" })
    const { data: locations } = useQueryGraphStep({
      entity: "stock_location",
      fields: ["id", "sales_channels.id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-location" })
    const link = transform({ input, stores, locations }, ({ input, stores, locations }) => ({
      id: input.id,
      add: missingChannel(stores[0] as StoreRow | undefined, locations[0] as LocationRow),
    }))
    when({ link }, ({ link }) => link.add.length > 0).then(() => {
      linkSalesChannelsToStockLocationWorkflow.runAsStep({ input: link })
    })
    updateStoresWorkflow.runAsStep({
      input: transform({ input, stores }, ({ input, stores }) => ({
        selector: { id: (stores[0] as StoreRow | undefined)?.id ?? "" },
        update: { default_location_id: input.id },
      })),
    })
    return new WorkflowResponse(transform({ input }, ({ input }) => ({ id: input.id })))
  }
)
