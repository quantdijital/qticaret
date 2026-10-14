# 01 — Mimari

## Genel görünüm
```
                ┌──────────────── Control Plane (F12) ────────────────┐
                │  tenant kayıt, abonelik, secret yönetimi, provisioning │
                └───────────────┬─────────────────────────────────────┘
                                │ provision / deploy / secret inject
     ┌──────────────────────────┼──────────────────────────┐
     ▼                          ▼                          ▼
┌─────────────┐          ┌─────────────┐            ┌─────────────┐
│ Tenant A    │          │ Tenant B    │    ...     │ Tenant N    │
│ Medusa API  │          │ Medusa API  │            │ Medusa API  │
│ Medusa Worker│         │ Medusa Worker│           │ Medusa Worker│
│ Admin       │          │ Admin       │            │ Admin       │
│ Postgres DB │          │ Postgres DB │            │ Postgres DB │
└──────┬──────┘          └─────────────┘            └─────────────┘
       │  ortak: Redis (namespace'li) veya tenant başına, obje depolama (bucket/prefix)
       ▼
 iyzico · PayTR · Geliver · e-fatura entegratörü · SMS · e-posta
```

## Tenant modeli: instance-per-tenant
Her tenant = ayrı Medusa süreçleri + ayrı veritabanı. Gerekçe: izolasyon, KVKK, basit yedek/geri yükleme,
bir tenant'ın yükünün diğerini etkilememesi, Medusa'nın tek-mağaza varsayımıyla uyum. (adr/0001)
İleride tenant sayısı yüzleri bulursa paylaşımlı-kaynak optimizasyonu ayrı ADR ile değerlendirilir.

## Sağlayıcı kimlik bilgileri (önemli)
Medusa module provider'ları izoledir; özel bir "settings" modülünü çağıramaz. Bu yüzden:
- Tenant'ın iyzico/PayTR/Geliver/e-fatura anahtarları **instance ortam değişkenleri/secret** olarak enjekte edilir.
- Kaynak doğruluk noktası: Control Plane'deki şifreli secret deposu. Tenant anahtarını oradan girer,
  provisioning servisi secret'ı günceller ve instance'ı rolling restart eder.
- Instance içindeki admin'de **"Entegrasyonlar" sayfası** anahtarları göstermez; sadece durum,
  "bağlantıyı test et" ve son hata bilgisini gösterir. (adr/0002)
- F12 öncesinde (control plane yokken) secret'lar dağıtım aracı üzerinden manuel/script ile girilir.

## Backend katmanları
| Katman | Sorumluluk | Kural |
|---|---|---|
| API route | HTTP, doğrulama, auth | İnce. Workflow çağırır. |
| Workflow | İş akışı, orkestrasyon | Her dış çağrının compensation'ı var. |
| Step | Tek atomik iş | Idempotent olmalı. |
| Module / Service | Veri ve domain mantığı | Başka modülü çağırmaz. |
| Module Provider | Dış servis adaptörü | Arayüze sadık, servis detayı dışarı sızmaz. |
| Subscriber | Event tepkisi | İnce. Workflow tetikler. |
| Scheduled Job | Periyodik iş | Kilitli (tek worker'da çalışır), idempotent. |

## Özel modüller (planlanan)
| Modül | Tür | Amaç |
|---|---|---|
| `payment-iyzico` | Payment provider | iyzico Checkout Form, taksit, iade |
| `payment-paytr` | Payment provider | PayTR iFrame, yedek sağlayıcı |
| `fulfillment-geliver` | Fulfillment provider | Teklif, etiket, takip, iade gönderisi |
| `notification-sms` | Notification provider | Netgsm vb. SMS |
| `notification-email` | Notification provider | Resend/SES |
| `einvoice` | Custom modül + provider deseni | e-Arşiv/e-Fatura, adaptör tabanlı |
| `platform-settings` | Custom modül | Feature flag'ler, mağaza ayarları (secret İÇERMEZ) |
| `product-attributes` | Custom modül | Sektörel attribute şablonları (ör. çelik tipi, beden) |
| `legal-consent` | Custom modül | Sözleşme sürümleri, onay kayıtları, İYS izinleri |
| `audit-log` | Custom modül | Admin işlemlerinin denetim kaydı |
| `tr-address` | Custom modül | İl/ilçe/mahalle referans verisi |

## Sektörden bağımsızlık deseni
- `platform-settings` içinde feature flag'ler: `age_verification`, `engraving_option`, `cash_on_delivery`, ...
- `product-attributes`: şablon (ör. "Kesici Alet", "Giyim") → alan tanımları (tip, birim, zorunluluk, filtrelenebilir mi).
- Kod hiçbir yerde sektör adı kontrol etmez; sadece flag/şablon okur.

## Event akışı (ana senaryo)
```
cart.complete → order.placed
  ├─ subscriber: sipariş bildirimi (e-posta/SMS)
  ├─ subscriber: yasal onay snapshot'ı siparişe bağlanır
order.fulfillment_created → kargo etiketi (Geliver)
shipment tracking webhook → fulfillment güncellemesi → müşteri bildirimi
order.shipped (veya placed; tenant ayarı) → e-arşiv fatura workflow'u
refund → iyzico iade → kısmi ise kalem bazlı → e-arşiv iade/iptal süreci
```

## Altyapı bileşenleri
- PostgreSQL (tenant başına DB), Redis (event bus, workflow engine, cache, lock)
- Medusa `workerMode`: `server` ve `worker` ayrı süreçler (prod). Geliştirmede `shared`.
- Obje depolama: S3 uyumlu (ürün görselleri, etiket PDF'leri, fatura PDF'leri)
- Arama (F13'e yakın): Meilisearch — backend'de indeksleme subscriber'ı hazırlanır.
