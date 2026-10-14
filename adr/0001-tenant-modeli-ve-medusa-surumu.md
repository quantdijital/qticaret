# ADR-0001: Tenant modeli ve Medusa sürümü

- **Durum:** Önerildi (F0.2'de Medusa sürümü doğrulanıp kabul edilecek)
- **Tarih:** —

## Bağlam
Platform birden çok bağımsız mağazaya hizmet verecek. Medusa v2 tek mağaza varsayımıyla tasarlanmıştır.

## Karar
- **Instance-per-tenant:** Her tenant'a ayrı Medusa server + worker ve ayrı PostgreSQL veritabanı.
- **Medusa sürümü:** v2'nin güncel kararlı sürümü — F0.2'de Context7 ile doğrulanıp buraya yazılır: `@medusajs/medusa@<X.Y.Z>`.
- Sürüm sabitlenir (exact), yükseltmeler ayrı PR + canary tenant ile yapılır.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Tek instance, multi-store/sales-channel | Düşük altyapı maliyeti | Veri izolasyonu zayıf, KVKK riski, özel geliştirme yükü |
| Tek DB, tenant_id kolonu | Ölçek verimliliği | Medusa çekirdeğiyle çatışma, sızıntı riski |
| **Instance-per-tenant** | İzolasyon, basit yedek, Medusa ile uyum | Tenant başına kaynak maliyeti, sürüm yayma otomasyonu gerekir |

## Sonuçlar
- F11'de provisioning otomasyonu zorunlu.
- Tenant sayısı arttığında kaynak optimizasyonu yeni ADR ile değerlendirilecek.
