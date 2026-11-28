import { randomBytes } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { designPreview } from "../../../../lib/content/preview-token"
import { GET } from "../[id]/preview/route"

/** adr/0064: a saved look's preview link names that look as it is saved now, nothing else. */

const KEY = randomBytes(32)
const SAVED = new Date("2026-11-28T08:00:00Z")
const LOOK = "sfd_01JLOOK"
let storefrontUrl: string | null = "https://magaza.example"

jest.mock("../../../../lib/orders/access-token", () => ({ orderAccessKey: () => KEY }))
jest.mock("../../../../workflows/messaging/brand", () => ({
  brandOf: () => Promise.resolve({ storefrontUrl }),
}))
jest.mock("../../../../workflows/storefront/layout-row", () => ({
  layouts: () => ({
    listStorefrontDesigns: ({ id }: { id: string }) =>
      Promise.resolve(id === LOOK ? [{ id, updated_at: SAVED }] : []),
  }),
}))

async function call(id: string) {
  const req = { params: { id }, scope: {} } as unknown as AuthenticatedMedusaRequest
  let body: { url: string; path: string; expires_at: Date } | undefined
  const headers: Record<string, string> = {}
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value
    },
    json: (value: typeof body) => {
      body = value
    },
  } as unknown as MedusaResponse
  await GET(req, res)
  // A link is no one's to keep
  expect(headers["cache-control"]).toBe("private, no-store")
  return body
}

describe("GET /admin/storefront-designs/:id/preview", () => {
  it("signs a link to that look for an hour, on the shop's storefront", async () => {
    storefrontUrl = "https://magaza.example"
    const answer = await call(LOOK)
    expect(answer?.path).toMatch(/^\/onizleme\/sfd_01JLOOK\.[0-9a-z]+\.[\w-]{43}$/)
    expect(answer?.url).toBe(`https://magaza.example${answer?.path ?? ""}`)
    const token = (answer?.path ?? "").replace("/onizleme/", "")
    const parts = designPreview.parts(token)
    expect(parts && designPreview.opens(KEY, parts, SAVED)).toBe(true)
    const left = (answer?.expires_at.getTime() ?? 0) - Date.now()
    expect(left).toBeGreaterThan(59 * 60 * 1000)
    expect(left).toBeLessThanOrEqual(60 * 60 * 1000)
  })

  it("gives the path alone when the storefront's address is not known", async () => {
    storefrontUrl = null
    const answer = await call(LOOK)
    expect(answer?.url).toBe(answer?.path)
  })

  it("is a 404 for a look not there or an id not a look's", async () => {
    await expect(call("sfd_01JGONE")).rejects.toMatchObject({ type: "not_found" })
    await expect(call("sfl_01J")).rejects.toMatchObject({ type: "not_found" })
  })
})
