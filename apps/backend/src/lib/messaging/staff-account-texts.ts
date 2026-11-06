/**
 * What a staff member's own account messages say (the owner, 2026-11-06):
 * a new login address to confirm, and the notices that their password or
 * address changed. Part of the message catalog (`texts.ts`).
 */
export const STAFF_ACCOUNT_TEXTS: Readonly<Record<string, string>> = {
  "footer.staff_account":
    "Bu e-posta, {{shop}} yönetim panelindeki hesabınızın güvenliği için gönderildi.",
  "staff_email_confirm.subject": "{{shop}} panelinde yeni e-posta adresinizi onaylayın",
  "staff_email_confirm.preheader": "Onaylayınca panele bu adresle giriş yaparsınız.",
  "staff_email_confirm.heading": "Yeni e-posta adresinizi onaylayın",
  "staff_email_confirm.intro":
    "{{shop}} yönetim panelindeki hesabınızın giriş adresini bu adres olarak değiştirmek istediniz. Onaylayana kadar eski adresiniz geçerli kalır; bağlantı 24 saat geçerlidir ve bir kez kullanılır.",
  "staff_email_confirm.button": "Adresimi onayla",
  "staff_email_confirm.ignore":
    "Bu isteği siz yapmadıysanız e-postayı yok sayın; hiçbir şey değişmez.",
  "staff_account.heading": "Hesabınızın giriş bilgisi değişti",
  "staff_account.subject.password": "{{shop}} panelinde şifreniz değiştirildi",
  "staff_account.intro.password":
    "{{shop}} yönetim panelindeki hesabınızın şifresi değiştirildi. Diğer cihazlardaki açık oturumlarınız kapatıldı.",
  "staff_account.subject.email_requested": "{{shop}} panelinde e-posta adresi değişikliği istendi",
  "staff_account.intro.email_requested":
    "{{shop}} yönetim panelindeki hesabınızın giriş adresinin {{address}} olarak değiştirilmesi istendi. Yeni adres onaylanana kadar bu adres geçerli kalır.",
  "staff_account.subject.email_changed": "{{shop}} panelinde e-posta adresiniz değişti",
  "staff_account.intro.email_changed":
    "{{shop}} yönetim panelindeki hesabınızın giriş adresi {{address}} olarak değiştirildi. Panele artık bu adresle giriş yapılır.",
  "staff_account.not_you":
    "Bunu siz yapmadıysanız hemen şifrenizi yenileyin ve mağaza sahibine haber verin.",
}
