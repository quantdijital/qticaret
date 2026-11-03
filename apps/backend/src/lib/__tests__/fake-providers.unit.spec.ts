import { fakeProviders, resetFakeProviderWarnings, warnFakeProviders } from "../fake-providers"

describe("fake provider servers at boot", () => {
  beforeEach(resetFakeProviderWarnings)

  it("names each provider whose address points at a fake, and none where the shop runs", () => {
    expect(
      fakeProviders({
        ARAS_BASE_URL: "http://127.0.0.1:9104",
        PAYTR_BASE_URL: "http://127.0.0.1:9102",
        PARASUT_BASE_URL: "http://127.0.0.1:9108",
      })
    ).toEqual([
      { provider: "PayTR", variable: "PAYTR_BASE_URL" },
      { provider: "Aras", variable: "ARAS_BASE_URL" },
      { provider: "Paraşüt", variable: "PARASUT_BASE_URL" },
    ])
    expect(fakeProviders({})).toEqual([])
  })

  it("warns once per provider, naming it and its variable but never the address", () => {
    const warn = jest.fn()
    const env = {
      YURTICI_BASE_URL: "http://127.0.0.1:9105",
      NETGSM_BASE_URL: "http://127.0.0.1:9106",
    }

    expect(warnFakeProviders(env, { warn })).toBe(2)
    expect(warnFakeProviders(env, { warn })).toBe(0)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(
      { event: "provider.fake_address", provider: "Yurtiçi", variable: "YURTICI_BASE_URL" },
      expect.stringContaining("Yurtiçi") as string
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain("127.0.0.1")
  })

  it("writes nothing without a fake address", () => {
    const warn = jest.fn()

    expect(warnFakeProviders({}, { warn })).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })
})
