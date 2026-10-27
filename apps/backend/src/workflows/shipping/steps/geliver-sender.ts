import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import {
  AddressIncomplete,
  geliverApi,
  geliverCredentialsOf,
  geliverSenderOf,
  sameSender,
} from "../../../lib/shipping/geliver"
import type { AddressRow, GeliverCredentials } from "../../../lib/shipping/geliver"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"

interface LocationRow {
  id: string
  name: string
  address?: AddressRow | null
}

/**
 * The Geliver sender address that stands for the warehouse (adr/0031): an
 * address of the account marked with the warehouse's id and saying what
 * the warehouse's address says, made when there is none (the address or
 * the account changed). Nothing is stored on our side. Undone by removing
 * an address it made.
 */
export const ensureGeliverSenderStep = createStep(
  "shipping-ensure-geliver-sender",
  async (input: { location_id: string | null }, { container }) => {
    const account = geliverCredentialsOf(
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .read("geliver")
    )
    if (!account) {
      throw new ValidationError("shipping.carrier_not_connected")
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [{ data: locations }, { data: stores }, store] = await Promise.all([
      query.graph({
        entity: "stock_location",
        fields: ["id", "name", "address.*"],
        filters: { id: input.location_id ?? "" },
      }),
      query.graph({ entity: "store", fields: ["name"] }),
      container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .getSection("store") as Promise<unknown> as Promise<StoreSettings>,
    ])
    const location = locations[0] as LocationRow | undefined
    if (!location) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "shipping.location_unknown")
    }
    if (!store.contact_email) {
      throw new ValidationError("shipping.sender_contact_missing", { field: "contact_email" })
    }
    let wanted
    try {
      wanted = geliverSenderOf(location, {
        name: (stores[0] as { name?: string } | undefined)?.name ?? location.name,
        email: store.contact_email,
      })
    } catch (error) {
      if (error instanceof AddressIncomplete) {
        throw new ValidationError("shipping.sender_address_incomplete", {
          field: `address.${error.field}`,
        })
      }
      throw error
    }
    const api = geliverApi()
    const existing = (await api.senderAddresses(account)).find((stored) =>
      sameSender(stored, wanted)
    )
    if (existing) {
      return new StepResponse({ sender_address_id: existing.id }, null)
    }
    const created = await api.createSenderAddress(account, wanted)
    return new StepResponse<
      { sender_address_id: string },
      { id: string; account: GeliverCredentials } | null
    >({ sender_address_id: created.id }, { id: created.id, account })
  },
  async (made) => {
    if (made) {
      await geliverApi().deleteAddress(made.account, made.id)
    }
  }
)
