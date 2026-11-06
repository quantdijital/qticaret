import type { MessageLocale } from "../errors/messages"
import { RETURN_TEXTS } from "./return-texts"
import { STAFF_ACCOUNT_TEXTS } from "./staff-account-texts"

/**
 * What messages say, by key (adr/0036; CLAUDE.md rule 9): templates take
 * their words from here, with `{{name}}` filled in as plain text. The
 * layout escapes everything. One language until F19. A return request's
 * texts live in `return-texts.ts`.
 */

export const MESSAGE_LOCALE: MessageLocale = "tr"

const TR: Readonly<Record<string, string>> = {
  ...RETURN_TEXTS,
  ...STAFF_ACCOUNT_TEXTS,
  "footer.unsubscribe": "Bu iletileri almak istemiyorum",
  "footer.stock": "Bu e-postayı, {{shop}} mağazasında stok bildirimi istediğiniz için aldınız.",
  "footer.order": "Bu e-posta, {{shop}} mağazasındaki siparişiniz için gönderildi.",
  "footer.account": "Bu e-posta, {{shop}} hesabınız için gönderildi.",
  "footer.gift_card":
    "Bu e-posta, {{shop}} mağazasında sizin için alınan bir hediye kartı için gönderildi.",
  "gift_card.subject": "{{shop}} hediye kartınız",
  "gift_card.subject_from": "{{sender}} size bir {{shop}} hediye kartı gönderdi",
  "gift_card.preheader": "Kodunuz bu e-postada; {{shop}} alışverişlerinizde kullanabilirsiniz.",
  "gift_card.heading": "{{name}}, size bir hediye kartı var",
  "gift_card.greeting": "Merhaba",
  "gift_card.intro": "{{shop}} mağazasında kullanabileceğiniz hediye kartınız aşağıda.",
  "gift_card.intro_from":
    "{{sender}}, {{shop}} mağazasında kullanabileceğiniz bir hediye kartı gönderdi.",
  "gift_card.message": "Mesaj",
  "gift_card.card": "{{value}} değerinde hediye kartı",
  "gift_card.how_to":
    "Ödeme adımında hediye kartı alanına kodu yazın; tutar siparişinizden düşülür. Kartın son kullanma tarihi yoktur, kalan bakiyeyi sonraki alışverişlerinizde kullanabilirsiniz.",
  "gift_card.shop": "Alışverişe başla",
  "gift_card.keep_safe": "Kodu kimseyle paylaşmayın: kodu bilen herkes kartı kullanabilir.",
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
  "staff_contact.subject": "Yeni iletişim mesajı: {{subject}}",
  "staff_contact.preheader": "Vitrinin iletişim formundan yeni mesaj var.",
  "staff_contact.heading": "Yeni iletişim mesajı",
  "staff_contact.intro":
    'İletişim formundan "{{subject}}" konusunda yeni mesaj geldi. Bekleyen mesajları panelde Müşteriler > İletişim mesajları\'nda okuyup yanıtlayın; gönderen ve mesaj güvenlik için e-postaya konmaz. Bu e-posta en çok 10 dakikada bir gider.',
  "staff_contact.subjects.order": "Sipariş",
  "staff_contact.subjects.product": "Ürün",
  "staff_contact.subjects.return": "İade ve değişim",
  "staff_contact.subjects.payment": "Ödeme",
  "staff_contact.subjects.kvkk": "KVKK başvurusu",
  "staff_contact.subjects.other": "Diğer",
  "staff_contact.kvkk_preheader": "KVKK başvurusu: yanıt için son gün {{due}}.",
  "staff_contact.kvkk_due":
    "Bu bir KVKK başvurusu. Kanun en geç 30 gün içinde yanıt vermenizi ister (KVKK md. 13); son gün {{due}}. Başvuranın kimliğini doğrulayın. Başvuru bir müşteri hesabına aitse talebi o müşterinin KVKK talepleri bölümüne de kaydedin.",
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
  "campaign.test_subject": "[Deneme] {{subject}}",
  "campaign.test_sms": "[Deneme] {{text}}",
  "campaign.mersis": "MERSİS {{mersis}}",
  "announcement.button": "Mağazaya git",
  "announcement.sms": "{{shop}}: {{title}} {{body}} Ret için mağazayla iletişime geçin.",
  "order.subtotal": "Ara toplam",
  "order.shipping": "Kargo",
  "order.discount": "İndirim",
  "order.total": "Toplam",
  "order.address": "Teslimat adresi",
  "order.view": "Siparişi görüntüle",
  // A line's add-on picks (adr/0052 §9), under the line
  "order.addon": "{{label}}: {{value}}",
  "order.addon_paid": "{{label}}: {{value}} (+{{amount}})",
  "order.non_withdrawable": "Kişiye özel ürün: cayma hakkı yok",
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
  "order_invoiced.subject": "Faturanız hazır (#{{number}})",
  "order_invoiced.preheader": "{{shop}} siparişinizin faturası kesildi.",
  "order_invoiced.heading": "Merhaba {{name}}, faturanız hazır",
  "order_invoiced.intro":
    "#{{number}} numaralı siparişinizin {{document}} faturası {{invoice}} numarasıyla kesildi. Faturanızı sipariş sayfanızdan indirebilirsiniz.",
  "order_invoiced.button": "Faturayı görüntüle",
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
  "order_placed.contracts":
    "Onayladığınız mesafeli satış sözleşmesi ve ön bilgilendirme formu sipariş sayfanızda; istediğiniz zaman açıp kaydedebilirsiniz.",
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
  "staff_reset.subject": "{{shop}} paneli şifrenizi yenileyin",
  "staff_reset.preheader": "{{shop}} yönetim paneli için şifre yenileme bağlantısı.",
  "staff_reset.heading": "Şifre yenileme isteği",
  "staff_reset.intro":
    "{{shop}} yönetim panelindeki hesabınız için şifre yenileme isteği aldık. Aşağıdaki bağlantı 15 dakika geçerlidir.",
  "staff_reset.button": "Şifremi yenile",
  "staff_reset.ignore": "Bu isteği siz yapmadıysanız e-postayı yok sayın; şifreniz değişmez.",
  "staff_mfa.subject.enabled": "{{shop}} panelinde iki adımlı doğrulama açıldı",
  "staff_mfa.subject.disabled": "{{shop}} panelinde iki adımlı doğrulama kapatıldı",
  "staff_mfa.subject.reset": "{{shop}} panelinde iki adımlı doğrulamanız sıfırlandı",
  "staff_mfa.heading": "Hesabınızın güvenlik ayarı değişti",
  "staff_mfa.intro.enabled":
    "{{shop}} yönetim panelindeki hesabınızda iki adımlı doğrulama açıldı. Girişte artık uygulamanızdaki kod da istenecek.",
  "staff_mfa.intro.disabled":
    "{{shop}} yönetim panelindeki hesabınızda iki adımlı doğrulama kapatıldı.",
  "staff_mfa.intro.reset":
    "{{shop}} mağazasının sahibi, yönetim panelindeki hesabınızın iki adımlı doğrulamasını sıfırladı. Bir sonraki girişte yeniden kurmanız istenebilir.",
  "staff_mfa.not_you":
    "Bunu siz yapmadıysanız ya da istemediyseniz hemen şifrenizi yenileyin ve mağaza sahibine haber verin.",
  "staff_invite.subject": "{{shop}} ekibine davet edildiniz",
  "staff_invite.preheader": "{{shop}} yönetim paneli için hesabınızı oluşturun.",
  "staff_invite.heading": "{{shop}} yönetim paneline davet",
  "staff_invite.intro":
    "{{shop}} mağazasının yönetim paneline {{role}} olarak davet edildiniz. Hesabınızı oluşturmak için aşağıdaki bağlantıyı kullanın; bağlantı 24 saat geçerlidir.",
  "staff_invite.button": "Daveti kabul et",
  "staff_invite.ignore": "Bu daveti beklemiyorsanız e-postayı yok sayın; hesap açılmaz.",
  "staff_invite.roles.admin": "yönetici",
  "staff_invite.roles.operations": "operasyon görevlisi",
  "staff_invite.roles.readonly": "salt okunur kullanıcı",
  "migration_invite.subject": "{{shop}} yenilendi: hesabınızı açın",
  "migration_invite.preheader": "Önceki siparişleriniz yeni mağazada sizi bekliyor.",
  "migration_invite.heading": "Mağazamız yeni adresinde",
  "migration_invite.intro":
    "{{shop}} yeni altyapısına taşındı. Daha önce alışveriş yaptığınız için hesabınızı burada açmanızı rica ediyoruz.",
  "migration_invite.orders":
    "Hesabınızı aynı e-posta adresiyle açtığınızda önceki siparişleriniz ve adresleriniz hesabınızda görünür.",
  "migration_invite.button": "Hesabımı aç",
  "migration_invite.password":
    "Güvenliğiniz için eski şifreniz taşınmadı; hesabı açarken yeni bir şifre belirleyeceksiniz.",
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
  // adr/0051 §7: a payment link staff made for the customer
  "payment_link.subject": "{{shop}}: siparişiniz hazır ({{number}})",
  "payment_link.preheader": "Toplam {{total}}; ödeme bağlantınız bu e-postada.",
  "payment_link.heading": "Merhaba {{name}}, siparişiniz hazır",
  "payment_link.intro":
    "{{shop}} mağazasında sizin için hazırlanan {{number}} numaralı siparişin kalemleri aşağıda. Ödemeyi bağlantıdan güvenle tamamlayabilirsiniz.",
  "payment_link.discount": "İndirim",
  "payment_link.total": "Toplam",
  "payment_link.button": "Ödemeye geç",
  "payment_link.note":
    "Bağlantı {{validity}} geçerli. Bu siparişi siz istemediyseniz e-postayı yok sayın.",
  "payment_link.sms":
    "{{shop}}: Siparişiniz hazır, toplam {{total}}. Ödeme bağlantısı ({{validity}} geçerli): {{url}}",
  "payment_link.hours": "{{count}} saat",
  "payment_link.days": "{{count}} gün",
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
