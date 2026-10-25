import type { MedusaRequest } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import { requireFeature } from "../require-feature"
import { fakeResponse } from "./fakes"

const request = (enabled: boolean | Error, originalUrl = "/admin/x") =>
  ({
    method: "GET",
    originalUrl,
    requestId: "req-12345678",
    scope: {
      resolve: () => ({
        isFeatureEnabled: () =>
          enabled instanceof Error ? Promise.reject(enabled) : Promise.resolve(enabled),
      }),
    },
  }) as unknown as MedusaRequest

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("requireFeature", () => {
  it("lets the request through while the flag is on", async () => {
    const next = jest.fn()

    await requireFeature("test.sample")(request(true), fakeResponse().res, next)

    expect(next).toHaveBeenCalled()
  })

  it.each([
    ["/admin/<b>?q=1", "/admin/%3Cb%3E"],
    ["/admin/%zz", "/admin/%25zz"],
    ["/admin/%C5%9F", "/admin/%C5%9F"],
    ["http://shop.example/admin/x", "/admin/x"],
  ])("names %s in the page as Express does: %s", async (url, shown) => {
    const response = fakeResponse()

    await requireFeature("test.sample")(request(false, url), response.res, jest.fn())

    expect(response.body()).toContain(`<pre>Cannot GET ${shown}</pre>`)
  })

  it("passes a failing flag read to the error handler instead of the route", async () => {
    const error = new Error("db down")
    const next = jest.fn()

    await requireFeature("test.sample")(request(error), fakeResponse().res, next)

    expect(next).toHaveBeenCalledWith(error)
  })

  it("refuses an unknown flag when the route is defined", () => {
    expect(() => requireFeature("no.such_flag")).toThrow(/not a registered feature flag/)
  })

  it("answers like a missing route while the flag is off", async () => {
    const response = fakeResponse()
    const next = jest.fn()

    await requireFeature("test.sample")(request(false), response.res, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.status()).toBe(404)
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8")
    expect(response.body()).toContain("<pre>Cannot GET /admin/x</pre>")
  })
})
