import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { InvoiceRow } from "@/lib/orders/order"

const state = vi.hoisted((): { invoice: InvoiceRow | null } => ({ invoice: null }))
vi.mock("@/lib/env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("@/lib/store-api/publishable-key", () => ({
  publishableKey: () => Promise.resolve("pk_test1234"),
}))
vi.mock("@/lib/account/session", () => ({ sessionToken: () => Promise.resolve(null) }))
vi.mock("@/lib/orders/order", () => ({ orderInvoice: () => Promise.resolve(state.invoice) }))

const { GET } = await import("../route")

const ORDER = "order_01JABCDEFGHJKMNPQRST"

const backend = (response: Response) => {
  const fetch = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(response)
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const pdf = () =>
  new Response("%PDF-1.7", { status: 200, headers: { "content-type": "application/pdf" } })

const open = () =>
  GET(new Request(`http://shop.test/siparis/${ORDER}/fatura`), {
    params: Promise.resolve({ id: ORDER }),
  })

/** `/siparis/:id/fatura`: the invoice PDF passed through from the backend. */
describe("/siparis/:id/fatura", () => {
  beforeEach(() => {
    state.invoice = { id: "inv_1", number: "QT2026000001", has_pdf: true }
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks the backend without following a redirect", async () => {
    const fetch = backend(pdf())
    const answer = await open()
    expect(answer.status).toBe(200)
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toBe(`http://backend.test/store/orders/${ORDER}/invoice/pdf?invoice=inv_1`)
    expect(init?.redirect).toBe("manual")
  })

  it("answers a backend redirect as a failure, not the redirect's target", async () => {
    backend(
      new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } })
    )
    const answer = await open()
    expect(answer.status).toBe(502)
    expect(answer.headers.get("location")).toBeNull()
  })

  it("names the file with the invoice number when it is plain", async () => {
    backend(pdf())
    const answer = await open()
    expect(answer.headers.get("content-disposition")).toBe(
      `inline; filename="fatura-QT2026000001.pdf"; filename*=UTF-8''fatura-QT2026000001.pdf`
    )
  })

  it("never lets a quote in the number break the header", async () => {
    state.invoice = { id: "inv_1", number: 'A"; filename="x.exe', has_pdf: true }
    backend(pdf())
    const answer = await open()
    const disposition = answer.headers.get("content-disposition") ?? ""
    expect(disposition).toBe(
      `inline; filename="fatura-A___filename__x.exe.pdf"; filename*=UTF-8''fatura-A%22%3B%20filename%3D%22x.exe.pdf`
    )
    expect(disposition.match(/"/g)).toHaveLength(2)
  })

  it("keeps a Turkish number whole in UTF-8 and plain in ASCII", async () => {
    state.invoice = { id: "inv_1", number: "ŞUBE-12", has_pdf: true }
    backend(pdf())
    const answer = await open()
    expect(answer.headers.get("content-disposition")).toBe(
      `inline; filename="fatura-_UBE-12.pdf"; filename*=UTF-8''fatura-%C5%9EUBE-12.pdf`
    )
  })
})
