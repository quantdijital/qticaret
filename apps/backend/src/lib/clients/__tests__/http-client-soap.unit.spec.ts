import { z } from "@medusajs/framework/zod"
import { clientFor, errorOf, useProvider } from "./harness"
import type { Handler } from "./harness"

const provider = useProvider()

const envelope = (inner: string) =>
  `<?xml version="1.0" ?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body>${inner}</S:Body></S:Envelope>`

// A JAX-WS service exception, as Yurtiçi sends one (adr/0035)
const JAX_WS_FAULT = envelope(
  `<S:Fault><faultcode>S:Server</faultcode><faultstring>Kullanıcı adı veya şifre hatalı</faultstring><detail><ns2:WSException xmlns:ns2="http://example.com/"><errorCode>936</errorCode><errText>Kullanıcı adı veya şifre hatalı</errText></ns2:WSException></detail></S:Fault>`
)
// A .NET (ASMX) fault: a fault code, no detail
const ASMX_FAULT = envelope(
  `<S:Fault><faultcode>soap:Server</faultcode><faultstring>Sunucu hatası: ayrıntı</faultstring></S:Fault>`
)
// SOAP 1.2: Code/Value
const SOAP12_FAULT = `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"><env:Body><env:Fault><env:Code><env:Value>env:Receiver</env:Value></env:Code><env:Reason><env:Text>x</env:Text></env:Reason></env:Fault></env:Body></env:Envelope>`

const answer =
  (status: number, body: string, type = "text/xml; charset=utf-8"): Handler =>
  (_req, res) => {
    res.writeHead(status, { "content-type": type }).end(body)
  }

// A SOAP call that opens something: not safe to send twice
const send = () =>
  clientFor(provider).http.request({
    method: "POST",
    path: "/ws",
    xml: "<Envelope/>",
    schema: z.string(),
  })

describe("createHttpClient with a SOAP service's fault under HTTP 5xx", () => {
  it("reads a fault on a 500 as the service's refusal, by its detail's code", async () => {
    provider.setHandler(answer(500, JAX_WS_FAULT))

    expect(await errorOf(send())).toMatchObject({ providerCode: "error_936", retryable: false })
    expect(provider.requests).toHaveLength(1)
  })

  it.each([
    ["a .NET fault code", ASMX_FAULT, "text/xml", "error_Server"],
    [
      "SOAP 1.2's Code/Value",
      SOAP12_FAULT,
      "application/soap+xml; charset=utf-8",
      "error_Receiver",
    ],
    [
      "a fault naming no code",
      envelope("<S:Fault><faultstring>x</faultstring></S:Fault>"),
      "text/xml",
      "error_fault",
    ],
    [
      "a code that is a sentence",
      envelope("<S:Fault><detail><errorCode>bir cümle değil</errorCode></detail></S:Fault>"),
      "text/xml",
      "error_fault",
    ],
  ])("reads %s", async (_label, body, type, providerCode) => {
    provider.setHandler(answer(500, body, type))

    expect(await errorOf(send())).toMatchObject({ providerCode, retryable: false })
  })

  it.each([
    ["a 500 without a body", answer(500, "")],
    ["a 500 with an empty envelope", answer(500, envelope(""))],
    ["a fault that is not XML by its type", answer(500, JAX_WS_FAULT, "text/html")],
    ["a fault that does not parse", answer(500, `${JAX_WS_FAULT}<unclosed`)],
    ["a gateway's fault", answer(502, JAX_WS_FAULT)],
    ["a gateway's timeout with a fault", answer(504, JAX_WS_FAULT)],
  ])("keeps the outcome unknown for %s", async (_label, handler) => {
    provider.setHandler(handler)

    expect(await errorOf(send())).toMatchObject({
      providerCode: "outcome_unknown",
      retryable: false,
    })
  })

  it("reads a fault on a repeatable call too, without retrying it", async () => {
    provider.setHandler(answer(500, JAX_WS_FAULT))

    const error = await errorOf(
      clientFor(provider).http.request({
        method: "POST",
        path: "/ws",
        xml: "<Envelope/>",
        idempotent: true,
        schema: z.string(),
      })
    )

    expect(error).toMatchObject({ providerCode: "error_936", retryable: false })
    expect(provider.requests).toHaveLength(1)
  })
})
