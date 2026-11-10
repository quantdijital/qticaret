import { createHmac } from "node:crypto"
import { newWebhookSecret, signatureHeader } from "../webhook"

describe("webhook signature", () => {
  it("signs the timestamp and the body together, as a receiver checks them", () => {
    const secret = `whsec_${"ab".repeat(8)}`
    const body = '{"type":"order.placed"}'
    const expected = createHmac("sha256", secret).update(`1761728400.${body}`).digest("hex")

    expect(signatureHeader(secret, 1761728400, body)).toBe(`t=1761728400,v1=${expected}`)
  })

  it("makes a fresh secret each time", () => {
    expect(newWebhookSecret()).toMatch(/^whsec_[0-9a-f]{48}$/)
    expect(newWebhookSecret()).not.toBe(newWebhookSecret())
  })
})
