import { z } from "@medusajs/framework/zod"
import type { GeliverCall } from "./client"
import { geliverShipment, geliverTransaction } from "./schemas"
import type { GeliverOffer, GeliverShipment } from "./schemas"
import type { GeliverCredentials } from "./types"

/**
 * Geliver's shipment calls (adr/0031): create one, wait for its offers,
 * accept one (which buys the label), read it again, cancel it. Creating
 * and accepting are never repeated on a failure whose outcome is unknown:
 * the shipment is read again instead.
 */

/** A recipient as Geliver takes it inline: a Turkish address with a phone. */
export interface GeliverRecipient {
  name: string
  email?: string | undefined
  phone: string
  address1: string
  countryCode: "TR"
  cityName: string
  cityCode: string
  districtName: string
  zip?: string | undefined
}

export interface GeliverShipmentInput {
  senderAddressID: string
  recipientAddress: GeliverRecipient
  /** Centimetres and kilograms, as decimal text. */
  length: string
  width: string
  height: string
  weight: string
  order: { orderNumber: string; totalAmount: string; totalAmountCurrency: "TRY" }
  /** The courier collects `order.totalAmount` at the door (adr/0029). */
  productPaymentOnDelivery?: boolean
  test?: boolean
}

export interface OfferWait {
  intervalMs: number
  timeoutMs: number
  sleep: (ms: number) => Promise<void>
  now: () => number
}

const DEFAULT_WAIT: OfferWait = {
  intervalMs: 1_000,
  timeoutMs: 20_000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
}

/** Every offer gathered: Geliver is done asking the carriers. */
export const offersComplete = (shipment: GeliverShipment): boolean =>
  (shipment.offers?.percentageCompleted ?? 0) >= 100

export const offersOf = (shipment: GeliverShipment): GeliverOffer[] => {
  const list = shipment.offers?.list ?? []
  const cheapest = shipment.offers?.cheapest
  return cheapest && !list.some((offer) => offer.id === cheapest.id) ? [cheapest, ...list] : list
}

export function shipmentCalls(call: GeliverCall) {
  const createShipment = (credentials: GeliverCredentials, input: GeliverShipmentInput) =>
    call(credentials, { method: "POST", path: "/shipments", json: input }, geliverShipment)

  const shipment = (credentials: GeliverCredentials, id: string) =>
    call(credentials, { method: "GET", path: ["shipments", id] }, geliverShipment)

  /** The shipment once its offers are in, or as it stands when the wait runs out. */
  async function waitForOffers(
    credentials: GeliverCredentials,
    created: GeliverShipment,
    wait: Partial<OfferWait> = {}
  ): Promise<GeliverShipment> {
    const { intervalMs, timeoutMs, sleep, now } = { ...DEFAULT_WAIT, ...wait }
    // By the clock: a slow read counts against the wait as much as the pause
    const deadline = now() + timeoutMs
    let current = created
    while (!offersComplete(current) && now() < deadline) {
      await sleep(intervalMs)
      current = await shipment(credentials, created.id)
    }
    return current
  }

  /** Buys the label with the offer; the shipment comes back with it. */
  const acceptOffer = (credentials: GeliverCredentials, offerId: string) =>
    call(
      credentials,
      { method: "POST", path: "/transactions", json: { offerID: offerId } },
      geliverTransaction
    )

  const cancelShipment = async (credentials: GeliverCredentials, id: string): Promise<void> => {
    await call(credentials, { method: "DELETE", path: ["shipments", id] }, z.unknown())
  }

  /**
   * A return of a delivered shipment, its label bought at once (adr/0032):
   * the shopper hands the parcel over with its code. Not repeated on a
   * failure whose outcome is unknown.
   */
  const createReturn = (credentials: GeliverCredentials, shipmentId: string) =>
    call(
      credentials,
      {
        method: "POST",
        path: ["shipments", shipmentId],
        json: { isReturn: true, willAccept: true, count: 1 },
      },
      geliverTransaction
    )

  return { createShipment, shipment, waitForOffers, acceptOffer, cancelShipment, createReturn }
}
