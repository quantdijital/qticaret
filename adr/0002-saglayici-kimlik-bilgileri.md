# ADR-0002: Sağlayıcı kimlik bilgilerinin yönetimi

- **Durum:** Yerini aldı (ADR-0027, 2026-10-27). Kullanıcı aynı gün F5 V1'in başında sağlayıcı hesap bilgilerinin panelden girilmesini istedi; mağazanın sağlayıcı hesapları artık `integration-credentials` modülünde şifreli. Platformun kendi sırları env'de kalır.
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

## Ek (2026-10-30, F12 Y6): Entegrasyonlar sayfası ve son hatalar
- Hesap bilgileri artık panelden giriliyor (ADR-0027); bu ADR'nin "secret göstermez" kuralı sürüyor: sayfa yalnızca durumu, canlı yanıtı, son hataları ve bağlantı testini gösterir.
- **Durum:** `GET /admin/integrations/overview` her servisin durumunu kendi kaydından okur, hiçbir sağlayıcıyı çağırmaz. Durumlar: `connected`, `attention`, `not_set_up`, `off`; nedenler kod olarak gelir (test modu, doğrulanmamış ya da reddedilmiş hesap, doğrulanmamış alan adı, durmuş muhasebe kayıtları...). Canlı yanıt sağlık raporundan gelir; yanıt alınamıyorsa rozet "Yanıt yok" olur.
- **Son hatalar:** Ortak HTTP istemcisi (`lib/clients`) vazgeçtiği her çağrıyı sağlayıcı başına bir listeye yazar.
  - Yer ve süre: Redis'te, bütün sunucular için ortak; sağlayıcı başına son 20 kayıt, 30 gün. Testte ve Redis yokken süreç belleğinde.
  - İçerik: günlük satırındaki kadar (zaman, kod, HTTP durumu, yöntem, yol, istek kimliği). Gövde, başlık, sorgu ve hata metni yok.
  - Yazılmayanlar: sağlayıcının istenen şey hakkındaki yanıtları (404, 409, 422), çağıranın vazgeçmesi ve adres reddi. 400, 401, 403, 429, 5xx, zaman aşımı, bağlantı ve beklenmeyen yanıt hataları yazılır.
  - Yazma çağrıyı bekletmez ve bozmaz.
- **Erişim:** Sayfa ve uç yalnızca sahip ve yöneticiye açıktır (ADR-0040; operasyon ve salt-okunur görmez). Bağlantı testi mevcut `POST /admin/integrations/credentials/:provider/check` ile yapılır.
