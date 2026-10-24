# ADR-0006: Yerel S3 emülatörü (SeaweedFS) ve geliştirme imajlarının sabitlenmesi

- **Durum:** Kabul
- **Tarih:** 2026-10-24

## Bağlam
docs/03 F0.3 yerel S3 için MinIO öngörüyordu. MinIO Community Edition ise:
- Ekim 2025'te ikili dosya ve Docker imajı yayınlamayı bıraktı.
- Nisan 2026'da arşivlendi.
- Eylül 2026'da Docker Hub imajlarını kaldırdı.

Bakımı olmayan bir yazılım güvenlik tabanımıza (docs/04) uymuyor. Yerel ortamda yalnızca S3 uyumluluğu gerekiyor (Medusa file-s3 provider'ı F3'te bağlanacak). Prod'da bulut S3 kullanılacak (adr/0003).

## Karar
- Yerel S3 için **SeaweedFS** (`chrislusf/seaweedfs`, Apache-2.0) kullanılıyor: `weed mini` tek süreç, sürüm 4.48.
  - Kimlikler açılışta env'den üretilen bir JSON'dan okunuyor.
  - `anonymous` kimliğinin yalnızca `Read` izni var. Böylece yüklenen dosyalar public-read bir bucket gibi URL ile okunabiliyor; anonim yazma ve listeleme reddediliyor (403, doğrulandı).
  - `qticaret` bucket'ı açılışta oluşturuluyor (`-bucket`).
  - Admin UI ve filer portları dışarı açılmıyor; yalnızca S3 portu `127.0.0.1:58333`'e bağlı.
- Geliştirme imajlarının hepsi `tag@sha256:digest` ile sabitleniyor.
  - Üçüncü parti imajlarda (Mailpit, SeaweedFS) en az 14 günlük sürüm seçiliyor.
  - Resmi imajlar (postgres, redis) aynı sürüm numarasıyla Alpine yamaları için sık yeniden derleniyor. Bu yüzden 14 gün kuralı imajın içindeki yazılım sürümüne (PostgreSQL 16.15, Redis 7.4.11) uygulanıyor ve o anki digest sabitleniyor.
- Digest güncellemeleri F0.8'de Renovate ile PR olarak gelecek.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **SeaweedFS** | Olgun (12 yıl), aktif, Apache-2.0, tek container, geniş S3 kapsamı | Web konsolu MinIO kadar rahat değil |
| Garage | Hafif, kararlı (v1+) | AGPL; layout ve anahtar için ek bootstrap; S3 kapsamı dar |
| RustFS | MinIO'ya en yakın deneyim | Alpha/beta; kararlılık sinyalleri tutarsız |
| Chainguard MinIO imajı | Değişiklik gerektirmez | Arşivlenmiş yazılım; upstream güvenlik düzeltmesi yok |

## Sonuçlar
- F3.3'te Medusa file-s3 provider'ı SeaweedFS'e karşı test edilecek. Multipart upload ve presigned URL davranışı orada doğrulanacak. Env değişkenleri (`S3_*`) şimdiden `apps/backend/env.example`'da.
- Prod S3 sağlayıcısı adr/0003 ile seçilecek. SeaweedFS'e özgü bir davranışa bağımlı kod yazılmayacak.
