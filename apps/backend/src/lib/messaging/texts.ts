import type { MessageLocale } from "../errors/messages"

/**
 * What messages say, by key (adr/0036; CLAUDE.md rule 9): templates take
 * their words from here, with `{{name}}` filled in as plain text. The
 * layout escapes everything. One language until F19.
 */

export const MESSAGE_LOCALE: MessageLocale = "tr"

const TR: Readonly<Record<string, string>> = {
  "footer.unsubscribe": "Bu iletileri almak istemiyorum",
  "footer.stock": "Bu e-postayı, {{shop}} mağazasında stok bildirimi istediğiniz için aldınız.",
  "footer.order": "Bu e-posta, {{shop}} mağazasındaki siparişiniz için gönderildi.",
  "footer.account": "Bu e-posta, {{shop}} hesabınız için gönderildi.",
  "footer.staff":
    "Bu e-posta, {{shop}} yöneticisi olarak bildirim aldığınız için gönderildi. Ayarlar > Bildirimler'den değiştirebilirsiniz.",
  "staff.customer": "Müşteri",
  "staff.items": "Ürün adedi",
  "staff.payment": "Ödeme",
  "staff.payments.card": "Kart",
  "staff.payments.bank_transfer": "Havale/EFT (onay bekliyor)",
  "staff.payments.cash_on_delivery": "Kapıda ödeme",
  "staff_order.subject": "Yeni sipariş #{{number}} ({{total}})",
  "staff_order.preheader": "{{customer}} sipariş verdi.",
  "staff_order.heading": "Yeni sipariş: #{{number}}",
  "staff_transfer.subject": "Havale bekleniyor: #{{number}} ({{total}})",
  "staff_transfer.preheader": "Para gelince panelden onaylayın.",
  "staff_transfer.heading": "#{{number}} havale bekliyor",
  "staff_transfer.intro":
    "{{customer}} {{total}} tutarındaki siparişi havale/EFT ile ödeyecek. Para hesabınıza geçince Siparişler > Ödeme bekleyen'den onaylayın; süresi içinde gelmezse sipariş iptal edilir.",
  "staff_stock.subject": "Stok azaldı: {{name}}",
  "staff_stock.preheader": "{{available}} adet kaldı.",
  "staff_stock.heading": "{{name}} azalıyor",
  "staff_stock.intro":
    "{{available}} adet kaldı (eşik {{threshold}}). Stok eklemek için Stok sayfasına gidin.",
  "staff_seo.subject": "Haftalık SEO özeti: ortalama {{average}}/100",
  "staff_seo.preheader": "{{critical}} üründe kritik bulgu var.",
  "staff_seo.heading": "Bu haftanın SEO özeti",
  "staff_seo.products": "Değerlendirilen ürün",
  "staff_seo.average": "Ortalama puan",
  "staff_seo.critical": "Kritik bulgusu olan",
  "staff_seo.poor": "Zayıf puanlı",
  "staff_seo.lowest": "Önce bakılacaklar",
  "footer.commercial":
    "Bu e-postayı {{shop}} ticari ileti izniniz olduğu için aldınız. İzninizi hesabınızdan ya da {{contact}} adresine yazarak dilediğiniz an geri alabilirsiniz.",
  "announcement.button": "Mağazaya git",
  "announcement.sms": "{{shop}}: {{title}} {{body}} Ret için mağazayla iletişime geçin.",
  "order.subtotal": "Ara toplam",
  "order.shipping": "Kargo",
  "order.discount": "İndirim",
  "order.total": "Toplam",
  "order.address": "Teslimat adresi",
  "order.view": "Siparişi görüntüle",
  "consent_confirm.subject": "Kampanya iletilerine izninizi onaylayın",
  "consent_confirm.preheader": "{{shop}} size kampanya iletisi göndermeden önce soruyor.",
  "consent_confirm.intro":
    "{{shop}} kampanya ve fırsat iletileri için bu adrese izin verildi. İzni siz verdiyseniz aşağıdaki düğmeyle onaylayın.",
  "consent_confirm.button": "İznimi onayla",
  "consent_confirm.ignore":
    "Bu isteği siz yapmadıysanız iletiyi yok sayın; onaylamadığınız sürece size kampanya iletisi gelmez.",
  "consent_confirm.sms":
    "{{shop}}: Kampanya SMS'lerine izin verildi. Onaylamak için: {{url}} Siz istemediyseniz yok sayın.",
  "consent_revoke.subject": "Kampanya iletileri iznini geri çekmeyi onaylayın",
  "consent_revoke.intro":
    "{{shop}} kampanya iletileri için bu adresin izni geri çekilmek istendi. Siz istediyseniz aşağıdaki düğmeyle onaylayın.",
  "consent_revoke.button": "İznimi geri çek",
  "consent_revoke.sms":
    "{{shop}}: Kampanya SMS izninizin geri çekilmesi istendi. Onaylamak için: {{url}}",
  "stock_confirm.subject": "Stok bildirimini onaylayın",
  "stock_confirm.preheader": "{{shop}} ürün stoğa girince size haber versin mi?",
  "stock_confirm.heading": "Stok bildirimini onaylayın",
  "stock_confirm.intro":
    "{{product}} yeniden stoğa girdiğinde size haber vermemizi istediniz. Onaylamak için aşağıdaki düğmeye tıklayın.",
  "stock_confirm.button": "Bildirimi onayla",
  "stock_confirm.ignore":
    "Bu isteği siz yapmadıysanız e-postayı yok sayın; onaylamadığınız sürece size stok iletisi gelmez.",
  "back_in_stock.subject": "{{product}} yeniden stokta",
  "back_in_stock.preheader": "{{shop}} haber veriyor: beklediğiniz ürün geldi.",
  "back_in_stock.heading": "{{product}} yeniden stokta",
  "back_in_stock.intro": "Beklediğiniz {{product}} yeniden satışta. Stok sınırlı olabilir.",
  "back_in_stock.button": "Ürüne git",
  "back_in_stock.once": "Bu bildirim tek seferliktir; bu ürün için size başka ileti gönderilmez.",
  "cart_reminder.subject": "Sepetinizdeki ürünler sizi bekliyor",
  "cart_reminder.preheader": "{{shop}} sepetinizi sizin için sakladı.",
  "cart_reminder.heading": "{{name}}, sepetinizi unutmayın",
  "cart_reminder.intro": "{{shop}} mağazasında sepetinize eklediğiniz ürünler hâlâ sizi bekliyor.",
  "cart_reminder.button": "Sepetime dön",
  "cart_reminder.note":
    "Bağlantı {{days}} gün geçerlidir ve sepetinizi bir kez açar. Fiyat ve stok, döndüğünüz anki durumuna göre gösterilir.",
  "order_link.subject": "Siparişinizin bağlantısı (#{{number}})",
  "order_link.preheader": "{{shop}} siparişinizi görüntüleyin.",
  "order_link.heading": "Merhaba {{name}}, siparişiniz burada",
  "order_link.intro":
    "#{{number}} numaralı siparişinizi görmek, iptal etmek ya da iade talebi açmak için aşağıdaki düğmeye tıklayın. Bağlantı {{days}} gün geçerlidir.",
  "order_link.ignore":
    "Bu bağlantıyı siz istemediyseniz e-postayı yok sayın; bağlantı yalnızca bu adrese gönderildi.",
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
  "parcel.title": "Gönderi",
  "parcel.contents": "Kolideki ürünler",
  "parcel.carrier": "Kargo firması: {{carrier}}",
  "parcel.tracking": "Takip numarası: {{number}}",
  "parcel.follow": "Kargonu takip et",
  "order_shipped.subject": "Siparişiniz kargoya verildi (#{{number}})",
  "order_shipped.preheader": "{{shop}} siparişinizi yola çıkardı.",
  "order_shipped.heading": "{{name}}, siparişiniz yolda",
  "order_shipped.intro": "#{{number}} numaralı siparişiniz kargoya verildi.",
  "order_shipped.sms": "{{shop}}: #{{number}} numaralı siparişiniz {{carrier}} ile yola çıktı.",
  "order_shipped.sms_link":
    "{{shop}}: #{{number}} numaralı siparişiniz {{carrier}} ile yola çıktı. Takip: {{url}}",
  "order_delivered.subject": "Siparişiniz teslim edildi (#{{number}})",
  "order_delivered.preheader": "{{shop}} siparişiniz size ulaştı.",
  "order_delivered.heading": "{{name}}, siparişiniz teslim edildi",
  "order_delivered.intro": "#{{number}} numaralı siparişiniz teslim edildi. Güle güle kullanın.",
  "order_delivered.returns":
    "Bir sorun varsa teslimden sonraki 14 gün içinde hesabınızdaki sipariş sayfasından iade ya da değişim talebi açabilirsiniz.",
  "returns.lines": "Talepteki ürünler",
  "return_requested.subject.return": "İade talebiniz alındı (#{{number}})",
  "return_requested.subject.exchange": "Değişim talebiniz alındı (#{{number}})",
  "return_requested.preheader": "{{shop}} talebinizi inceleyecek.",
  "return_requested.heading.return": "{{name}}, iade talebinizi aldık",
  "return_requested.heading.exchange": "{{name}}, değişim talebinizi aldık",
  "return_requested.intro.return":
    "#{{number}} numaralı siparişiniz için iade talebinizi aldık. İnceleyip size haber vereceğiz.",
  "return_requested.intro.exchange":
    "#{{number}} numaralı siparişiniz için değişim talebinizi aldık. İnceleyip size haber vereceğiz.",
  "return_approved.subject.return": "İade talebiniz onaylandı (#{{number}})",
  "return_approved.subject.exchange": "Değişim talebiniz onaylandı (#{{number}})",
  "return_approved.preheader": "{{shop}} talebinizi onayladı.",
  "return_approved.heading.return": "{{name}}, iadeniz onaylandı",
  "return_approved.heading.exchange": "{{name}}, değişiminiz onaylandı",
  "return_approved.intro.return":
    "#{{number}} numaralı siparişinizdeki ürünleri geri gönderebilirsiniz. Ürünler bize ulaşıp kontrol edildikten sonra ödemeniz iade edilir.",
  "return_approved.intro.exchange":
    "#{{number}} numaralı siparişinizdeki ürünleri geri gönderebilirsiniz. Ürünler bize ulaştığında yenileri yola çıkar.",
  "return_approved.code_title": "Kargo kodu",
  "return_approved.code": "Koliyi kargo şubesine teslim ederken bu kodu söyleyin: {{code}}",
  "return_approved.no_code":
    "Ürünleri nasıl göndereceğinizle ilgili mağaza sizinle iletişime geçecek.",
  "return_refunded.subject.return": "İadeniz yapıldı (#{{number}})",
  "return_refunded.subject.exchange": "Değişim farkınız iade edildi (#{{number}})",
  "return_refunded.preheader": "{{shop}} ödemenizi iade etti.",
  "return_refunded.heading.return": "{{name}}, iadeniz yapıldı",
  "return_refunded.heading.exchange": "{{name}}, farkınız iade edildi",
  "return_refunded.intro.return":
    "#{{number}} numaralı siparişinizden iade ettiğiniz ürünlerin ödemesini geri gönderdik.",
  "return_refunded.intro.exchange":
    "#{{number}} numaralı siparişinizdeki değişimin farkını geri gönderdik.",
  "return_refunded.amount": "İade tutarı",
  "return_refunded.when": "Tutarın kartınıza yansıması bankanıza göre birkaç iş günü sürebilir.",
  "password_reset.subject": "Şifrenizi yenileyin",
  "password_reset.preheader": "{{shop}} hesabınız için şifre yenileme bağlantısı.",
  "password_reset.heading": "Şifre yenileme isteği",
  "password_reset.intro":
    "{{shop}} hesabınız için şifre yenileme isteği aldık. Aşağıdaki bağlantı 15 dakika geçerlidir.",
  "password_reset.button": "Şifremi yenile",
  "password_reset.ignore": "Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.",
  "verify_email.subject": "E-posta adresinizi doğrulayın",
  "verify_email.preheader": "{{shop}} doğrulama kodunuz.",
  "verify_email.heading": "E-posta adresinizi doğrulayın",
  "verify_email.intro": "{{shop}} hesabınızı tamamlamak için e-posta adresinizi doğrulayın.",
  "verify_email.button": "E-postamı doğrula",
  "verify_email.code_hint": "Düğme açılmazsa bu kodu doğrulama sayfasına yapıştırın:",
  "verify_email.code_title": "Doğrulama kodu",
  "verify_email.expires": "Kod {{at}} tarihine kadar geçerlidir.",
  "verify_email.ignore": "Bu isteği siz yapmadıysanız bu e-postayı yok sayın.",
  "payment_failed.subject": "Ödemeniz tamamlanamadı",
  "payment_failed.preheader": "{{shop}} siparişiniz henüz oluşmadı.",
  "payment_failed.heading": "{{name}}, ödemeniz tamamlanamadı",
  "payment_failed.intro":
    "{{total}} tutarındaki ödemeniz bankanız ya da ödeme kuruluşu tarafından onaylanmadı; siparişiniz oluşmadı ve kartınızdan para çekilmedi. Sepetiniz duruyor, tekrar deneyebilirsiniz.",
  "payment_failed.button": "Sepete dön",
  "payment_failed.note":
    "Sorun devam ederse farklı bir kart ya da ödeme yöntemi deneyin veya bankanızla görüşün.",
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
