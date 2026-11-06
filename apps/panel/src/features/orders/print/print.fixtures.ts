import type { PackingItem, PackingOrder, PackingSlips } from "@/features/orders/api/packing"

export const item = (more: Partial<PackingItem> = {}): PackingItem => ({
  id: "ordli_1",
  title: "Şef Bıçağı",
  variant: "20 cm",
  sku: "SEF-20",
  quantity: 1,
  ships: true,
  addons: [],
  non_withdrawable: false,
  gift: null,
  unit_price: null,
  total: null,
  ...more,
})

export const order = (more: Partial<PackingOrder> = {}): PackingOrder => ({
  id: "order_1",
  display_id: 1042,
  created_at: "2026-11-06T09:30:00.000Z",
  currency_code: "try",
  email: "ayse@example.com",
  shipping_address: {
    name: "Ayşe Yılmaz",
    company: null,
    address_1: "Bağdat Cad. 1",
    address_2: "Caddebostan Mah.",
    district: "Kadıköy",
    city: "İstanbul",
    postal_code: "34728",
    phone: "+905321234567",
  },
  payment_method: "cod",
  delivery: { name: "Aras Kargo", carrier: "aras" },
  tracking_number: null,
  items: [item()],
  notes: [],
  totals: null,
  ...more,
})

export const slips = (orders: PackingOrder[], prices = false): PackingSlips => ({
  shop: {
    name: "Atölye",
    logo_url: null,
    company_title: "Atölye Bıçak Ltd. Şti.",
    address: "Kadıköy, İstanbul",
    email: "destek@atolye.example",
    phone: "+902161234567",
  },
  prices,
  orders,
})
