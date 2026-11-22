import {
  bookingCancelled,
  bookingConfirmed,
  bookingDepartureCancelled,
  bookingReminder,
} from "../templates/booking"
import type { Brand } from "../templates/types"

const BRAND: Brand = {
  shopName: "Örnek Tur",
  logoUrl: null,
  color: "#123456",
  contactEmail: null,
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

describe("a dated order's e-mails (adr/0076 Ek D7b)", () => {
  it("confirms with the departure, meeting point, places, terms and the voucher's link", () => {
    const email = bookingConfirmed.email?.(bookingConfirmed.sample, BRAND)
    expect(email?.subject).toBe("Rezervasyonunuz onaylandı #1042")
    expect(email?.text).toContain("Kalkış: 12 Mayıs 2027 Çarşamba 08:30")
    expect(email?.text).toContain("Buluşma yeri: Kadıköy iskelesi")
    expect(email?.text).toContain("Katılımcı: 2 kişi")
    expect(email?.text).toContain("Kalkıştan 30 gün ve daha önce: kesinti yok")
    expect(email?.text).toContain("Kalkıştan 7 gün ve daha önce: %50 kesinti")
    expect(email?.text).toContain("Kalkış gününe kadar: %100 kesinti")
    expect(email?.html).toContain("/voucher?token=ornek")
  })

  it("says there is no cancel from the account when the product has no tier", () => {
    const email = bookingConfirmed.email?.({ ...bookingConfirmed.sample, terms: [] }, BRAND)
    expect(email?.text).toContain("hesabınızdan iptal edilemez")
  })

  it("reminds with the departure in its subject and no terms", () => {
    const email = bookingReminder.email?.(bookingReminder.sample, BRAND)
    expect(email?.subject).toBe("Kalkışınız yaklaşıyor: 12 Mayıs 2027 Çarşamba 08:30")
    expect(email?.text).not.toContain("İptal koşulları")
  })

  it("tells a cancel's refund, or that the shop gives it back by hand", () => {
    const sent = bookingCancelled.email?.(bookingCancelled.sample, BRAND)
    expect(sent?.text).toContain("İade tutarı: ₺4.500,00")
    const byHand = bookingCancelled.email?.(
      { ...bookingCancelled.sample, refund: null, byHand: true },
      BRAND
    )
    expect(byHand?.text).toContain("iade mağaza tarafından ayrıca yapılacak")
    expect(byHand?.text).not.toContain("İade tutarı")
    const none = bookingCancelled.email?.({ ...bookingCancelled.sample, refund: null }, BRAND)
    expect(none?.text).toContain("iade edilecek bir tutar yok")
  })

  it("tells a departure the shop called off that everything comes back", () => {
    const email = bookingDepartureCancelled.email?.(bookingDepartureCancelled.sample, BRAND)
    expect(email?.subject).toBe("Kalkış iptal edildi #1042")
    expect(email?.text).toContain("tamamı iade ediliyor")
    expect(email?.text).toContain("İade tutarı: ₺9.000,00")
  })

  it("keeps the voucher's words and button while the shop has vouchers (the default)", () => {
    const email = bookingConfirmed.email?.(bookingConfirmed.sample, BRAND)
    expect(email?.text).toContain("voucher'ınızı yazdırabilir")
    expect(email?.text).toContain("Voucher'ı aç")
    expect(email?.text).toContain("İptali sipariş sayfanızdan yapabilirsiniz")
    expect(email?.text).not.toContain("telefon veya e-posta ile iletişime geçeceğiz")
  })

  it("without vouchers: no button nor word of one, the shop's note in its place (Ek basit yol)", () => {
    const simple = { ...bookingConfirmed.sample, voucherUrl: null, voucherOffNote: "" }
    const email = bookingConfirmed.email?.(simple, BRAND)
    expect(email?.text).not.toMatch(/voucher/i)
    expect(email?.html).not.toContain("/voucher")
    expect(email?.text).toContain(
      "Rezervasyon ayrıntıları için sizinle telefon veya e-posta ile iletişime geçeceğiz."
    )
    expect(email?.text).toContain("Siparişi görüntüle")
    const own = bookingConfirmed.email?.(
      { ...simple, voucherOffNote: "Kalkıştan bir gün önce sizi arayacağız." },
      BRAND
    )
    expect(own?.text).toContain("Kalkıştan bir gün önce sizi arayacağız.")
    expect(own?.text).not.toContain("iletişime geçeceğiz")
    const reminder = bookingReminder.email?.({ ...bookingReminder.sample, ...simple }, BRAND)
    expect(reminder?.text).not.toMatch(/voucher/i)
  })

  it("sends the shopper to the shop for a cancel while online cancel is off", () => {
    const email = bookingConfirmed.email?.(
      { ...bookingConfirmed.sample, onlineCancel: false },
      BRAND
    )
    expect(email?.text).not.toContain("İptali sipariş sayfanızdan yapabilirsiniz")
    expect(email?.text).toContain("İptal ve değişiklik için mağazayla telefon ya da e-postayla")
  })

  it("are e-mail only, sent again from their resource, and the reminder alone may be turned off", () => {
    for (const template of [bookingConfirmed, bookingReminder, bookingCancelled]) {
      expect(template.channels).toEqual(["email"])
      expect(template.retry).toBe(true)
    }
    expect(bookingReminder.editable?.required).toBe(false)
    expect(bookingConfirmed.editable?.required).toBe(true)
    expect(bookingDepartureCancelled.editable?.required).toBe(true)
  })
})
