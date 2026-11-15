import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "./reject"
import { requestPath } from "./request-path"
import { staffRoleOf } from "./staff-guard"

/**
 * The customer ↔ wholesale account link (`links/wholesale-account-
 * customer.ts`) is expandable through `fields` on any route that reads
 * customers, orders' customers included (security review M3). Who is a
 * wholesaler, and on what terms, is the owner's and admin's (decision 17):
 * a `fields` naming the link is refused (400) on the Store API always,
 * and on the admin API for any other role or a secret API key. A reading
 * that does not ask for it never carries it (Medusa expands no link
 * unasked), so nothing else is touched.
 */

const LINK_FIELD = /wholesale_account/i
const MANAGERS = new Set(["owner", "admin"])

function fieldsOf(req: MedusaRequest): string {
  const fields: unknown = req.query["fields"]
  const values = Array.isArray(fields) ? fields : [fields]
  return values.filter((value): value is string => typeof value === "string").join(",")
}

export async function guardWholesaleLinkFields(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    if (!LINK_FIELD.test(fieldsOf(req))) {
      next()
      return
    }
    const admin = requestPath(req).toLowerCase().startsWith("/admin")
    if (admin && MANAGERS.has((await staffRoleOf(req)) ?? "")) {
      next()
      return
    }
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "The requested fields are not available" },
      "wholesale_fields"
    )
  } catch (error) {
    next(error)
  }
}
