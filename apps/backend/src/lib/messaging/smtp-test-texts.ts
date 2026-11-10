/**
 * The test e-mail the panel sends through the shop's own mail server
 * (adr/0036 Ek 2026-11-10), to the staff member who asked. Part of the
 * message catalog (`texts.ts`).
 */
export const SMTP_TEST_TEXTS: Readonly<Record<string, string>> = {
  "smtp_test.subject": "{{shop}} e-posta gönderimi çalışıyor",
  "smtp_test.preheader": "Bu e-posta mağazanızın kendi e-posta sunucusundan gönderildi.",
  "smtp_test.heading": "E-posta gönderimi çalışıyor",
  "smtp_test.intro":
    "Bu e-postayı {{shop}} yönetim panelinden istediniz. Mağazanızın e-postaları ({{from}} adresinden) artık kendi e-posta sunucunuz üzerinden gidiyor.",
  "smtp_test.spam":
    "Bu e-posta istenmeyen (spam) klasörüne düştüyse, alan adınızın SPF, DKIM ve DMARC kayıtlarını Ayarlar > Bildirimler'deki uyarılara göre tamamlayın.",
  "footer.smtp_test": "Bu e-posta, {{shop}} yönetim panelinde deneme gönderimi için gönderildi.",
}
