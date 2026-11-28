import { z } from "@medusajs/framework/zod"
import { clientFor, errorOf, json, useProvider } from "./harness"

const provider = useProvider()

// DHL eCommerce's error body (docs/entegrasyonlar/dhlecommerce.md): `{error: {Code, Description}}`
const jsonFault = (body: unknown) => {
  const error = (body as { error?: { Code?: unknown; Description?: unknown } } | null)?.error
  return typeof error?.Code === "string" || typeof error?.Code === "number"
    ? {
        code: String(error.Code),
        text: typeof error.Description === "string" ? error.Description : null,
      }
    : undefined
}

// A call that opens something: not safe to send twice
const send = (extra: { secrets?: string[] } = {}) =>
  clientFor(provider, { jsonFault }).http.request({
    method: "POST",
    path: "/orders",
    json: { a: 1 },
    ...extra,
    schema: z.unknown(),
  })

describe("createHttpClient with a JSON service's refusal (jsonFault)", () => {
  it("reads a refusal sent as HTTP 500 as the service's answer, not a lost one", async () => {
    provider.setHandler(
      json(500, { error: { Code: "20001", Description: "VARIŞ ŞUBESİ BULUNAMADI" } })
    )

    const error = await errorOf(send())

    expect(error).toMatchObject({
      providerCode: "error_20001",
      retryable: false,
      providerMessage: "VARIŞ ŞUBESİ BULUNAMADI",
    })
    expect(provider.requests).toHaveLength(1)
  })

  it("reads it under a 4xx too, and masks the call's secrets in its sentence", async () => {
    provider.setHandler(
      json(401, { error: { Code: 401, Description: "kullanici 1234567 sifre gizli-sifre" } })
    )

    const error = (await errorOf(send({ secrets: ["1234567", "gizli-sifre"] }))) as {
      providerCode: string
      providerMessage?: string
    }

    expect(error.providerCode).toBe("error_401")
    expect(error.providerMessage).not.toContain("1234567")
    expect(error.providerMessage).not.toContain("gizli-sifre")
  })

  it("keeps a 500 without a code unknown, and a gateway's answer a gateway's", async () => {
    provider.setHandler(json(500, { message: "x" }))
    expect(await errorOf(send())).toMatchObject({ providerCode: "outcome_unknown" })

    // A gateway's 502 lost the answer: not read as the service's refusal
    provider.setHandler(json(502, { error: { Code: "1", Description: "x" } }))
    expect(await errorOf(send())).toMatchObject({ providerCode: "outcome_unknown" })
  })

  it("refuses a code that is not a provider's word", async () => {
    provider.setHandler(json(500, { error: { Code: "a b<c>", Description: "x" } }))

    expect(await errorOf(send())).toMatchObject({ providerCode: "outcome_unknown" })
  })
})
