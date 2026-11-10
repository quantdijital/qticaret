import { smsLength } from "@/features/bulk-messages/sms"
import type { SmsLength } from "@/features/bulk-messages/sms"
import { MESSAGE_GROUPS, TEXT_FIELDS } from "./api/customer-messages"
import type {
  CustomerMessage,
  CustomerMessageInput,
  MessageGroup,
  TextField,
} from "./api/customer-messages"

/**
 * The customer messages' words as the panel edits them (adr/0036 Ek
 * 2026-11-10): grouped for the list, each field's text with the
 * platform's in place where the shop wrote none, and the SMS counted as
 * Netgsm sends it (`encoding=TR`). The server checks everything again.
 */

/** At most this many SMS a text may take; the server refuses more. */
export const SMS_MAX_PARTS = 3

/** Each `{belirteç}`'s text key (`…customer.tokens.*`): the names themselves are Turkish words. */
export const TOKEN_KEYS: Readonly<Record<string, string>> = {
  mağaza_adı: "shopName",
  müşteri_adı: "customerName",
  sipariş_no: "orderNumber",
  toplam: "total",
  kargo_firması: "carrier",
  takip_no: "trackingNumber",
  takip_bağlantısı: "trackingUrl",
  fatura_no: "invoiceNumber",
  fatura_türü: "invoiceType",
  talep_türü: "requestKind",
  gün_sayısı: "days",
  geçerlilik: "validity",
  ödeme_bağlantısı: "paymentUrl",
  alıcı_adı: "recipientName",
  gönderen_adı: "senderName",
  ürün_adı: "productName",
}

/** The messages under their groups, in the groups' order; a group with none is left out. */
export function groupMessages(
  messages: readonly CustomerMessage[]
): { group: MessageGroup; messages: CustomerMessage[] }[] {
  return MESSAGE_GROUPS.map((group) => ({
    group,
    messages: messages.filter((message) => message.group === group),
  })).filter((each) => each.messages.length > 0)
}

/** Whether the shop wrote any of the message's words. */
export const isReworded = (message: CustomerMessage): boolean =>
  message.fields.some((field) => field.text !== null)

export type TextValues = Partial<Record<TextField, string>>

/** What the dialog starts from: the shop's text, else the platform's. */
export const valuesOf = (message: CustomerMessage): TextValues =>
  Object.fromEntries(message.fields.map((field) => [field.field, field.text ?? field.default]))

/** The platform's words in every field: "Varsayılana dön". */
export const defaultsOf = (message: CustomerMessage): TextValues =>
  Object.fromEntries(message.fields.map((field) => [field.field, field.default]))

/**
 * The words as the server takes them: a field as its default goes as
 * null (the platform's text, kept up to date); only what changed is sent.
 */
export function bodyOf(
  message: CustomerMessage,
  values: TextValues,
  enabled: boolean
): CustomerMessageInput {
  const body: CustomerMessageInput = {}
  for (const field of message.fields) {
    const typed = (values[field.field] ?? "").trim()
    const wanted = typed === "" || typed === field.default.trim() ? null : typed
    if (wanted !== field.text) {
      body[field.field] = wanted
    }
  }
  if (message.switch === "here" && enabled !== message.enabled) {
    body.enabled = enabled
  }
  return body
}

/** Every field's words as a draft preview reads them: null for the platform's. */
export function draftOf(message: CustomerMessage, values: TextValues): CustomerMessageInput {
  return Object.fromEntries(
    message.fields.map((field) => {
      const typed = (values[field.field] ?? "").trim()
      return [field.field, typed === "" || typed === field.default.trim() ? null : typed]
    })
  )
}

// The server's pattern (lib/shop/tokens.ts): letters, digits and `_` between braces
const TOKEN = /\{([\p{L}\p{N}_]+)\}/gu

/** The `{name}`s the text uses that the message does not offer. */
export function unknownTokens(text: string, message: CustomerMessage): string[] {
  const known = new Set(message.tokens.map((token) => token.name))
  return [
    ...new Set(
      [...text.normalize("NFC").matchAll(TOKEN)]
        .map(([, name = ""]) => name)
        .filter((name) => !known.has(name))
    ),
  ]
}

/** The text with each token's preview value: what the SMS is counted on. */
export function withSamples(text: string, message: CustomerMessage): string {
  const samples = new Map(message.tokens.map((token) => [token.name, token.sample]))
  return text.normalize("NFC").replace(TOKEN, (whole, name: string) => samples.get(name) ?? whole)
}

/** The SMS's length with the preview's values: parts, and whether Turkish costs it room. */
export const smsCount = (text: string, message: CustomerMessage): SmsLength =>
  smsLength(withSamples(text.trim(), message))

/** The fields of a channel, as the message has them. */
export const fieldsOf = (message: CustomerMessage, channel: "email" | "sms"): TextField[] =>
  TEXT_FIELDS.filter(
    (field) =>
      (channel === "sms") === (field === "sms") &&
      message.fields.some((each) => each.field === field)
  )
