import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { filledSender } from "../../../lib/shipping/fill"
import {
  AddressIncomplete,
  geliverApi,
  geliverCredentialsOf,
  geliverSenderOf,
  sameSender,
} from "../../../lib/shipping/geliver"
import type { AddressRow, GeliverSenderInput } from "../../../lib/shipping/geliver"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { placeFactsOf } from "../place-facts"

interface LocationRow {
  id: string
  name: string
  address?: AddressRow | null
}

// The part the warehouse is missing, as the shop's error names it (and where to fill it)
const SENDER_KEYS: Readonly<Record<string, string>> = {
  location: "shipping.sender_location_missing",
  email: "shipping.sender_contact_missing",
  phone: "shipping.sender_phone_missing",
  address_1: "shipping.sender_address_missing",
  city: "shipping.sender_place_missing",
  province: "shipping.sender_place_missing",
  country_code: "shipping.sender_place_missing",
  postal_code: "shipping.sender_postal_missing",
}

/**
 * The warehouse the parcel leaves from: the option's, else the shop's
 * default, else its only one; null when none can be told.
 */
async function senderLocationOf(
  container: Pick<MedusaContainer, "resolve">,
  locationId: string | null
): Promise<LocationRow | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fields = ["id", "name", "address.*"]
  if (!locationId) {
    const { data: stores } = await query.graph({ entity: "store", fields: ["default_location_id"] })
    locationId =
      (stores[0] as { default_location_id?: string | null } | undefined)?.default_location_id ??
      null
  }
  if (locationId) {
    const { data } = await query.graph({
      entity: "stock_location",
      fields,
      filters: { id: locationId },
    })
    if (data[0]) {
      return data[0]
    }
  }
  const { data: all } = await query.graph({
    entity: "stock_location",
    fields,
    pagination: { take: 2 },
  })
  return all.length === 1 ? (all[0] as LocationRow) : null
}

/**
 * The Geliver sender address that stands for the warehouse (adr/0031): an
 * address of the account marked with the warehouse's id and saying what
 * the warehouse's address says, made when there is none (the address or
 * the account changed). The warehouse's gaps are filled first: its phone
 * from the shop's contact phone, its postcode from the address data
 * (adr/0054, 2026-11-05 addendum). A warehouse still incomplete leaves the
 * sender to Geliver: the account's default sender address, when it has
 * one (Geliver's SDK: no sender named, the default is used). Refused only
 * when Geliver has no sender at all, naming the part and its settings
 * page. Nothing is stored on our side. Undone by removing an address it made.
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
    const [location, { data: stores }, store] = await Promise.all([
      senderLocationOf(container, input.location_id),
      query.graph({ entity: "store", fields: ["name"] }),
      container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .getSection("store") as Promise<unknown> as Promise<StoreSettings>,
    ])
    let wanted: GeliverSenderInput | null = null
    let missing = "location"
    if (location) {
      const sender = filledSender(location.address, {
        phone: store.contact_phone,
        place: await placeFactsOf(container, location.address),
      })
      try {
        wanted = geliverSenderOf(
          { ...location, address: sender.address },
          {
            name: (stores[0] as { name?: string } | undefined)?.name ?? location.name,
            email: store.contact_email ?? "",
          }
        )
        missing = wanted.email ? "" : "email"
      } catch (error) {
        if (!(error instanceof AddressIncomplete)) {
          throw error
        }
        missing = error.field
      }
    }
    const api = geliverApi()
    const stored = await api.senderAddresses(account)
    if (wanted && !missing) {
      const complete = wanted
      const existing = stored.find((each) => sameSender(each, complete))
      if (existing) {
        return new StepResponse({ sender_address_id: existing.id }, null as string | null)
      }
      const created = await api.createSenderAddress(account, complete)
      // Only the id is kept for undoing: the account is read again then (docs/04: no secret in step data)
      return new StepResponse({ sender_address_id: created.id }, created.id)
    }
    if (stored.length > 0) {
      // The part, never its value: the shop sees which one in the warehouse's settings
      logger.info({ event: "shipping.geliver_default_sender", missing })
      return new StepResponse({ sender_address_id: null as string | null }, null as string | null)
    }
    throw new ValidationError(SENDER_KEYS[missing] ?? "shipping.sender_address_incomplete", {
      field: missing === "email" ? "contact_email" : `address.${missing}`,
    })
  },
  async (madeId, { container }) => {
    if (!madeId) {
      return
    }
    const account = geliverCredentialsOf(
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .read("geliver")
    )
    if (account) {
      await geliverApi().deleteAddress(account, madeId)
    }
  }
)
