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
    "messaging.email_daily_limit": {
      title: "Günlük e-posta sınırının %80'i doldu",
      description:
        "Bugün {{count}}/{{limit}} e-posta gönderildi. Sınıra ulaşınca e-posta gitmez; Ayarlar > Bildirimler'den değiştirebilirsiniz.",
    },
    "orders.bank_transfer_pending": {
      title: "Havale bekleniyor: #{{number}}",
      description: "{{total}} tutarındaki ödeme gelince siparişi onaylayın.",
    },
    "orders.fraud_review": {
      title: "#{{number}} incelemede (puan {{score}})",
      description: "Şüpheli görünen sipariş kargoya verilmeden önce onayınızı bekliyor.",
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
    "webhooks.disabled": {
      title: "{{host}} webhook aboneliği kapatıldı",
      description: "Arka arkaya 8 teslim başarısız oldu; Ayarlar > Dış API'den açabilirsiniz.",
    },
    "accounting.sync_stopped": {
      title: "Bir {{source}} muhasebe programına aktarılamadı",
      description: "Defalarca denendi; Ayarlar > Muhasebe'den yeniden deneyin.",
    },
    "migration.not_found_seen": {
      title: "Kesimden sonra {{count}} adres 404 verdi",
      description:
        "{{known}} tanesi eski sitenin bilinen adresi; Ayarlar > Taşıma'dan 301 ya da 410 kararı verin.",
    },
    "einvoice.issue_stopped": {
      title: "#{{order}} siparişinin faturası kesilemedi",
      description:
        "Kendiliğinden yeniden denenmeyecek; sipariş sayfasındaki fatura kartından bakın.",
    },
    "einvoice.return_needed": {
      title: "İptal edilen #{{order}} siparişinin faturası duruyor",
      description:
        "Kendi programınızda kestiyseniz orada iptal edin (e-Arşiv: alıcıya iletildiği günden itibaren 8 gün). Süre geçtiyse ya da e-Fatura ise kaydı uygun belgeyle düzeltin.",
    },
    "payments.statement_mismatch": {
      title: "{{provider}} dökümü {{day}} günü tutmuyor",
      description: "{{count}} fark var; Raporlar > Finans'ta listelendi.",
    },
  },
  en: {
    "messaging.sms_daily_limit": {
      title: "80% of today's SMS limit used",
      description:
        "{{count}}/{{limit}} texts sent today. At the limit no text goes; change it under Settings > SMS.",
    },
    "messaging.email_daily_limit": {
      title: "80% of today's e-mail limit used",
      description:
        "{{count}}/{{limit}} e-mails sent today. At the limit no e-mail goes; change it under Settings > Notifications.",
    },
    "orders.bank_transfer_pending": {
      title: "Bank transfer awaited: #{{number}}",
      description: "Confirm the order once the {{total}} payment arrives.",
    },
    "orders.fraud_review": {
      title: "#{{number}} held for review (score {{score}})",
      description: "The order looks suspicious and waits for your approval before it ships.",
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
    "webhooks.disabled": {
      title: "The {{host}} webhook subscription was turned off",
      description: "Eight deliveries in a row failed; turn it on again in Settings > External API.",
    },
    "accounting.sync_stopped": {
      title: "A {{source}} could not be sent to the accounting program",
      description: "It was tried many times; try it again from Settings > Accounting.",
    },
    "migration.not_found_seen": {
      title: "{{count}} addresses answered 404 since cutover",
      description:
        "{{known}} were the old site's known addresses; decide a 301 or 410 in Settings > Migration.",
    },
    "einvoice.issue_stopped": {
      title: "Order #{{order}}'s invoice could not be issued",
      description:
        "It will not be tried again on its own; see the invoice card on the order's page.",
    },
    "einvoice.return_needed": {
      title: "Canceled order #{{order}}'s invoice stands",
      description:
        "If your own program issued it, cancel it there (an e-Arşiv within 8 days of reaching the buyer). Past that, or for an e-Fatura, correct the books with the proper document.",
    },
    "payments.statement_mismatch": {
      title: "The {{provider}} statement of {{day}} does not agree",
      description: "{{count}} differences, listed in Reports > Finance.",
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
