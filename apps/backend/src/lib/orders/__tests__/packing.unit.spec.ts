import { packingOrderOf } from "../packing"
import type { PackingOrderRow } from "../packing"

const ADDONS = {
  qt_addons: {
    items: [
      {
        addon_id: "a1",
        kind: "text",
        label: "Ürün üzerine yazı",
        value: "Ahmet & Ayşe 2026",
        amount: 35,
        non_withdrawable: true,
      },
      {
        addon_id: "a2",
        kind: "choice",
        label: "Kılıf",
        choice_id: "c1",
        choice_label: "Desenli Siyah",
        amount: 300,
        non_withdrawable: false,
      },
    ],
    base: 1000,
    non_withdrawable: true,
    max_quantity: 10,
  },
}

const order: PackingOrderRow = {
  id: "order_1",
  display_id: 1042,
  created_at: "2026-11-06T09:30:00.000Z",
  currency_code: "try",
  email: "ayse@example.com",
  original_item_total: 2670,
  original_shipping_total: 50,
  discount_total: 0,
  total: 2720,
  shipping_address: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    address_1: "Bağdat Cad. 1",
    address_2: "Caddebostan Mah.",
    city: "Kadıköy",
    province: "İstanbul",
    phone: "+905321234567",
  },
  items: [
    {
      id: "item_1",
      title: "Şef Bıçağı",
      product_title: "Şef Bıçağı",
      variant_title: "20 cm",
      variant_sku: "SEF-20",
      quantity: 2,
      unit_price: 1335,
      total: 2670,
      metadata: ADDONS,
    },
    {
      id: "item_2",
      title: "Hediye kartı",
      product_title: "Hediye kartı",
      variant_title: "Default",
      quantity: 1,
      unit_price: 0,
      total: 0,
      requires_shipping: false,
      metadata: {
        qt_gift: {
          recipient_email: "mehmet@example.com",
          recipient_name: "Mehmet",
          message: "İyi ki doğdun",
          sender_name: "Ayşe",
        },
      },
    },
  ],
  payment_collections: [{ payments: [{ provider_id: "pp_cod_cod" }] }],
}

const extras = {
  delivery: { name: "Aras Kargo", carrier: "aras" },
  tracking_number: "ARS123456",
  notes: ["Hediye paketi yapılacak"],
}

describe("packingOrderOf", () => {
  it("prints each add-on's full text, a gift's recipient and note, the method and the place", () => {
    const slip = packingOrderOf(order, { ...extras, prices: false })

    expect(slip).toMatchObject({
      display_id: 1042,
      payment_method: "cod",
      tracking_number: "ARS123456",
      notes: ["Hediye paketi yapılacak"],
      shipping_address: {
        name: "Ayşe Yılmaz",
        address_2: "Caddebostan Mah.",
        district: "Kadıköy",
        city: "İstanbul",
      },
    })
    expect(slip.items[0]).toMatchObject({
      title: "Şef Bıçağı",
      variant: "20 cm",
      sku: "SEF-20",
      quantity: 2,
      ships: true,
      non_withdrawable: true,
      addons: [
        { label: "Ürün üzerine yazı", value: "Ahmet & Ayşe 2026", kind: "text" },
        { label: "Kılıf", value: "Desenli Siyah", kind: "choice" },
      ],
    })
    expect(slip.items[1]).toMatchObject({
      variant: null,
      ships: false,
      gift: { recipient: "Mehmet", message: "İyi ki doğdun", sender: "Ayşe" },
    })
  })

  it("leaves prices out unless the shop asks for them", () => {
    const without = packingOrderOf(order, { ...extras, prices: false })
    const priced = packingOrderOf(order, { ...extras, prices: true })

    expect(without.totals).toBeNull()
    expect(without.items.map((item) => [item.unit_price, item.total])).toEqual([
      [null, null],
      [null, null],
    ])
    expect(priced.totals).toEqual({
      items: "2670.00",
      shipping: "50.00",
      discount: "0.00",
      total: "2720.00",
    })
    expect(priced.items[0]).toMatchObject({ unit_price: "1335.00", total: "2670.00" })
  })
})
