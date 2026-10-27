# ADR-0002: Sağlayıcı kimlik bilgilerinin yönetimi

- **Durum:** Kabul edildi (2026-10-27, F5 planlaması; kullanıcının kalıcı "önerileni uygula" talimatıyla, PROGRESS "Gözden geçir" listesinde). F0–F4 bu kararla yazıldı; ilk sağlayıcı anahtarları F5'te (PayTR) bu yolla gelir.
- **Tarih:** 2026-10-27

## Bağlam
Her tenant kendi iyzico/PayTR/Geliver/e-fatura hesabını kullanır. Medusa module provider'ları izoledir:
kendi modüllerinin container'ı dışındaki özel modüllere (ör. bir settings modülü) erişemez.
Ayrıca secret'ların uygulama DB'sinde tutulması saldırı yüzeyini büyütür.

## Karar
- Sağlayıcı kimlik bilgileri instance'a **ortam değişkeni / secret** olarak enjekte edilir; provider'lar options/env'den okur.
- Doğruluk kaynağı: secret store (F17'de Control Plane arayüzüyle yönetilir; öncesinde provisioning script'i).
- Anahtar değişikliği → secret güncelle → rolling restart.
- Instance admin'indeki "Entegrasyonlar" sayfası secret göstermez/düzenlemez; durum, bağlantı testi ve son hata gösterir.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Admin'den girilip DB'de şifreli saklama | Anlık değişiklik | Provider izolasyonuyla çatışır; DB sızıntısında anahtarlar risk altında |
| **Env/secret store + restart** | Basit, güvenli, Medusa ile uyumlu | Değişiklik restart gerektirir |

## Sonuçlar
- F17 Control Plane'de tenant'ın anahtar girdiği güvenli bir form gerekir.
- Provider'lar açılışta anahtar formatını ve sandbox/prod tutarlılığını doğrular.
