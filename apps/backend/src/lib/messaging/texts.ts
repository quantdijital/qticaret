import type { MessageLocale } from "../errors/messages"

/**
 * What messages say, by key (adr/0036; CLAUDE.md rule 9): templates take
 * their words from here, with `{{name}}` filled in as plain text. The
 * layout escapes everything. One language until F19.
 */

export const MESSAGE_LOCALE: MessageLocale = "tr"

const TR: Readonly<Record<string, string>> = {
  "footer.order": "Bu e-posta, {{shop}} mağazasındaki siparişiniz için gönderildi.",
  "footer.account": "Bu e-posta, {{shop}} hesabınız için gönderildi.",
  "order.subtotal": "Ara toplam",
  "order.shipping": "Kargo",
  "order.discount": "İndirim",
  "order.total": "Toplam",
  "order.address": "Teslimat adresi",
  "order.view": "Siparişi görüntüle",
  "bank.title": "Havale bilgileri",
  "bank.holder": "Alıcı: {{holder}}",
  "bank.bank": "Banka: {{bank}}",
  "bank.iban": "IBAN: {{iban}}",
  "bank.reference": "Açıklama: #{{number}}",
  "order_placed.subject": "Siparişiniz alındı (#{{number}})",
  "order_placed.preheader": "{{shop}} siparişinizi aldı.",
  "order_placed.heading": "Teşekkürler {{name}}, siparişiniz alındı",
  "order_placed.intro":
    "#{{number}} numaralı siparişinizi aldık. Kargoya verildiğinde size haber vereceğiz.",
  "order_placed.bank_transfer":
    "Siparişinizi hazırlamamız için {{total}} tutarındaki ödemeyi aşağıdaki hesaba gönderin ve açıklamaya sipariş numaranızı yazın.",
  "order_placed.bank_deadline":
    "Son ödeme zamanı: {{deadline}}. Ödeme gelmezse sipariş iptal edilir.",
  "order_placed.cod": "Ödemeyi ({{total}}) siparişiniz teslim edilirken kuryeye yapacaksınız.",
  "order_placed.sms":
    "{{shop}}: #{{number}} numaralı siparişiniz alındı. Toplam {{total}}. Teşekkür ederiz.",
}

const CATALOG: Readonly<Record<MessageLocale, Readonly<Record<string, string>>>> = {
  tr: TR,
  // English arrives with F19; until then the Turkish text stands in
  en: TR,
}

/** The text for a key with its values filled in; a missing key is a programming error. */
export function messageText(
  key: string,
  values: Readonly<Record<string, string | number>> = {},
  locale: MessageLocale = MESSAGE_LOCALE
): string {
  const text = CATALOG[locale][key]
  if (text === undefined) {
    throw new Error(`messaging: no text for ${key}`)
  }
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ""))
}
