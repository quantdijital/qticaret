import type { Env } from "../../env"
import { assertProviderAvailable } from "../available"
import { isSuspended, isSuspendedProvider, offeredCarriers, suspendedCarriers } from "../suspended"

const ENV = [
  "CARRIER_DHLECOMMERCE_ENABLED",
  "DHL_ECOMMERCE_BASE_URL",
  "DHL_ECOMMERCE_CLIENT_ID",
  "DHL_ECOMMERCE_CLIENT_SECRET",
]
let kept: (readonly [string, string | undefined])[]

beforeEach(() => {
  kept = ENV.map((name) => [name, process.env[name]] as const)
  for (const name of ENV) {
    Reflect.deleteProperty(process.env, name)
  }
})

afterEach(() => {
  for (const [name, value] of kept) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name)
    } else {
      process.env[name] = value
    }
  }
})

describe("suspended carriers (adr/0027 Ek 2026-11-26 askı)", () => {
  it("suspends DHL eCommerce unless its switch is exactly on", () => {
    const env = (value?: "true" | "false") =>
      ({ ...(value ? { CARRIER_DHLECOMMERCE_ENABLED: value } : {}) }) as Env
    expect(suspendedCarriers(env())).toEqual(["dhlecommerce"])
    expect(suspendedCarriers(env("false"))).toEqual(["dhlecommerce"])
    expect(suspendedCarriers(env("true"))).toEqual([])
  })

  it("leaves it out of the offered carriers and judges its provider", () => {
    expect(offeredCarriers()).toEqual(["aras", "yurtici", "surat"])
    expect(isSuspended("dhlecommerce")).toBe(true)
    expect(isSuspended("aras")).toBe(false)
    expect(isSuspended("paytr")).toBe(false)
    expect(isSuspendedProvider("dhlecommerce_dhlecommerce")).toBe(true)
    expect(isSuspendedProvider("manual_manual")).toBe(false)

    process.env["CARRIER_DHLECOMMERCE_ENABLED"] = "true"
    expect(offeredCarriers()).toEqual(["aras", "yurtici", "dhlecommerce", "surat"])
    expect(isSuspendedProvider("dhlecommerce_dhlecommerce")).toBe(false)
  })
})

describe("DHL eCommerce without the platform's app keys", () => {
  const nothing = { settings: null, secrets: {} }
  const settings = { test_mode: true }

  it("is refused unless the shop gives, or keeps for the same account, its own app keys", () => {
    expect(() => {
      assertProviderAvailable("dhlecommerce", nothing, { settings })
    }).toThrow("dhlecommerce.unavailable")
    expect(() => {
      assertProviderAvailable("dhlecommerce", nothing, {
        settings,
        secrets: { client_id: "kendi-uygulama", client_secret: "" },
      })
    }).toThrow("dhlecommerce.unavailable")
    expect(() => {
      assertProviderAvailable("dhlecommerce", nothing, {
        settings,
        secrets: { client_id: "kendi-uygulama", client_secret: "kendi-sir" },
      })
    }).not.toThrow()

    const stored = { settings, secrets: { client_id: true, client_secret: true } }
    // A check of what is stored, and a save of the same account leaving them blank
    expect(() => {
      assertProviderAvailable("dhlecommerce", stored)
    }).not.toThrow()
    expect(() => {
      assertProviderAvailable("dhlecommerce", stored, { settings })
    }).not.toThrow()
    // Another mode is another account: the stored keys do not carry over
    expect(() => {
      assertProviderAvailable("dhlecommerce", stored, { settings: { test_mode: false } })
    }).toThrow("dhlecommerce.unavailable")
  })

  it("takes any account once the platform's app is set", () => {
    process.env["DHL_ECOMMERCE_CLIENT_ID"] = "platform-uygulama"
    process.env["DHL_ECOMMERCE_CLIENT_SECRET"] = "platform-uygulama-sirri"

    expect(() => {
      assertProviderAvailable("dhlecommerce", nothing, { settings })
    }).not.toThrow()
  })
})
