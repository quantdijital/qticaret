import { storefrontTrackingOf, trackingScopes } from "../tracking"

const account = (settings: Record<string, unknown>) => ({ settings })

describe("storefront tracking ids (F18, adr/0038 §4)", () => {
  it("gives the two public ids and nothing else of the accounts", () => {
    const tracking = storefrontTrackingOf({
      ga4: account({ measurement_id: "G-AB12CD34" }),
      meta: account({ pixel_id: "123456789012", test_event_code: "TEST123" }),
    })

    expect(tracking).toEqual({ ga4_measurement_id: "G-AB12CD34", meta_pixel_id: "123456789012" })
  })

  it("leaves out an account that is missing or an id that is unset or malformed", () => {
    expect(storefrontTrackingOf({ ga4: null, meta: null })).toEqual({
      ga4_measurement_id: null,
      meta_pixel_id: null,
    })
    for (const measurement_id of [
      undefined,
      "",
      "g-ab12cd34",
      "G-ABC",
      "G-ABCDEFGHIJKLM",
      'G-AB12"><script>',
      "UA-12345-1",
      12345678,
    ]) {
      expect(storefrontTrackingOf({ ga4: account({ measurement_id }), meta: null })).toEqual({
        ga4_measurement_id: null,
        meta_pixel_id: null,
      })
    }
    for (const pixel_id of [
      undefined,
      "",
      "12345",
      "123456789012345678901",
      "12345a789",
      123456789,
    ]) {
      expect(storefrontTrackingOf({ ga4: null, meta: account({ pixel_id }) })).toEqual({
        ga4_measurement_id: null,
        meta_pixel_id: null,
      })
    }
  })

  it("takes the shortest and the longest well formed ids", () => {
    expect(
      storefrontTrackingOf({
        ga4: account({ measurement_id: "G-ABCD" }),
        meta: account({ pixel_id: "123456" }),
      })
    ).toEqual({ ga4_measurement_id: "G-ABCD", meta_pixel_id: "123456" })
    expect(
      storefrontTrackingOf({
        ga4: account({ measurement_id: "G-ABCDEFGHIJ12" }),
        meta: account({ pixel_id: "12345678901234567890" }),
      })
    ).toEqual({ ga4_measurement_id: "G-ABCDEFGHIJ12", meta_pixel_id: "12345678901234567890" })
  })

  it("refreshes the storefront's site answer for GA4 and Meta only", () => {
    expect(trackingScopes("ga4")).toEqual(["site"])
    expect(trackingScopes("meta")).toEqual(["site"])
    expect(trackingScopes("paytr")).toEqual([])
    expect(trackingScopes("google")).toEqual([])
  })
})
