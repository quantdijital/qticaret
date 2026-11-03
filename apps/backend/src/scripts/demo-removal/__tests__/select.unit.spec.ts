import { DEMO_LOCATION_ADDRESS, MANUAL_FULFILLMENT_PROVIDER_ID } from "../../seed/data"
import {
  E2E_STAFF_EMAIL,
  demoShippingOptionsToRemove,
  isDemoCategory,
  isDemoOrder,
  isDemoProduct,
  isDemoShippingOption,
  isDemoWarehouseAddress,
  isEmptyCategory,
  isLeftoverImportCheck,
  orderedDemoProducts,
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

  it("takes a product by a demo handle only with the seed's mark, or unchanged from before it", () => {
    const kupa = { id: "prod_1", handle: "seramik-kupa", title: "Seramik Kupa" }

    expect(isDemoProduct({ ...kupa, metadata: { demo: true } })).toBe(true)
    // Seeded before the mark (2026-11-03): no metadata, the seed's title as written
    expect(isDemoProduct({ ...kupa, metadata: null })).toBe(true)
    expect(isDemoProduct({ ...kupa })).toBe(true)
    // The handle alone is not enough: the shop's own record, or the seed's it renamed
    expect(isDemoProduct({ ...kupa, title: "Seramik Kupa 350 ml", metadata: null })).toBe(false)
    expect(isDemoProduct({ ...kupa, title: "seramik kupa", metadata: null })).toBe(false)
    expect(isDemoProduct({ ...kupa, metadata: {} })).toBe(false)
    expect(isDemoProduct({ ...kupa, metadata: { demo: "true" } })).toBe(false)
    expect(isDemoProduct({ ...kupa, metadata: { source: "import" } })).toBe(false)
    // A mark on a handle the seed never made is not the seed's
    expect(
      isDemoProduct({
        id: "prod_2",
        handle: "el-yapimi-bicak",
        title: "Bıçak",
        metadata: { demo: true },
      })
    ).toBe(false)
  })

  it("takes a category by a demo handle only with the seed's mark, or unchanged from before it", () => {
    const giyim = { id: "pcat_1", handle: "giyim", name: "Giyim" }

    expect(isDemoCategory({ ...giyim, metadata: { demo: true } })).toBe(true)
    expect(isDemoCategory({ ...giyim, metadata: null })).toBe(true)
    expect(isDemoCategory({ ...giyim, name: "Giyim ve Aksesuar", metadata: null })).toBe(false)
    expect(isDemoCategory({ ...giyim, metadata: { menu: "top" } })).toBe(false)
    expect(
      isDemoCategory({
        id: "pcat_2",
        handle: "bicaklar",
        name: "Bıçaklar",
        metadata: { demo: true },
      })
    ).toBe(false)
  })

  it("takes a shipping option like the seed's only with its mark, or with no metadata at all", () => {
    expect(isDemoShippingOption(option("so_1", { metadata: { demo: true } }))).toBe(true)
    expect(isDemoShippingOption(option("so_2", { metadata: null }))).toBe(true)
    expect(isDemoShippingOption(option("so_3", { metadata: { note: "bizim" } }))).toBe(false)
    expect(
      isDemoShippingOption(
        option("so_4", { name: "Standart Kargo (İstanbul)", metadata: { demo: true } })
      )
    ).toBe(false)
    expect(
      demoShippingOptionsToRemove([
        option("so_1", { metadata: { demo: true } }),
        option("so_3", { metadata: { note: "bizim" } }),
      ])
    ).toEqual({ remove: ["so_1"], keptForCheckout: [] })
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
    // Empty once the demo products in it go; the shop's own product keeps it
    const going = new Set(["prod_demo"])
    expect(
      isEmptyCategory({ id: "c5", handle: "gida", products: [{ id: "prod_demo" }] }, going)
    ).toBe(true)
    expect(
      isEmptyCategory(
        { id: "c6", handle: "gida", products: [{ id: "prod_demo" }, { id: "prod_own" }] },
        going
      )
    ).toBe(false)
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

describe("demo:remove products-with-orders", () => {
  const stocked = (id: string, handle: string, metadata: unknown, items: string[]) => ({
    id,
    handle,
    title: "Pamuklu Tişört",
    metadata: metadata as Record<string, unknown> | null,
    variants: items.map((item) => ({ inventory_items: [{ inventory_item_id: item }] })),
  })

  it("takes the seed's marked products with the reservations on their stock", () => {
    const found = orderedDemoProducts(
      [
        stocked("prod_1", "pamuklu-tisort", { demo: true }, ["iitem_s", "iitem_m"]),
        stocked("prod_2", "keten-gomlek", { demo: true }, ["iitem_g"]),
      ],
      [
        { id: "res_1", inventory_item_id: "iitem_s" },
        { id: "res_2", inventory_item_id: "iitem_m" },
        { id: "res_3", inventory_item_id: "iitem_other" },
      ]
    )

    expect(found).toEqual([
      { id: "prod_1", label: "pamuklu-tisort", reservation_ids: ["res_1", "res_2"] },
      { id: "prod_2", label: "keten-gomlek", reservation_ids: [] },
    ])
  })

  it("never takes one by its handle or title alone, nor a shop's own product", () => {
    const found = orderedDemoProducts(
      [
        // Made before the mark: the plain run may take it, this option does not
        stocked("prod_1", "pamuklu-tisort", null, ["iitem_1"]),
        stocked("prod_2", "yun-bere", { demo: "yes" }, ["iitem_2"]),
        stocked("prod_3", "kendi-urunum", { demo: true }, ["iitem_3"]),
      ],
      [{ id: "res_1", inventory_item_id: "iitem_1" }]
    )

    expect(found).toEqual([])
  })
})
