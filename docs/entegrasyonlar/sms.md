# Bildirimler: SMS ve E-posta

## Provider'lar
- `notification-email`: Resend/SES; dev'de SMTP → Mailpit
- `notification-sms`: Netgsm (veya benzeri); provider deseniyle değiştirilebilir

## Kanallar
Medusa Notification modülünde kanal başına bir provider (email, sms).

## Şablonlar
- E-posta: React Email; marka bilgisi `platform-settings`'ten
- SMS: kısa, i18n anahtarlı; 160 karakter hedef, Türkçe karakter kodlamasına dikkat (karakter sayısı/maliyet)

## İşlemsel vs ticari
- İşlemsel (sipariş, kargo, şifre): izin gerekmez.
- Ticari (kampanya): İYS izni zorunlu; `legal-consent` modülünden kontrol edilir, izin yoksa gönderim engellenir ve loglanır.

## Env
`EMAIL_PROVIDER`, `RESEND_API_KEY` / SES bilgileri, `EMAIL_FROM`,
`SMS_PROVIDER`, `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER`
