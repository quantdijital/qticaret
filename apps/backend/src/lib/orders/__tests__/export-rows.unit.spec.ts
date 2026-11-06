import { ORDER_EXPORT_HEADER, ORDER_EXPORT_WIDTHS, orderExportRows } from "../export-rows"
import type { ExportOrderRow } from "../export-rows"

const order: ExportOrderRow = {
  id: "order_1",
  display_id: 1042,
  // 23:30 UTC is the next day in Turkey
  created_at: "2026-11-05T23:30:00.000Z",
  status: "pending",
  currency_code: "try",
  email: "ayse@example.com",
  customer: { first_name: "Ayşe", last_name: "Yılmaz", phone: "+905000000000" },
  shipping_address: { phone: "+905321234567", city: "Kadıköy", province: "İstanbul" },
  original_item_total: 2970,
  discount_total: 100.5,
  original_shipping_total: 50,
  tax_total: 486.67,
  total: 2919.5,
  payment_collections: [
    {
      status: "authorized",
      amount: 2919.5,
      captured_amount: 0,
      refunded_amount: 0,
      payments: [{ provider_id: "pp_bank-transfer_bank-transfer" }],
    },
  ],
  items: [
    {
      product_title: "Şef Bıçağı",
      variant_title: "20 cm",
      variant_sku: "SEF-20",
      quantity: 2,
      unit_price: 1335,
      total: 2670,
      metadata: {
        qt_addons: {
          items: [
            {
              addon_id: "a1",
              kind: "text",
              label: "Ürün üzerine yazı",
              value: "Ahmet",
              amount: 35,
            },
          ],
        },
      },
    },
    {
      title: "Bileme taşı",
      variant_title: "Default",
      quantity: 1,
      unit_price: 300,
      total: 300,
    },
  ],
}

const extras = {
  carrier: "Aras Kargo",
  tracking_number: "ARS1",
  invoice_number: "GIB2026000000001",
}

describe("orderExportRows", () => {
  it("writes a row per line, the order's columns repeated, as many cells as the header", () => {
    const rows = orderExportRows(order, extras)

    expect(ORDER_EXPORT_WIDTHS).toHaveLength(ORDER_EXPORT_HEADER.length)
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.length === ORDER_EXPORT_HEADER.length)).toBe(true)
    expect(rows[0]).toEqual([
      1042,
      "2026-11-06 02:30",
      "Hazırlanacak",
      "Ayşe Yılmaz",
      "ayse@example.com",
      "+905321234567",
      "İstanbul",
      "Kadıköy",
      "Şef Bıçağı",
      "20 cm",
      "SEF-20",
      2,
      1335,
      2670,
      "Ürün üzerine yazı: Ahmet",
      2970,
      100.5,
      50,
      486.67,
      2919.5,
      "Havale/EFT",
      "Aras Kargo",
      "ARS1",
      "GIB2026000000001",
    ])
    // The same order on its second line; a default variant is no variant
    expect(rows[1]?.slice(0, 8)).toEqual(rows[0]?.slice(0, 8))
    expect(rows[1]?.slice(8, 15)).toEqual(["Bileme taşı", null, null, 1, 300, 300, null])
  })

  it("writes an order without lines as one row, its line columns empty", () => {
    const rows = orderExportRows({ ...order, items: [] }, extras)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.slice(8, 15)).toEqual([null, null, null, null, null, null, null])
    expect(rows[0]).toHaveLength(ORDER_EXPORT_HEADER.length)
  })
})
