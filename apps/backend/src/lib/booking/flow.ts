import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import { SECTIONS } from "../../modules/platform-settings/sections"
import type { BookingFlowSettings, StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Which of a dated order's detailed flows the shop runs (adr/0076 Ek basit
 * yol). The shop's choice counts only while dated selling is on: with
 * `catalog.booking` off the defaults (every flow on) are read, so a shop
 * that sells no dated product meets nothing new.
 */
export async function bookingFlow(container: Container): Promise<BookingFlowSettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  if (!(await settings.isFeatureEnabled(CATALOG_BOOKING))) {
    return SECTIONS.booking.defaults
  }
  return (await settings.getSection("booking")) as unknown as BookingFlowSettings
}

/** The refusal of a shopper's online cancel while the shop takes cancels by phone or e-mail. */
export const CANCEL_BY_CONTACT = "booking.cancel_by_contact"

/** How the shopper reaches the shop for a cancel: its note (null: the default) and contacts. */
export interface CancelContact {
  note: string | null
  phone: string | null
  email: string | null
}

export async function cancelContactOf(
  container: Container,
  flow: BookingFlowSettings
): Promise<CancelContact> {
  const store = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  return { note: flow.cancel_off_note, phone: store.contact_phone, email: store.contact_email }
}

interface CancelViewLike {
  cancelled: boolean
  cancellable: boolean
  refusal: string | null
}

/**
 * A shopper's departures while online cancel is off: none cancellable,
 * each live one refused with `booking.cancel_by_contact`, with how to
 * reach the shop. A departure already cancelled stays as it was.
 */
export function byContact<T extends { departures: CancelViewLike[] }>(
  view: T,
  contact: CancelContact
): T & { contact: CancelContact } {
  const departures = view.departures.map((departure) =>
    departure.cancelled
      ? departure
      : { ...departure, cancellable: false, refusal: CANCEL_BY_CONTACT }
  )
  return { ...view, departures, contact }
}
