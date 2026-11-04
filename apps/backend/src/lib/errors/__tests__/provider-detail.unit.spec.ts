import { WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import {
  PROVIDER_FAILED_MESSAGE,
  ProviderError,
  isProviderError,
  providerFailureOf,
  toHttpError,
} from ".."
import { providerFailureSentence, providerName } from "../messages"

const refusal = () =>
  new ProviderError({
    provider: "aras",
    providerCode: "error_Server",
    retryable: false,
    providerMessage: "aras-user için şifre hatalı",
    secrets: ["aras-user"],
    cause: new Error("raw <soap:Fault> body"),
  })

describe("a provider's own words", () => {
  it("are kept made safe, the account's values masked, the values themselves not kept", () => {
    const error = refusal()
    expect(error.providerMessage).toBe("*** için şifre hatalı")
    expect(JSON.stringify(error)).not.toContain("aras-user")
    expect(
      new ProviderError({ provider: "aras", providerCode: "x", retryable: false }).providerMessage
    ).toBeUndefined()
  })

  it("travel with the error through a JSON round trip; a wrong type is no provider error", () => {
    const copy: unknown = JSON.parse(JSON.stringify(refusal()))
    expect(isProviderError(copy)).toBe(true)
    expect(isProviderError({ ...(copy as object), providerMessage: 7 })).toBe(false)
  })

  it("reach staff on the admin API with the stable key, and nobody else", () => {
    expect(toHttpError(refusal(), { providerDetail: true })).toEqual({
      status: 502,
      body: {
        type: "provider_error",
        message: PROVIDER_FAILED_MESSAGE,
        provider: "aras",
        provider_message: "*** için şifre hatalı",
      },
    })
    expect(toHttpError(refusal())).toEqual({
      status: 502,
      body: { type: "provider_error", message: "errors.provider_unavailable" },
    })
  })

  it("name the service even when it said nothing, and keep a 503's delay", () => {
    const busy = new ProviderError({
      provider: "netgsm",
      providerCode: "http_503",
      retryable: true,
      retryAfterMs: 1500,
    })
    expect(toHttpError(busy, { providerDetail: true })).toEqual({
      status: 503,
      body: { type: "provider_unavailable", message: PROVIDER_FAILED_MESSAGE, provider: "netgsm" },
      retryAfterSeconds: 2,
    })
  })

  it("are made safe again when an error arrives as a plain object, its name checked", () => {
    const forged = {
      qtErrorKind: "provider",
      safeMessage: "errors.provider_unavailable",
      provider: "aras",
      providerCode: "x",
      retryable: false,
      providerMessage: "bkz. https://ic.servis.local/x",
    }
    expect(toHttpError(forged, { providerDetail: true })?.body.provider_message).toBe("bkz. ***")
    const odd = { ...forged, provider: "Aras <b>" }
    expect(toHttpError(odd, { providerDetail: true })?.body).toEqual({
      type: "provider_error",
      message: "errors.provider_unavailable",
    })
  })

  it("keep a call's own key", () => {
    const own = new ProviderError({
      provider: "aras",
      providerCode: "x",
      retryable: false,
      safeMessage: "shipping.label_missing",
      providerMessage: "Barkod yok",
    })
    expect(toHttpError(own, { providerDetail: true })?.body).toMatchObject({
      message: "shipping.label_missing",
      provider: "aras",
      provider_message: "Barkod yok",
    })
  })
})

describe("providerFailureSentence", () => {
  it("names the service and quotes it, or says whether it was out of reach", () => {
    expect(
      providerFailureSentence({
        provider: "aras",
        provider_message: "Kullanıcı adı veya şifre hatalı",
        retryable: false,
      })
    ).toBe("Aras Kargo yanıtı: “Kullanıcı adı veya şifre hatalı”")
    expect(providerFailureSentence({ provider: "netgsm", retryable: true })).toBe(
      "Netgsm hizmetine şu an ulaşılamıyor; biraz sonra tekrar deneyin."
    )
    expect(providerFailureSentence({ provider: "yurtici", retryable: false }, "en")).toBe(
      "The request to Yurtiçi Kargo could not be completed; try again shortly."
    )
    expect(providerName("yeni")).toBe("yeni")
    expect(providerName("__proto__")).toBe("__proto__")
  })
})

describe("a provider's failure inside a workflow", () => {
  const failing = createStep("test-provider-detail-throw", () => {
    throw refusal()
  })
  const workflow = createWorkflow("test-provider-detail-workflow", () => {
    failing()
    return new WorkflowResponse(undefined)
  })

  it("keeps what the provider said for the report of a bulk action", async () => {
    const caught: unknown = await workflow()
      .run()
      .then(
        () => null,
        (error: unknown) => error
      )
    expect(providerFailureOf(caught)).toEqual({
      provider: "aras",
      provider_message: "*** için şifre hatalı",
      retryable: false,
    })
    expect(providerFailureOf(new Error("x"))).toBeNull()
  })
})
