import type { CustomerMessage } from "./api/customer-messages"

/** Customer messages as the backend lists them (adr/0036 Ek 2026-11-10), for the tests. */

type Token = CustomerMessage["tokens"][number]

const token = (name: string, sample: string, more: Partial<Token> = {}): Token => ({
  name,
  sample,
  longest: sample,
  may_be_empty: false,
  free_text: false,
  ...more,
})

const field = (
  name: CustomerMessage["fields"][number]["field"],
  text: string,
  own: string | null = null,
  required: string[] = []
) => ({ field: name, default: text, text: own, required_tokens: required })

const ORDER_TOKENS = [
  token("mağaza_adı", "Atölye"),
  token("müşteri_adı", "Ayşe", { longest: "ş".repeat(40), free_text: true }),
  token("sipariş_no", "1042", { longest: "PL-9999999999" }),
]

export const PLACED: CustomerMessage = {
  name: "order.placed",
  kind: "transactional",
  channels: ["email", "sms"],
  group: "order",
  switch: "required",
  enabled: true,
  tokens: [...ORDER_TOKENS, token("toplam", "₺389,80", { longest: "₺9.999.999,99" })],
  fields: [
    field("subject", "Siparişiniz alındı (#{sipariş_no})"),
    field("preheader", "{mağaza_adı} siparişinizi aldı."),
    field("heading", "Teşekkürler {müşteri_adı}, siparişiniz alındı"),
    field("intro", "#{sipariş_no} numaralı siparişinizi aldık."),
    field("sms", "{mağaza_adı}: #{sipariş_no} numaralı siparişiniz alındı. Toplam {toplam}."),
  ],
}

export const PAYMENT_LINK: CustomerMessage = {
  name: "payment_link.sent",
  kind: "transactional",
  channels: ["email", "sms"],
  group: "order",
  switch: "required",
  enabled: true,
  tokens: [
    ...ORDER_TOKENS,
    token("ödeme_bağlantısı", "https://atolye.com.tr/ode/pl_1", {
      longest: `https://${"x".repeat(112)}`,
    }),
  ],
  fields: [
    field("subject", "{mağaza_adı}: siparişiniz hazır ({sipariş_no})"),
    field("sms", "{mağaza_adı}: Siparişiniz hazır. Ödeme: {ödeme_bağlantısı}", null, [
      "ödeme_bağlantısı",
    ]),
  ],
}

export const DELIVERED: CustomerMessage = {
  name: "order.delivered",
  kind: "transactional",
  channels: ["email"],
  group: "shipping",
  switch: "here",
  enabled: true,
  tokens: [...ORDER_TOKENS, token("takip_no", "1234567890", { may_be_empty: true })],
  fields: [
    field("subject", "Siparişiniz teslim edildi (#{sipariş_no})", "Teslim!"),
    field("preheader", "{mağaza_adı} siparişiniz size ulaştı."),
    field("heading", "{müşteri_adı}, siparişiniz teslim edildi"),
    field("intro", "#{sipariş_no} numaralı siparişiniz teslim edildi."),
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
    field("subject", "Sepetinizdeki ürünler sizi bekliyor"),
    field("intro", "{mağaza_adı} sepetinizi sakladı."),
  ],
}

export const CONSENT: CustomerMessage = {
  name: "consent.confirm",
  kind: "transactional",
  channels: ["email", "sms"],
  group: "account",
  switch: "required",
  enabled: true,
  tokens: ORDER_TOKENS.slice(0, 1),
  fields: [],
}

export const MESSAGES: CustomerMessage[] = [PLACED, PAYMENT_LINK, DELIVERED, CONSENT, REMINDER]
