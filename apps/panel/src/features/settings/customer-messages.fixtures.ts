import type { CustomerMessage } from "./api/customer-messages"

/** Customer messages as the backend lists them (adr/0036 Ek 2026-11-10), for the tests. */

const ORDER_TOKENS = [
  { name: "mağaza_adı", sample: "Atölye" },
  { name: "müşteri_adı", sample: "Ayşe" },
  { name: "sipariş_no", sample: "1042" },
]

export const PLACED: CustomerMessage = {
  name: "order.placed",
  kind: "transactional",
  channels: ["email", "sms"],
  group: "order",
  switch: "required",
  enabled: true,
  tokens: [...ORDER_TOKENS, { name: "toplam", sample: "₺389,80" }],
  fields: [
    { field: "subject", default: "Siparişiniz alındı (#{sipariş_no})", text: null },
    { field: "preheader", default: "{mağaza_adı} siparişinizi aldı.", text: null },
    { field: "heading", default: "Teşekkürler {müşteri_adı}, siparişiniz alındı", text: null },
    { field: "intro", default: "#{sipariş_no} numaralı siparişinizi aldık.", text: null },
    {
      field: "sms",
      default: "{mağaza_adı}: #{sipariş_no} numaralı siparişiniz alındı. Toplam {toplam}.",
      text: null,
    },
  ],
}

export const DELIVERED: CustomerMessage = {
  name: "order.delivered",
  kind: "transactional",
  channels: ["email"],
  group: "shipping",
  switch: "here",
  enabled: true,
  tokens: ORDER_TOKENS,
  fields: [
    { field: "subject", default: "Siparişiniz teslim edildi (#{sipariş_no})", text: "Teslim!" },
    { field: "preheader", default: "{mağaza_adı} siparişiniz size ulaştı.", text: null },
    { field: "heading", default: "{müşteri_adı}, siparişiniz teslim edildi", text: null },
    { field: "intro", default: "#{sipariş_no} numaralı siparişiniz teslim edildi.", text: null },
  ],
}

export const REMINDER: CustomerMessage = {
  name: "cart.reminder",
  kind: "commercial",
  channels: ["email"],
  group: "marketing",
  switch: "marketing",
  enabled: false,
  tokens: ORDER_TOKENS.slice(0, 2),
  fields: [
    { field: "subject", default: "Sepetinizdeki ürünler sizi bekliyor", text: null },
    { field: "intro", default: "{mağaza_adı} sepetinizi sakladı.", text: null },
  ],
}

export const CONSENT: CustomerMessage = {
  name: "consent.confirm",
  kind: "transactional",
  channels: ["email", "sms"],
  group: "account",
  switch: "required",
  enabled: true,
  tokens: [ORDER_TOKENS[0] ?? { name: "mağaza_adı", sample: "Atölye" }],
  fields: [],
}

export const MESSAGES: CustomerMessage[] = [PLACED, DELIVERED, CONSENT, REMINDER]
