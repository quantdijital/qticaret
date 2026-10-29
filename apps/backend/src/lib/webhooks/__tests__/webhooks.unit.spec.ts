import { createHmac } from "node:crypto"
import { signatureHeader } from "../signature"
import { shownFailure, webhookUrlProblem } from "../url"

describe("webhook signature", () => {
  it("signs the timestamp and the body together, as a receiver checks them", () => {
    const secret = `whsec_${"ab".repeat(8)}`
    const body = '{"type":"order.placed"}'
    const expected = createHmac("sha256", secret).update(`1761728400.${body}`).digest("hex")

    expect(signatureHeader(secret, 1761728400, body)).toBe(`t=1761728400,v1=${expected}`)
  })
})

describe("webhook address", () => {
  it.each([
    ["https://hooks.example.com/qt", null],
    ["https://hooks.example.com:443/qt", null],
    ["http://hooks.example.com/qt", "webhook.url_https"],
    ["https://user:pass@hooks.example.com/", "webhook.url_invalid"],
    ["https://127.0.0.1/hook", "webhook.url_internal"],
    ["https://10.0.0.5/hook", "webhook.url_internal"],
    ["https://169.254.169.254/latest/meta-data", "webhook.url_internal"],
    ["https://[::1]/hook", "webhook.url_internal"],
    ["https://localhost/hook", "webhook.url_internal"],
    ["https://redis/hook", "webhook.url_internal"],
    ["https://redis.svc.cluster.local/", "webhook.url_internal"],
    ["https://nas.LAN./x", "webhook.url_internal"],
    ["https://router.home.arpa/x", "webhook.url_internal"],
    ["https://erp.corp/x", "webhook.url_internal"],
    ["https://hooks.example.com:8443/qt", "webhook.url_port"],
    ["not a url", "webhook.url_invalid"],
  ] as const)("%s → %s", (url, problem) => {
    expect(webhookUrlProblem(url)).toBe(problem)
  })
})

describe("a failed delivery as the log shows it", () => {
  it.each([
    [null, null],
    ["http_503", "http_503"],
    ["timeout", "timeout"],
    ["response_too_large", "response_too_large"],
    ["redirect_not_allowed", "redirect"],
    ["address_not_allowed", "unreachable"],
    ["dns_failed", "unreachable"],
    ["request_failed", "unreachable"],
  ] as const)("%s → %s", (code, shown) => {
    expect(shownFailure(code)).toBe(shown)
  })
})
