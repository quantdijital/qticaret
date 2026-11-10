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
  // Security review 2026-11-10: the server refusing too many recipients
  "staff_smtp_rejections.subject": "{{shop}}: e-posta sunucunuz alıcıları reddediyor",
  "staff_smtp_rejections.preheader":
    "Son {{minutes}} dakikada {{sends}} e-postanın {{rejections}} tanesi reddedildi.",
  "staff_smtp_rejections.heading": "E-posta sunucunuz alıcıları reddediyor",
  "staff_smtp_rejections.intro":
    "Son {{minutes}} dakikada {{sends}} e-postanın {{rejections}} tanesi, sunucu alıcı adresinin olmadığını söylediği için gitmedi. Bu kadar çok ret çoğunlukla sunucu ayarı sorunudur; bu yüzden bu adresler bir saat boyunca gönderilmeyenler listesine yazılmıyor, az önce yazılanlar da geri alındı.",
  "staff_smtp_rejections.next":
    "Sunucunuzun e-posta ayarlarını kontrol edin, sonra Ayarlar > E-posta ve SMS > E-posta'dan deneme e-postası gönderin.",
}
