import { DEMO_LOCATION_ADDRESS, MANUAL_FULFILLMENT_PROVIDER_ID } from "../../seed/data"
import {
  E2E_STAFF_EMAIL,
  demoShippingOptionsToRemove,
  isDemoOrder,
  isDemoWarehouseAddress,
  isEmptyCategory,
  isLeftoverImportCheck,
} from "../select"
import type { ImportJobRow, ShippingOptionRow } from "../select"

const option = (id: string, more: Partial<ShippingOptionRow> = {}): ShippingOptionRow => ({
  id,
  name: "Standart Kargo",
  provider_id: MANUAL_FULFILLMENT_PROVIDER_ID,
  type: { code: "standart" },
  rules: [{ attribute: "is_return", value: "false" }],
  ...more,
})

const job = (more: Partial<ImportJobRow> = {}): ImportJobRow => ({
  id: "ajob_1",
  type: "catalog.import",
  status: "succeeded",
  input: { source_file_id: "file_1", mode: "check" },
  requested_by: "user_e2e",
  ...more,
})

describe("what demo:remove takes out", () => {
  it("finds demo orders by their mark, or older ones by the seed's street and no e-mail", () => {
    expect(isDemoOrder({ id: "o1", metadata: { demo: true } })).toBe(true)
    expect(
      isDemoOrder({ id: "o2", email: null, shipping_address: { address_1: "Demo Sokak No: 1" } })
    ).toBe(true)
    // A shopper's order always has an e-mail, whatever street it goes to
    expect(
      isDemoOrder({
        id: "o3",
        email: "musteri@example.com",
        shipping_address: { address_1: "Demo Sokak No: 1" },
      })
    ).toBe(false)
    expect(isDemoOrder({ id: "o4", metadata: { demo: "yes" } })).toBe(false)
    expect(isDemoOrder({ id: "o5", shipping_address: null })).toBe(false)
  })

  it("removes the seed's shipping options only when the shop ships some other way", () => {
    const demo = [
      option("so_std"),
      option("so_fast", { name: "Hızlı Kargo", type: { code: "hizli" } }),
    ]
    const returns = option("so_return", {
      name: "İade",
      type: { code: "iade" },
      rules: [{ attribute: "is_return", value: "true" }],
    })
    const aras = option("so_aras", {
      name: "Aras Kargo",
      provider_id: "aras_aras",
      type: { code: "aras" },
    })
    // Named like the seed's but the shop's own (another provider): not demo
    const lookalike = option("so_own", { provider_id: "yurtici_yurtici" })

    expect(demoShippingOptionsToRemove([...demo, returns])).toEqual({
      remove: [],
      keptForCheckout: ["so_std", "so_fast"],
    })
    expect(demoShippingOptionsToRemove([...demo, aras])).toEqual({
      remove: ["so_std", "so_fast"],
      keptForCheckout: [],
    })
    expect(demoShippingOptionsToRemove([lookalike]).remove).toEqual([])
  })

  it("clears the warehouse address only while it is the seed's own", () => {
    expect(isDemoWarehouseAddress({ ...DEMO_LOCATION_ADDRESS })).toBe(true)
    expect(isDemoWarehouseAddress({ ...DEMO_LOCATION_ADDRESS, phone: "+905321112233" })).toBe(false)
    expect(isDemoWarehouseAddress(null)).toBe(false)
  })

  it("removes a demo category only once nothing of the shop's is in or under it", () => {
    expect(
      isEmptyCategory({ id: "c1", handle: "giyim", products: [], category_children: [] })
    ).toBe(true)
    expect(isEmptyCategory({ id: "c2", handle: "gida", products: [{ id: "prod_1" }] })).toBe(false)
    expect(isEmptyCategory({ id: "c3", handle: "ev", category_children: [{ id: "c4" }] })).toBe(
      false
    )
  })

  it("knows e2e staff by the address the e2e setup makes", () => {
    expect(E2E_STAFF_EMAIL.test("e2e-1761234567890-a1b2c3@example.com")).toBe(true)
    expect(E2E_STAFF_EMAIL.test("deniz@example.com")).toBe(false)
    expect(E2E_STAFF_EMAIL.test("e2e-1761234567890-a1b2c3@example.com.tr")).toBe(false)
  })

  it("removes sheet checks only when e2e staff asked for them and are gone", () => {
    const live = new Set(["user_owner"])
    const removed = new Set(["user_e2e_now"])

    expect(isLeftoverImportCheck(job(), live, new Set())).toBe(true)
    expect(isLeftoverImportCheck(job({ requested_by: "user_e2e_now" }), live, removed)).toBe(true)
    // The owner's own checks, real imports, unfinished runs and jobs by no one stay
    expect(isLeftoverImportCheck(job({ requested_by: "user_owner" }), live, removed)).toBe(false)
    expect(
      isLeftoverImportCheck(job({ input: { source_file_id: "f", mode: "apply" } }), live, removed)
    ).toBe(false)
    expect(isLeftoverImportCheck(job({ status: "running" }), live, removed)).toBe(false)
    expect(isLeftoverImportCheck(job({ requested_by: null }), live, removed)).toBe(false)
    expect(isLeftoverImportCheck(job({ type: "catalog.export" }), live, removed)).toBe(false)
  })
})
