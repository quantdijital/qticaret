import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const store = vi.hoisted(() => ({ storeCall: vi.fn(), storeGet: vi.fn(), storePost: vi.fn() }))
vi.mock("@/lib/store-api/server", () => store)

const { subscribeNewsletter } = await import("../newsletter")

const INITIAL = { ok: false, error: null, challenge: null }

const send = (fields: Record<string, string>) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  return subscribeNewsletter(INITIAL, form)
}

/**
 * The newsletter box's action (adr/0038, İYS): the consent box's tick is
 * checked here too, the browser's `required` is not a proof.
 */
describe("subscribeNewsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.storeCall.mockResolvedValue({})
  })

  it("sends a ticked form's address to the backend with the consent text's version", async () => {
    await expect(send({ email: " Ayse@Example.com ", consent: "1" })).resolves.toEqual({
      ok: true,
      error: null,
      challenge: null,
    })
    expect(store.storeCall).toHaveBeenCalledTimes(1)
    expect(store.storeCall).toHaveBeenCalledWith("/store/newsletter", {
      method: "POST",
      body: { email: "ayse@example.com", text_version: "bulten-1" },
    })
  })

  it.each([
    ["no consent field", {}],
    ["an empty consent", { consent: "" }],
    ["another value", { consent: "0" }],
    ["a word instead of the box's value", { consent: "on" }],
  ])("refuses %s and never calls the backend", async (_name, consent) => {
    await expect(send({ email: "ayse@example.com", ...consent })).resolves.toEqual({
      ok: false,
      error: "newsletter.consent_required",
      challenge: null,
    })
    expect(store.storeCall).not.toHaveBeenCalled()
  })

  it("names the address first when both the address and the consent are wrong", async () => {
    await expect(send({ email: "ayse" })).resolves.toEqual({
      ok: false,
      error: "newsletter.email_invalid",
      challenge: null,
    })
    expect(store.storeCall).not.toHaveBeenCalled()
  })

  it("refuses a bad address with the consent ticked", async () => {
    await expect(send({ email: "ayse", consent: "1" })).resolves.toMatchObject({
      ok: false,
      error: "newsletter.email_invalid",
    })
    expect(store.storeCall).not.toHaveBeenCalled()
  })

  it("sends the solved challenge's answer along, the consent still asked", async () => {
    await send({ email: "ayse@example.com", consent: "1", challenge: "tok.en-1" })
    expect(store.storeCall).toHaveBeenCalledWith("/store/newsletter", {
      method: "POST",
      body: { email: "ayse@example.com", text_version: "bulten-1" },
      headers: { "x-challenge": "tok.en-1" },
    })

    vi.clearAllMocks()
    await expect(send({ email: "ayse@example.com", challenge: "tok.en-1" })).resolves.toMatchObject(
      { error: "newsletter.consent_required" }
    )
    expect(store.storeCall).not.toHaveBeenCalled()
  })

  it("hands a 428's challenge back to the form", async () => {
    const challenge = { token: "t", salt: "s", bits: 12 }
    store.storeCall.mockRejectedValue(new StoreApiError(428, null, null, { challenge }))
    await expect(send({ email: "ayse@example.com", consent: "1" })).resolves.toEqual({
      ok: false,
      error: null,
      challenge,
    })
  })

  it.each([
    [429, "newsletter.rate_limited"],
    [400, "newsletter.email_invalid"],
    [500, "newsletter.failed"],
  ])("a %i from the backend reads as %s", async (status, error) => {
    store.storeCall.mockRejectedValue(new StoreApiError(status, null, null))
    await expect(send({ email: "ayse@example.com", consent: "1" })).resolves.toEqual({
      ok: false,
      error,
      challenge: null,
    })
  })
})
