import { afterEach, describe, expect, it } from "vitest"
import { i18next } from "./i18n"
import { errorText, responseFailure, retryAfterSeconds } from "./errors"

const t = i18next.t.bind(i18next)
const json = (status: number, body: unknown, statusText = "") =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "content-type": "application/json" },
  })

describe("errorText", () => {
  afterEach(async () => {
    await i18next.changeLanguage("tr")
  })

  it("says what a provider said, from the backend's sentence the SDK keeps (ship, SMS)", () => {
    // `sdk.client.fetch`'s FetchError: the status, its text and the body's sentence alone
    const refused = {
      status: 502,
      statusText: "Bad Gateway",
      message: "Aras Kargo yanıtı: “Kullanıcı adı veya şifre hatalı”",
    }
    expect(errorText(t, refused)).toBe("Aras Kargo yanıtı: “Kullanıcı adı veya şifre hatalı”")
    expect(
      errorText(t, {
        status: 503,
        statusText: "",
        message: "Netgsm hizmetine şu an ulaşılamıyor; biraz sonra tekrar deneyin.",
      })
    ).toBe("Netgsm hizmetine şu an ulaşılamıyor; biraz sonra tekrar deneyin.")
  })

  it("says it in the panel's own words when the body was kept (labels, invoices)", async () => {
    const said = await responseFailure(
      json(502, {
        type: "provider_error",
        code: "provider.failed",
        message: "Yurtiçi Kargo yanıtı: “Hata”",
        provider: "yurtici",
        provider_message: "Kargo anahtarı bulunamadı",
      })
    )
    const unreachable = await responseFailure(
      json(503, { code: "provider.failed", message: "…", provider: "aras" })
    )
    const unknown = await responseFailure(
      json(502, { code: "provider.failed", message: "…", provider: "yeni_kargo" })
    )

    expect(errorText(t, said)).toBe("Yurtiçi Kargo yanıtı: “Kargo anahtarı bulunamadı”")
    expect(errorText(t, unreachable)).toBe(
      "Aras Kargo hizmetine şu an ulaşılamıyor; biraz sonra tekrar deneyin."
    )
    expect(errorText(t, unknown)).toBe(
      "yeni_kargo ile işlem tamamlanamadı; biraz sonra tekrar deneyin."
    )
    await i18next.changeLanguage("en")
    expect(errorText(t, said)).toBe("Yurtiçi Kargo answered: “Kargo anahtarı bulunamadı”")
  })

  it("keeps the generic line for a proxy's page, a 500 and a network failure", async () => {
    const proxy = await responseFailure(
      new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" })
    )
    expect(errorText(t, proxy)).toBe("İşlem tamamlanamadı. Biraz sonra tekrar deneyin.")
    expect(errorText(t, { status: 502, statusText: "Bad Gateway", message: "Bad Gateway" })).toBe(
      "İşlem tamamlanamadı. Biraz sonra tekrar deneyin."
    )
    expect(errorText(t, { status: 500, message: "An unknown error occurred." })).toBe(
      "İşlem tamamlanamadı. Biraz sonra tekrar deneyin."
    )
    expect(errorText(t, new TypeError("Failed to fetch"))).toBe(
      "İşlem tamamlanamadı. Biraz sonra tekrar deneyin."
    )
    // A made-up provider name is no key to look up
    expect(
      errorText(t, { status: 502, code: "provider.failed", provider: "x<y", message: "" })
    ).toBe("İşlem tamamlanamadı. Biraz sonra tekrar deneyin.")
  })

  it("still shows a 4xx sentence as the server says it", () => {
    expect(errorText(t, { status: 400, message: "Bu değer başka bir kayıtta kullanılıyor." })).toBe(
      "Bu değer başka bir kayıtta kullanılıyor."
    )
  })
})

describe("retryAfterSeconds", () => {
  it("reads seconds and an HTTP date, and nothing else", () => {
    const now = Date.parse("2026-11-16T10:00:00Z")
    expect(retryAfterSeconds("30", now)).toBe(30)
    expect(retryAfterSeconds("Mon, 16 Nov 2026 10:00:05 GMT", now)).toBe(5)
    expect(retryAfterSeconds("Mon, 16 Nov 2026 09:59:00 GMT", now)).toBe(0)
    expect(retryAfterSeconds(null, now)).toBeNull()
    expect(retryAfterSeconds("soon", now)).toBeNull()
  })

  it("keeps a 429's Retry-After on the failure", async () => {
    const failure = await responseFailure(json(429, { message: "x" }))
    expect(failure).toMatchObject({ status: 429, retry_after: null })
    const limited = await responseFailure(
      new Response("{}", { status: 429, headers: { "retry-after": "7" } })
    )
    expect(limited).toMatchObject({ status: 429, retry_after: 7 })
  })
})
