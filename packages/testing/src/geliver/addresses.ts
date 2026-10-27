import { randomUUID } from "node:crypto"
import type { Handler } from "./routes"
import { failed, ok } from "./routes"

/** An address as the fake keeps it: what was sent, with an id. */
export type FakeAddress = Record<string, unknown> & { id: string; isRecipientAddress: boolean }

// What Geliver asks of a sender (the SDK checks phone and zip before sending)
const SENDER_FIELDS = ["name", "phone", "address1", "cityCode", "districtName", "zip"] as const

/** `/addresses`: list (paged), create, delete. */
export function createAddresses() {
  const addresses = new Map<string, FakeAddress>()

  const list: Handler = ({ query }) => {
    const recipients = query.get("isRecipientAddress")
    const limit = Number(query.get("limit") ?? 20)
    const rows = [...addresses.values()].filter(
      (address) => recipients === null || String(address.isRecipientAddress) === recipients
    )
    return ok(rows.slice(0, limit), {
      limit,
      page: 1,
      totalRows: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    })
  }

  const create: Handler = ({ body }) => {
    const recipient = body["isRecipientAddress"] === true
    const missing = (recipient ? ["name", "phone", "address1"] : SENDER_FIELDS).filter(
      (field) => typeof body[field] !== "string" || body[field] === ""
    )
    if (missing.length > 0) {
      return failed(400, "VALIDATION_ERROR", `missing ${missing.join(", ")}`)
    }
    const address: FakeAddress = { ...body, id: randomUUID(), isRecipientAddress: recipient }
    addresses.set(address.id, address)
    return ok(address)
  }

  const remove: Handler = ({ params }) => {
    const id = params[0] ?? ""
    return addresses.delete(id) ? ok(undefined) : failed(404, "NOT_FOUND", "address not found")
  }

  return {
    addresses,
    routes: {
      "GET /addresses": list,
      "POST /addresses": create,
      "DELETE /addresses/:id": remove,
    } satisfies Record<string, Handler>,
  }
}
