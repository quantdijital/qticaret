import { currentRequestId } from "../../../lib/logging"
import { ensureRequestId, isValidRequestId, requestContext } from "../request-id"
import { fakeRequest, fakeResponse } from "./fakes"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("isValidRequestId", () => {
  it.each(["3f2b8c1e-6a4d-4e8b-9c1f-2a3b4c5d6e7f", "req_01J9ABCDEF", "abc.def:123-xyz"])(
    "accepts %s",
    (value) => {
      expect(isValidRequestId(value)).toBe(true)
    }
  )

  it.each([
    ["empty", ""],
    ["too short", "abc"],
    ["too long", "a".repeat(129)],
    ["a line break", "abcdefgh\nINFO forged"],
    ["spaces", "abc defgh ijk"],
    ["two joined headers", "abcdefgh, ijklmnop"],
    ["a leading separator", "-abcdefgh"],
    ["an array", ["abcdefgh"]],
    ["undefined", undefined],
  ])("rejects %s", (_label, value) => {
    expect(isValidRequestId(value)).toBe(false)
  })
})

describe("ensureRequestId", () => {
  it("keeps a valid incoming ID and echoes it", () => {
    const req = fakeRequest({ requestId: "req-12345678" })
    const { res, headers } = fakeResponse()

    expect(ensureRequestId(req, res)).toBe("req-12345678")
    expect(headers["x-request-id"]).toBe("req-12345678")
  })

  it("replaces an invalid ID with a UUID on the request and the response", () => {
    const req = fakeRequest({ requestId: "bad\nvalue" })
    const { res, headers } = fakeResponse()

    const requestId = ensureRequestId(req, res)

    expect(requestId).toMatch(UUID)
    expect(req.requestId).toBe(requestId)
    expect(headers["x-request-id"]).toBe(requestId)
  })

  it("is idempotent", () => {
    const req = fakeRequest({ requestId: undefined })
    const { res } = fakeResponse()

    const first = ensureRequestId(req, res)

    expect(ensureRequestId(req, res)).toBe(first)
  })

  it("does not set a header once the response has started", () => {
    const req = fakeRequest({ requestId: "req-12345678" })
    const { res, headers } = fakeResponse(true)

    ensureRequestId(req, res)

    expect(headers).toEqual({})
  })
})

describe("requestContext", () => {
  it("runs the rest of the chain inside the request's log context", () => {
    const req = fakeRequest({ requestId: "req-12345678" })
    const { res } = fakeResponse()
    let seen: string | undefined

    requestContext(req, res, () => {
      seen = currentRequestId()
    })

    expect(seen).toBe("req-12345678")
    expect(currentRequestId()).toBeUndefined()
  })
})
