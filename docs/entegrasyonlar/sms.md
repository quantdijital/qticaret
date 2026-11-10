# Bildirimler: SMS ve E-posta

## Provider'lar
- `notification-email`: Resend; dev'de Mailpit'in HTTP gönderim ucu (SMTP kütüphanesi yok)
- `notification-sms`: Netgsm (veya benzeri); provider deseniyle değiştirilebilir

## Kanallar
Medusa Notification modülünde kanal başına bir provider (email, sms).

## Şablonlar
- E-posta: kendi şablonlarımız (bağımlılıksız, kaçışlı tablo HTML + düz metin); marka bilgisi `platform-settings`'ten
- SMS: kısa, i18n anahtarlı; 160 karakter hedef, Türkçe karakter kodlamasına dikkat (karakter sayısı/maliyet)
- Mağaza müşteri iletilerinin metnini panelden değiştirebilir (adr/0036 Ek 2026-11-10): düz metin, şablonun sabit `{belirteç}` listesi, SMS örnek değerlerle en çok 3 parça (`encoding=TR` sayımı; ş ğ ı İ ç iki birim, alfabe dışı karakter UCS-2'ye düşürür). Zorunlu iletiler (sipariş onayı, fatura, şifre, doğrulama…) kapatılamaz.

## İşlemsel vs ticari
- İşlemsel (sipariş, kargo, şifre): izin gerekmez.
- Ticari (kampanya): İYS izni zorunlu; `messaging` modülünden kontrol edilir, izin yoksa gönderim engellenir ve loglanır.

## Env ve hesaplar (ADR-0036)
- E-posta platformun: `EMAIL_TRANSPORT` (`resend` ya da geliştirmede `mailpit`), `EMAIL_FROM`, `RESEND_API_KEY`, `MAILPIT_URL`.
- SMS mağazanın: Netgsm kullanıcı kodu, şifre ve gönderici başlığı panelden girilir (`integration-credentials` `netgsm`, ADR-0027); env'de değil.
