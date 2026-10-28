import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { normalizeTrPhone } from "../../lib/tr/phone"
import { rejectRequest } from "../http/reject"
import { TR_ADDRESS_MODULE } from "../../modules/tr-address"
import type TrAddressModuleService from "../../modules/tr-address/service"
import type { AddressFields } from "../../modules/tr-address/validation"
import { isTrAddress, validateTrAddress } from "../../modules/tr-address/validation"

/** Where an address sits in the validated body; ROOT means the body is the address. */
export const ROOT = "$root"
type AddressKey = typeof ROOT | "shipping_address" | "billing_address" | "address"
type ExistingAddresses = Partial<Record<AddressKey, AddressFields | null>>

export const ADDRESS_FIELDS = [
  "country_code",
  "province",
  "city",
  "address_2",
  "postal_code",
  "phone",
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Rejects Turkish addresses that contradict the tr-address reference data
 * (F1.4) and normalizes valid phone numbers to E.164. Runs after Medusa's
 * own body validation, so it reads and updates `req.validatedBody`. Partial
 * updates are checked merged over the stored address.
 */
export function validateTrAddresses(
  keys: AddressKey[],
  loadExisting?: (req: MedusaRequest) => Promise<ExistingAddresses>
) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      const body = req.validatedBody
      if (!isRecord(body)) {
        next()
        return
      }
      // Most cart updates carry no address; skip the lookups for them
      if (!keys.some((key) => isRecord(key === ROOT ? body : body[key]))) {
        next()
        return
      }
      const service = req.scope.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
      const existing = loadExisting ? await loadExisting(req) : {}

      const issues: { field: string; code: string }[] = []
      const normalize: (() => void)[] = []
      for (const key of keys) {
        const incoming = key === ROOT ? body : body[key]
        if (!isRecord(incoming)) {
          continue
        }
        const merged: AddressFields = { ...(existing[key] ?? {}), ...pickAddress(incoming) }
        for (const issue of await validateTrAddress(service, merged)) {
          issues.push({
            field: key === ROOT ? issue.field : `${key}.${issue.field}`,
            code: issue.code,
          })
        }
        const phone =
          typeof incoming["phone"] === "string" ? normalizeTrPhone(incoming["phone"]) : null
        if (phone && isTrAddress(merged)) {
          normalize.push(() => (incoming["phone"] = phone))
        }
      }

      if (issues.length > 0) {
        rejectRequest(
          req,
          res,
          400,
          {
            type: "invalid_data",
            // One issue names itself; several get the general sentence (keys, adr/0021)
            message: issues.length === 1 && issues[0] ? issues[0].code : "tr_address.invalid",
            issues,
          },
          "tr_address_invalid"
        )
        return
      }
      normalize.forEach((apply) => {
        apply()
      })
      next()
    } catch (error) {
      next(error)
    }
  }
}

function pickAddress(value: Record<string, unknown>): AddressFields {
  const address: Record<string, string | null> = {}
  for (const field of ADDRESS_FIELDS) {
    const fieldValue = value[field]
    if (typeof fieldValue === "string" || fieldValue === null) {
      address[field] = fieldValue
    }
  }
  return address
}

/** Stored address of the signed-in customer, for partial updates. */
export async function existingCustomerAddress(req: MedusaRequest): Promise<ExistingAddresses> {
  const { auth_context: auth } = req as AuthenticatedMedusaRequest
  const addressId = req.params["address_id"]
  if (!addressId) {
    return {}
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer_address",
    fields: [...ADDRESS_FIELDS],
    filters: { id: addressId, customer_id: auth.actor_id },
  })
  return { [ROOT]: data[0] ?? null }
}

/** Stored cart addresses, for partial updates. */
export async function existingCartAddresses(req: MedusaRequest): Promise<ExistingAddresses> {
  const cartId = req.params["id"]
  if (!cartId) {
    return {}
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      ...ADDRESS_FIELDS.map((field) => `shipping_address.${field}`),
      ...ADDRESS_FIELDS.map((field) => `billing_address.${field}`),
    ],
    filters: { id: cartId },
  })
  return {
    shipping_address: data[0]?.shipping_address ?? null,
    billing_address: data[0]?.billing_address ?? null,
  }
}

/** An order's stored addresses (F7.12, adr/0033), for partial updates. */
export async function existingOrderAddresses(req: MedusaRequest): Promise<ExistingAddresses> {
  const orderId = req.params["id"]
  if (!orderId) {
    return {}
  }
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      ...ADDRESS_FIELDS.map((field) => `shipping_address.${field}`),
      ...ADDRESS_FIELDS.map((field) => `billing_address.${field}`),
    ],
    filters: { id: orderId },
  })
  return {
    shipping_address: data[0]?.shipping_address ?? null,
    billing_address: data[0]?.billing_address ?? null,
  }
}

/** A warehouse's stored address (F3.7), for partial updates. */
export async function existingLocationAddress(req: MedusaRequest): Promise<ExistingAddresses> {
  const locationId = req.params["id"]
  if (!locationId) {
    return {}
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ADDRESS_FIELDS.map((field) => `address.${field}`),
    filters: { id: locationId },
  })
  return { address: (data[0] as { address?: AddressFields | null } | undefined)?.address ?? null }
}
