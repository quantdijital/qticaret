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
    "contact.message_received": {
      title: "Yeni iletişim mesajı: {{subject}}",
      description: "Müşteriler > İletişim mesajları'nda okuyun.",
    },
    "contact.kvkk_received": {
      title: "Yeni KVKK başvurusu",
      description:
        "Kanun 30 gün içinde yanıt ister; son gün {{due}}. Müşteriler > İletişim mesajları'nda okuyun.",
    },
    "stock.low_stock": {
      title: "Düşük stok: {{name}}",
      description: "{{available}} adet kaldı (eşik {{threshold}}).",
    },
    "messaging.sms_daily_limit": {
      title: "Günlük SMS sınırının %80'i doldu",
      description:
        "Bugün {{count}}/{{limit}} SMS gönderildi. Sınıra ulaşınca SMS gitmez; Ayarlar > SMS'ten değiştirebilirsiniz.",
    },
    "campaigns.paused_complaints": {
      title: "Toplu ileti durduruldu: {{name}}",
      description:
        "Şikâyet ya da geri dönen e-posta oranı sınırı aştı. Kitleyi ve içeriği inceleyip Büyüme > Toplu ileti'den sürdürebilirsiniz.",
    },
    "messaging.email_daily_limit": {
      title: "Günlük e-posta sınırının %80'i doldu",
      description:
        "Bugün {{count}}/{{limit}} e-posta gönderildi. Sınıra ulaşınca e-posta gitmez; Ayarlar > Bildirimler'den değiştirebilirsiniz.",
    },
    "messaging.smtp_rejections": {
      title: "E-posta sunucunuz alıcıları reddediyor",
      description:
        "Son {{minutes}} dakikada {{sends}} e-postanın {{rejections}} tanesi alıcı adresi yok diye reddedildi. Bu çoğunlukla sunucu ayarı sorunudur; adresler gönderilmeyenler listesine yazılmıyor. Sunucunuzu kontrol edip Ayarlar > E-posta ve SMS'ten deneme e-postası gönderin.",
    },
    "orders.bank_transfer_pending": {
      title: "Havale bekleniyor: #{{number}}",
      description: "{{total}} tutarındaki ödeme gelince siparişi onaylayın.",
    },
    "payments.completion_stuck": {
      title: "{{provider}} ödemesi siparişe dönüşemiyor",
      description:
        "{{amount}} ({{reference}}, sepet {{cart}}) için sipariş açılamadı; denenmeye devam ediyor. Stok ve depo ayarlarını kontrol edin.",
    },
    "payments.refunded_before_order": {
      title: "İade edilmiş {{provider}} ödemesi siparişe dönüştürülmedi",
      description:
        "{{amount}} ({{reference}}, sepet {{cart}}) {{provider}} panelinde iade edilmiş görünüyor.",
    },
    "payments.payment_beside_order": {
      title: "Siparişi olan sepete ikinci {{provider}} ödemesi",
      description:
        "{{amount}} ({{reference}}, sepet {{cart}}) başka bir ödemeyle açılmış siparişin sepetine alındı; otomatik iade yapılmadı. Müşterinin iki kez ödeyip ödemediğini kontrol edin.",
    },
    "payments.refund_incomplete": {
      title: "{{provider}} iadesi yapıldı, kaydı yarım kaldı",
      description:
        "Sipariş {{cart}} için {{amount}} iade ({{reference}}) {{provider}} tarafında yapılmış ya da yapılmış olabilir, ancak kaydı tamamlanamadı. {{provider}} panelinden kontrol edin; aynı iadeyi yeniden yapmayın.",
    },
    "payments.shelf_restored": {
      title: "Geçici stok düzeltmesi geri alındı",
      description: "Sepet {{cart}} için artırılan stok geri alındı; stok sayılarını kontrol edin.",
    },
    "orders.new_order": {
      title: "Yeni sipariş: #{{number}}",
      description: "{{total}} tutarında. Siparişler'de görün.",
    },
    "wholesale.order_placed": {
      title: "Yeni toptan sipariş: #{{number}}",
      description: "{{total}} tutarında. Müşteriler > Toptancılar > Siparişler'de görün.",
    },
    "payments.wholesale_price_check": {
      title: "Toptan sepetin ödemesi başlatılamadı",
      description:
        "Sepet {{cart}} toptancının bugünkü fiyatlarına getirilemedi; ödeme alınmadı. Bu sepetteki ürünlerin toptan ve perakende fiyatlarını kontrol edin.",
    },
    "orders.stock_short": {
      title: "Stok yetersiz sipariş #{{number}}",
      description:
        "Eksik: {{lines}}. Üretin ya da tedarik edin; edemeyecekseniz siparişi iptal edip iade edin.",
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
    "payments.orphan_order_exists": {
      title: "{{provider}} ödemesi iade edilmedi: siparişi var",
      description:
        "{{amount}} ({{reference}}) iade listesine yazılmıştı, ancak sipariş {{order}} bu ödemeyle açılmış. Otomatik iade durduruldu; siparişi ve ödemeyi kontrol edin, iade etmeyin.",
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
    "einvoice.expense_voucher_due": {
      title: "#{{order}} siparişinin iadesi için gider pusulası düzenleyin",
      description:
        "Yalnızca iade edilen ürün ve miktarlar için, ilk faturaya bağlı olarak; taslağı sipariş sayfasının fatura kartında.",
    },
    "einvoice.return_invoice_due": {
      title: "#{{order}} siparişinin iadesi için şirketin iade faturasını kaydedin",
      description:
        "Alıcı şirket iade faturası keser; gelince numarasını sipariş sayfasının fatura kartından girin.",
    },
    "einvoice.return_needed": {
      title: "İptal edilen #{{order}} siparişinin faturası duruyor",
      description:
        "Kendi programınızda kestiyseniz orada iptal edin (e-Arşiv: alıcıya iletildiği günden itibaren 8 gün). Süre geçtiyse ya da e-Fatura ise kaydı uygun belgeyle düzeltin.",
    },
    // adr/0032 Ek 2026-11-03: MSY md. 12/1
    "returns.refund_deadline_near": {
      title: "#{{order}} siparişinin iadesi için son gün {{due}}",
      description:
        "Ürün iade kargosuna verildikten (bilinmiyorsa depoya ulaştıktan) sonra para 14 gün içinde iade edilmeli. İade talepleri listesinden teslim alıp iade edin.",
    },
    "payments.statement_mismatch": {
      title: "{{provider}} dökümü {{day}} günü tutmuyor",
      description: "{{count}} fark var; Raporlar > Finans'ta listelendi.",
    },
    // adr/0051: payment links
    "payment_links.paid": {
      title: "Ödeme bağlantısı {{number}} ödendi ({{total}})",
      description: "Sipariş oluştu; Siparişler'de görebilirsiniz.",
    },
    "payment_links.prices_changed": {
      title: "Ödeme bağlantısı {{number}}: fiyatlar değişti",
      description:
        "Müşteri ödeyemedi. Siparişler > Ödeme bağlantıları'ndan bugünkü fiyatlarla yeni bağlantı oluşturun.",
    },
    "payment_links.out_of_stock": {
      title: "Ödeme bağlantısı {{number}}: stokta olmayan ürün",
      description:
        "Müşteri ödeyemedi. Stoğu güncelleyin ya da bağlantıyı iptal edip yenisini oluşturun.",
    },
    "payment_links.paid_on_delivery": {
      title: "Ödeme bağlantısı {{number}}: sipariş verildi ({{total}})",
      description: "Ödeme kapıda alınacak; sipariş Siparişler'de.",
    },
    "payment_links.needs_review": {
      title: "Ödeme bağlantısı {{number}}: siparişi kontrol edin",
      description:
        "Bu bağlantıdan beklenmeyen bir sipariş oluştu. Aynı bağlantı için iki kez ödeme alınıp alınmadığına Siparişler'den bakın.",
    },
  },
  en: {
    "contact.message_received": {
      title: "New contact message: {{subject}}",
      description: "Read it under Customers > Contact messages.",
    },
    "contact.kvkk_received": {
      title: "New KVKK data request",
      description:
        "The law asks for an answer within 30 days; the last day is {{due}}. Read it under Customers > Contact messages.",
    },
    "messaging.sms_daily_limit": {
      title: "80% of today's SMS limit used",
      description:
        "{{count}}/{{limit}} texts sent today. At the limit no text goes; change it under Settings > SMS.",
    },
    "campaigns.paused_complaints": {
      title: "Bulk message stopped: {{name}}",
      description:
        "Its complaint or bounce rate passed the limit. Review the audience and content, then resume it under Growth > Bulk messages.",
    },
    "messaging.email_daily_limit": {
      title: "80% of today's e-mail limit used",
      description:
        "{{count}}/{{limit}} e-mails sent today. At the limit no e-mail goes; change it under Settings > Notifications.",
    },
    "messaging.smtp_rejections": {
      title: "Your mail server is refusing recipients",
      description:
        "In the last {{minutes}} minutes {{rejections}} of {{sends}} e-mails were refused as having no such recipient. This is usually a server setting; the addresses are not being put on the do-not-send list. Check your server, then send a test e-mail from Settings > E-mail and SMS.",
    },
    "orders.bank_transfer_pending": {
      title: "Bank transfer awaited: #{{number}}",
      description: "Confirm the order once the {{total}} payment arrives.",
    },
    "payments.completion_stuck": {
      title: "A {{provider}} payment cannot become an order",
      description:
        "No order opened for {{amount}} ({{reference}}, cart {{cart}}); it is still being tried. Check the stock and warehouse settings.",
    },
    "payments.refunded_before_order": {
      title: "A refunded {{provider}} payment was not made an order",
      description:
        "{{amount}} ({{reference}}, cart {{cart}}) shows as refunded in {{provider}}'s panel.",
    },
    "payments.payment_beside_order": {
      title: "A second {{provider}} payment for a cart already ordered",
      description:
        "{{amount}} ({{reference}}, cart {{cart}}) was taken for a cart whose order another payment opened; it was not refunded automatically. Check whether the customer paid twice.",
    },
    "payments.refund_incomplete": {
      title: "A {{provider}} refund was made, its record is incomplete",
      description:
        "The {{amount}} refund ({{reference}}) for order {{cart}} was, or may have been, made at {{provider}}, but its record could not be completed. Check {{provider}}'s panel; do not make the same refund again.",
    },
    "payments.shelf_restored": {
      title: "A temporary stock raise was taken back",
      description: "The stock raised for cart {{cart}} was lowered again; check the stock counts.",
    },
    "orders.new_order": {
      title: "New order: #{{number}}",
      description: "For {{total}}. See it under Orders.",
    },
    "wholesale.order_placed": {
      title: "New wholesale order: #{{number}}",
      description: "For {{total}}. See it under Customers > Wholesalers > Orders.",
    },
    "payments.wholesale_price_check": {
      title: "A wholesale cart's payment could not start",
      description:
        "Cart {{cart}} could not be set at the wholesaler's prices now; no payment was taken. Check the wholesale and retail prices of its products.",
    },
    "orders.stock_short": {
      title: "Order #{{number}} is short of stock",
      description:
        "Missing: {{lines}}. Make or source the units; if you cannot, cancel the order and refund it.",
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
    "payments.orphan_order_exists": {
      title: "{{provider}} payment not refunded: it has an order",
      description:
        "{{amount}} ({{reference}}) was listed to be refunded, but order {{order}} was placed with it. The automatic refund was stopped; check the order and the payment, do not refund it.",
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
    "einvoice.expense_voucher_due": {
      title: "Issue a gider pusulası for order #{{order}}'s return",
      description:
        "For the goods and quantities returned only, naming the first invoice; the draft is on the order's invoice card.",
    },
    "einvoice.return_invoice_due": {
      title: "Record the company's return invoice for order #{{order}}",
      description:
        "The buying company issues a return invoice; once it comes, enter its number on the order's invoice card.",
    },
    "einvoice.return_needed": {
      title: "Canceled order #{{order}}'s invoice stands",
      description:
        "If your own program issued it, cancel it there (an e-Arşiv within 8 days of reaching the buyer). Past that, or for an e-Fatura, correct the books with the proper document.",
    },
    "returns.refund_deadline_near": {
      title: "Order #{{order}}'s return must be refunded by {{due}}",
      description:
        "The money is due within 14 days of the parcel's handover to the return carrier (or, if unknown, its arrival). Receive and refund it from the return requests list.",
    },
    "payments.statement_mismatch": {
      title: "The {{provider}} statement of {{day}} does not agree",
      description: "{{count}} differences, listed in Reports > Finance.",
    },
    // adr/0051: payment links
    "payment_links.paid": {
      title: "Payment link {{number}} was paid ({{total}})",
      description: "The order is in Orders.",
    },
    "payment_links.prices_changed": {
      title: "Payment link {{number}}: prices changed",
      description:
        "The customer could not pay. Make a new link at today's prices under Orders > Payment links.",
    },
    "payment_links.out_of_stock": {
      title: "Payment link {{number}}: an item is out of stock",
      description:
        "The customer could not pay. Update the stock, or cancel the link and make a new one.",
    },
    "payment_links.paid_on_delivery": {
      title: "Payment link {{number}}: order placed ({{total}})",
      description: "Payment is taken at the door; the order is in Orders.",
    },
    "payment_links.needs_review": {
      title: "Payment link {{number}}: check the order",
      description:
        "An unexpected order came from this link. Check in Orders whether the link was paid twice.",
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
