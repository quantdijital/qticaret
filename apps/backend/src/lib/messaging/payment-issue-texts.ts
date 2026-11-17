/**
 * What the shop's payment-trouble e-mail says (adr/0026 Ek 2026-11-06,
 * security review 2026-11-09). Part of the message catalog (`texts.ts`).
 */
export const PAYMENT_ISSUE_TEXTS: Readonly<Record<string, string>> = {
  "staff_payment_issue.completion_stuck.subject":
    "Ödenen sepet siparişe dönüşemiyor ({{reference}})",
  "staff_payment_issue.completion_stuck.intro":
    "{{provider}} ödemesi alındı, ancak sipariş defalarca açılamadı. Otomatik olarak denenmeye devam ediyor; ödeme iade edilmedi. Stok ve depo ayarlarını kontrol edin; sipariş açılamayacaksa ödemeyi {{provider}} panelinden iade edin.",
  "staff_payment_issue.refunded_before_order.subject":
    "İade edilmiş ödeme siparişe dönüştürülmedi ({{reference}})",
  "staff_payment_issue.refunded_before_order.intro":
    "{{provider}} bu ödemeyi iade edilmiş gösteriyor; bu yüzden sipariş açılmadı. İadeyi siz yapmadıysanız {{provider}} panelinden kontrol edin.",
  "staff_payment_issue.shelf_restored.subject": "Geçici stok düzeltmesi geri alındı ({{cart}})",
  "staff_payment_issue.shelf_restored.intro":
    "Ödemesi alınan bir sipariş için stok geçici olarak artırılmıştı; işlem yarıda kaldığı için artış geri alındı. Stok sayılarını ve bu sepetin siparişini kontrol edin.",
  "staff_payment_issue.wholesale_price_check.subject":
    "Toptan sepetin ödemesi başlatılamadı ({{cart}})",
  "staff_payment_issue.wholesale_price_check.intro":
    "Bir toptancının sepeti, ödeme başlarken toptancının bugünkü fiyatlarına getirilemedi; ödeme başlatılmadı ve para alınmadı. Bu sepetteki ürünlerin toptan ve perakende fiyatlarını kontrol edin.",
  "staff_payment_issue.payment_beside_order.subject":
    "Siparişi olan sepete ikinci ödeme ({{reference}})",
  "staff_payment_issue.payment_beside_order.intro":
    "Bu sepet başka bir ödemeyle zaten siparişe dönüşmüştü; {{provider}} bu ödemeyi de aldı. Otomatik iade yapılmadı. Müşterinin iki kez ödeyip ödemediğini kontrol edin; öyleyse fazla ödemeyi {{provider}} panelinden iade edin.",
  "staff_payment_issue.refund_incomplete.subject":
    "İade yapıldı, kaydı yarım kaldı ({{reference}})",
  "staff_payment_issue.refund_incomplete.intro":
    'Sipariş {{cart}} için bu iade {{provider}} tarafında yapıldı ya da yapılmış olabilir, ancak kaydı tamamlanamadı. İade kaydı "sürüyor" durumunda tutuldu ve kalemleri iade edilmiş sayılıyor, böylece aynı para yeniden gönderilmez. Kayıt otomatik olarak denetleniyor; bir saat sonra hâlâ yarımsa {{provider}} panelinden iadeyi kontrol edin. Aynı iadeyi yeniden yapmayın.',
  "staff_payment_issue.refund_unresolved.subject":
    "Bir iade bir saattir doğrulanamadı ({{reference}})",
  "staff_payment_issue.refund_unresolved.intro":
    "Sipariş {{cart}} için bu iadenin kaydı otomatik denetimde tamamlanamadı. Sipariş sayfasındaki iadeyi ödeme kuruluşunun kaydıyla karşılaştırın; aynı iadeyi yeniden yapmayın.",
  "staff_payment_issue.cancel_refund_order_open.subject":
    "İptal iadesi tamamlandı ama sipariş iptal edilmedi ({{cart}})",
  "staff_payment_issue.cancel_refund_order_open.intro":
    "Sipariş {{cart}} için iptal iadesi yapıldı ve kaydı otomatik denetimde tamamlandı, ancak sipariş hâlâ iptal edilmedi. Siparişi iptal edin; kargolamayın.",
  "staff_payment_issue.preheader": "Ödeme: {{provider}}, referans {{reference}}.",
  "staff_payment_issue.heading": "Bir ödeme ilgi bekliyor",
  "staff_payment_issue.provider": "Ödeme kuruluşu",
  "staff_payment_issue.reference": "Referans",
  "staff_payment_issue.cart": "Sepet",
  "staff_payment_issue.order": "Sipariş",
  "staff_payment_issue.amount": "Tutar",
}
