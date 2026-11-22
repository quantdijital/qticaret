/**
 * What a dated order's e-mails say (adr/0076 §8, Ek D7b): the booking's
 * confirmation with its voucher, the reminder before a departure, a
 * departure cancelled by the shopper or staff, and one the shop called
 * off. Part of the message catalog (`texts.ts`).
 */
export const BOOKING_TEXTS: Readonly<Record<string, string>> = {
  "booking_confirmed.subject": "Rezervasyonunuz onaylandı #{{number}}",
  "booking_confirmed.preheader": "Kalkış bilgileri, iptal koşulları ve voucher bu e-postada.",
  "booking_confirmed.heading": "{{name}}, rezervasyonunuz onaylandı",
  "booking_confirmed.intro":
    "#{{number}} numaralı siparişinizdeki rezervasyon {{shop}} tarafından onaylandı. Kalkış bilgileri aşağıda; voucher'ınızı yazdırabilir ya da telefonunuzda gösterebilirsiniz.",
  "booking_confirmed.voucher": "Voucher'ı aç",
  "booking_confirmed.voucher_note":
    "Voucher üzerindeki doğrulama kodunu kimseyle paylaşmayın; kalkışta görevliye gösterin.",
  "booking.departure": "{{title}}",
  "booking.when": "Kalkış: {{when}}",
  "booking.meeting_point": "Buluşma yeri: {{place}}",
  "booking.units": "Katılımcı: {{count}} kişi",
  "booking.terms_title": "İptal koşulları",
  "booking.term_free": "Kalkıştan {{days}} gün ve daha önce: kesinti yok",
  "booking.term_fee": "Kalkıştan {{days}} gün ve daha önce: %{{percent}} kesinti",
  "booking.term_free_today": "Kalkış gününe kadar: kesinti yok",
  "booking.term_fee_today": "Kalkış gününe kadar: %{{percent}} kesinti",
  "booking.terms_none":
    "Bu rezervasyon hesabınızdan iptal edilemez; değişiklik için mağazayla iletişime geçin.",
  "booking.terms_how": "İptali sipariş sayfanızdan yapabilirsiniz; iade tutarı orada gösterilir.",
  "booking_reminder.subject": "Kalkışınız yaklaşıyor: {{when}}",
  "booking_reminder.preheader": "#{{number}} numaralı siparişinizin kalkış bilgileri.",
  "booking_reminder.heading": "{{name}}, kalkışınız yaklaşıyor",
  "booking_reminder.intro":
    "{{shop}} ile rezervasyonunuzu hatırlatmak isteriz. Kalkış bilgileri aşağıda; voucher'ınızı yanınızda bulundurun.",
  "booking_cancelled.subject": "Rezervasyonunuz iptal edildi #{{number}}",
  "booking_cancelled.preheader": "İptal edilen kalkış ve iade bilgisi bu e-postada.",
  "booking_cancelled.heading": "{{name}}, rezervasyonunuz iptal edildi",
  "booking_cancelled.intro":
    "#{{number}} numaralı siparişinizdeki aşağıdaki kalkış iptal edildi ve yeriniz serbest bırakıldı.",
  "booking_departure_cancelled.subject": "Kalkış iptal edildi #{{number}}",
  "booking_departure_cancelled.preheader": "Ödediğiniz tutarın tamamı iade ediliyor.",
  "booking_departure_cancelled.heading": "{{name}}, kalkış iptal edildi",
  "booking_departure_cancelled.intro":
    "Üzgünüz, {{shop}} aşağıdaki kalkışı iptal etti. Bu kalkış için ödediğiniz tutarın tamamı iade ediliyor; sizin bir şey yapmanız gerekmiyor.",
  "booking.refund": "İade tutarı: {{amount}}",
  "booking.refund_card":
    "İade ödeme yaptığınız karta gönderildi; bankanıza göre hesabınıza geçmesi birkaç iş günü sürebilir.",
  "booking.refund_none": "Bu kalkış için iade edilecek bir tutar yok.",
  "booking.refund_by_hand":
    "Ödemeniz kart dışında bir yolla alındığından iade mağaza tarafından ayrıca yapılacak; mağaza sizinle iletişime geçecek.",
  "booking.view_order": "Siparişi görüntüle",
}
