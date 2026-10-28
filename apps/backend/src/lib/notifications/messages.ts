import type { MessageLocale } from "../errors/messages"

/**
 * The shop's alerts as plain text (adr/0020): Medusa's notification feed
 * takes `title` and `description` as they are, so they are worded on the
 * server. The panel words alerts from their data in its own language; these
 * texts are what Medusa's own admin shows.
 */

// One language until F19 (DEFAULT_LOCALE in packages/types)
export const NOTIFICATION_LOCALE: MessageLocale = "tr"

interface AlertText {
  title: string
  description: string
}

export const NOTIFICATION_MESSAGES: Readonly<
  Record<MessageLocale, Readonly<Record<string, AlertText>>>
> = {
  tr: {
    "stock.low_stock": {
      title: "Düşük stok: {{name}}",
      description: "{{available}} adet kaldı (eşik {{threshold}}).",
    },
    "messaging.sms_daily_limit": {
      title: "Günlük SMS sınırının %80'i doldu",
      description:
        "Bugün {{count}}/{{limit}} SMS gönderildi. Sınıra ulaşınca SMS gitmez; Ayarlar > SMS'ten değiştirebilirsiniz.",
    },
    "orders.bank_transfer_pending": {
      title: "Havale bekleniyor: #{{number}}",
      description: "{{total}} tutarındaki ödeme gelince siparişi onaylayın.",
    },
    "integrations.account_changed": {
      title: "{{provider}} hesap bilgileri değişti",
      description: "{{who}}: {{what}}",
    },
    "payments.orphan_recorded": {
      title: "{{provider}} ödemesi siparişe dönüşmedi",
      description: "{{amount}} ({{reference}}) otomatik olarak iade ediliyor.",
    },
    "payments.orphan_refunded": {
      title: "{{provider}} ödemesi iade edildi",
      description: "{{amount}} ({{reference}}) müşteriye geri verildi.",
    },
    "payments.orphan_refund_failed": {
      title: "{{provider}} ödemesi iade edilemedi",
      description: "{{amount}} ({{reference}}) {{provider}} panelinden elle iade edilmeli.",
    },
  },
  en: {
    "messaging.sms_daily_limit": {
      title: "80% of today's SMS limit used",
      description:
        "{{count}}/{{limit}} texts sent today. At the limit no text goes; change it under Settings > SMS.",
    },
    "orders.bank_transfer_pending": {
      title: "Bank transfer awaited: #{{number}}",
      description: "Confirm the order once the {{total}} payment arrives.",
    },
    "stock.low_stock": {
      title: "Low stock: {{name}}",
      description: "{{available}} left (threshold {{threshold}}).",
    },
    "integrations.account_changed": {
      title: "{{provider}} account details changed",
      description: "{{who}}: {{what}}",
    },
    "payments.orphan_recorded": {
      title: "A {{provider}} payment became no order",
      description: "{{amount}} ({{reference}}) is being refunded automatically.",
    },
    "payments.orphan_refunded": {
      title: "{{provider}} payment refunded",
      description: "{{amount}} ({{reference}}) was given back to the customer.",
    },
    "payments.orphan_refund_failed": {
      title: "{{provider}} payment could not be refunded",
      description: "{{amount}} ({{reference}}) must be refunded by hand in the {{provider}} panel.",
    },
  },
}

const fill = (text: string, params: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole
  )

/** An alert's title and description in the shop's language; an unknown key reads as itself. */
export function notificationText(
  key: string,
  params: Readonly<Record<string, string | number>>,
  locale: MessageLocale = NOTIFICATION_LOCALE
): AlertText {
  const messages = NOTIFICATION_MESSAGES[locale]
  const text = Object.hasOwn(messages, key) ? messages[key] : undefined
  return text
    ? { title: fill(text.title, params), description: fill(text.description, params) }
    : { title: key, description: "" }
}
