import { randomUUID } from "node:crypto"
import type { Handler } from "./routes"
import { failed, ok } from "./routes"

/** An address as the fake keeps it: what was sent, with an id. */
export type FakeAddress = Record<string, unknown> & { id: string; isRecipientAddress: boolean }

// What Geliver asks of a sender (the SDK checks phone and zip before sending); the city
// by its plate code or its name, either does (README: "cityCode ve cityName bir arada veya ayrı")
const SENDER_FIELDS = ["name", "phone", "address1", "districtName", "zip"] as const

const text = (value: unknown): boolean => typeof value === "string" && value !== ""

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
    const missing: string[] = (recipient ? ["name", "phone", "address1"] : SENDER_FIELDS).filter(
      (field) => !text(body[field])
    )
    if (!recipient && !text(body["cityCode"]) && !text(body["cityName"])) {
      missing.push("cityCode")
    }
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
