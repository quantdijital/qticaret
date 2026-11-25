import { join } from "node:path"
import {
  GOOGLE_RPC_QUOTA_SERVICES,
  normalizedErrorBody,
  platformFault,
  readableAnswerType,
} from "../provider-errors"

/**
 * A provider's failure as the shop gets it (security review of P3b D2,
 * D3): the shop's own error mapping (apps/backend lib/ai/connectors,
 * loaded at run time) reads the normalized body as it read the provider's,
 * while none of the provider's words are left in it.
 */

interface ShopService {
  id: string
  quotaErrors?: string
  bodyErrors?: Record<number, string>
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names what it loads
const shop = <T>(path: string): T =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a path outside this app's root, test only
  require(join(__dirname, "../../../../../backend/src/lib/ai", path)) as T

const { aiServices } = shop<{ aiServices: (env: string) => readonly ShopService[] }>(
  "registry/services"
)
const { statusFailure } = shop<{
  statusFailure: (service: ShopService, status: number, body: Buffer) => unknown
}>("connectors/status-failure")
const { registeredBodyError } = shop<{
  registeredBodyError: (service: ShopService, body: Buffer) => unknown
}>("connectors/openai-response")

const json = (value: unknown) => Buffer.from(JSON.stringify(value))
const SECRET = "project-4471 balance 12.40 USD"

const BODIES = [
  json({ error: { code: 429, message: `Resource exhausted ${SECRET}` } }),
  json({ error: { code: 429, message: `Quota exceeded for metric: x, limit: 0, ${SECRET}` } }),
  json([
    {
      error: {
        code: 429,
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [{ quotaId: "GenerateRequestsPerDayPerProject", quotaValue: "1500" }],
          },
        ],
      },
    },
  ]),
  json({ error: { code: "quota_exceeded", message: SECRET } }),
  json({ base_resp: { status_code: 1008, status_msg: SECRET } }),
  json({ base_resp: { status_code: 2013, status_msg: SECRET } }),
  Buffer.from(`<html>${SECRET}</html>`),
  Buffer.alloc(0),
]

describe("a provider's failure as the shop reads it (P3b review D2, D3)", () => {
  it("names the shop's Google RPC quota services, no other", () => {
    const shops = aiServices("production")
      .filter((service) => service.quotaErrors === "google-rpc")
      .map((service) => service.id)
      .sort()
    expect([...GOOGLE_RPC_QUOTA_SERVICES].sort()).toEqual(shops)
  })

  it("keeps what the shop's mapping reads and drops the provider's words", () => {
    for (const service of aiServices("production")) {
      for (const status of [400, 402, 404, 429, 500, 503]) {
        for (const body of BODIES) {
          const normal = normalizedErrorBody(service.id, status, body)
          expect(normal.toString("utf8")).not.toContain("balance")
          expect([service.id, status, statusFailure(service, status, normal)]).toEqual([
            service.id,
            status,
            statusFailure(service, status, body),
          ])
          expect(registeredBodyError(service, normal)).toEqual(registeredBodyError(service, body))
        }
      }
    }
  })

  it("reads a success as JSON or a picture only", () => {
    expect(readableAnswerType("application/json; charset=utf-8")).toBe(true)
    expect(readableAnswerType("image/png")).toBe(true)
    expect(readableAnswerType("text/html")).toBe(false)
    expect(readableAnswerType("application/octet-stream")).toBe(false)
  })

  it("tells the platform's own failure: a 404, its key refused in a 400", () => {
    expect(platformFault(404, Buffer.alloc(0))).toBe(true)
    expect(platformFault(400, json({ error: { details: [{ reason: "API_KEY_INVALID" }] } }))).toBe(
      true
    )
    expect(platformFault(400, json({ error: { message: "API key not valid. Please pass" } }))).toBe(
      true
    )
    expect(platformFault(400, json({ error: { message: "max_tokens too large" } }))).toBe(false)
    expect(platformFault(422, json({ error: { message: "API key not valid" } }))).toBe(false)
  })
})
