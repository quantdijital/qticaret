import { validateAndTransformBody } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../../lib/errors"
import { normalizeTrPhone } from "../../lib/tr/phone"
import { AdminPostCustomerNote } from "../admin/customers/[id]/note/validators"
import { ADDRESS_FIELDS, ROOT, validateTrAddresses } from "../validation/tr-address"
import type { ExistingAddresses } from "../validation/tr-address"
import { requireUserActor } from "./actor"

interface CustomerRow {
  id: string
  email: string | null
  has_account: boolean
}

type Body = Record<string, unknown>

const bodyOf = (req: MedusaRequest): Body | null => {
  const body = req.validatedBody
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Body) : null
}

const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLocaleLowerCase("tr") === (b ?? "").trim().toLocaleLowerCase("tr")

async function customersWhere(req: MedusaRequest, filters: Record<string, unknown>) {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "email", "has_account"],
    filters,
  })
  return data as CustomerRow[]
}

/**
 * A customer's phone as the shop writes it (2026-11-06): a Turkish number
 * put in E.164 (`+905321234567`), an empty one taken off; anything else
 * refused with the field named.
 */
export function normalizeCustomerPhone(body: Body): void {
  const phone = body["phone"]
  if (typeof phone !== "string") {
    return
  }
  if (phone.trim() === "") {
    body["phone"] = null
    return
  }
  const normalized = normalizeTrPhone(phone)
  if (!normalized) {
    throw new ValidationError("customers.phone_invalid", { field: "phone" })
  }
  body["phone"] = normalized
}

/** Another guest with the address: Medusa keeps one guest record an e-mail. */
async function assertGuestEmailFree(req: MedusaRequest, email: string, exceptId?: string) {
  const guests = await customersWhere(req, { email: email.trim(), has_account: false })
  if (guests.some((guest) => guest.id !== exceptId)) {
    throw new ConflictError("customers.email_taken")
  }
}

/**
 * "Yeni müşteri" (2026-11-06): a guest only, with no account and no
 * invitation; the person opens their account themselves. Its phone checked.
 */
async function guestOnlyCreate(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const body = bodyOf(req)
    if (body) {
      if (body["has_account"] === true) {
        throw new ValidationError("customers.guest_only", { field: "has_account" })
      }
      normalizeCustomerPhone(body)
      if (typeof body["email"] === "string") {
        await assertGuestEmailFree(req, body["email"])
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * A customer's details changed by staff (2026-11-06). A member's e-mail is
 * their sign-in: it stays theirs to change; a guest's may be corrected,
 * not onto another guest's. The phone is checked as on creation.
 */
async function customerUpdateRules(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const body = bodyOf(req)
    if (body) {
      normalizeCustomerPhone(body)
      const email = body["email"]
      if (typeof email === "string") {
        const [customer] = await customersWhere(req, { id: req.params["id"] ?? "" })
        if (customer && !sameEmail(customer.email, email)) {
          if (customer.has_account) {
            throw new ValidationError("customers.email_is_login", { field: "email" })
          }
          await assertGuestEmailFree(req, email, customer.id)
        } else if (customer) {
          // The same address: nothing to change
          Reflect.deleteProperty(body, "email")
        }
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}

/** The customer's stored address, for partial updates: the route's customer only. */
async function existingAdminCustomerAddress(req: MedusaRequest): Promise<ExistingAddresses> {
  const addressId = req.params["address_id"]
  if (!addressId) {
    return {}
  }
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer_address",
    fields: [...ADDRESS_FIELDS],
    filters: { id: addressId, customer_id: req.params["id"] ?? "" },
  })
  return { [ROOT]: data[0] ?? null }
}

/**
 * Medusa's own customer routes, used by the panel (2026-11-06): people
 * only, the e-mail and phone rules above, Turkish addresses checked against
 * the reference data (F1.4). They run after Medusa's body validation; the
 * audit log records the body's field names (adr/0011).
 */
export const CUSTOMER_ROUTES = [
  {
    matcher: "/admin/customers",
    methods: ["POST" as const],
    middlewares: [requireUserActor, guestOnlyCreate],
  },
  {
    matcher: "/admin/customers/:id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, customerUpdateRules],
  },
  {
    matcher: "/admin/customers/:id/addresses",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateTrAddresses([ROOT])],
  },
  {
    matcher: "/admin/customers/:id/addresses/:address_id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateTrAddresses([ROOT], existingAdminCustomerAddress)],
  },
  {
    matcher: "/admin/customers/:id/addresses/:address_id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/customers/:id/note",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/customers/:id/note",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostCustomerNote)],
  },
]
