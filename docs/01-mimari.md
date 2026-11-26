# 01 — Mimari

## Genel görünüm
```
                ┌──────────── Üst panel / control plane (F17) ─────────┐
                │ mağaza kaydı, paket, abonelik, kurulum, sürüm, sağlık │
                └───────────────┬─────────────────────────────────────┘
                                │ kurulum · imzalı plan belgesi ↓ · imzalı kullanım raporu ↑
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
 iyzico · PayTR · Aras · Yurtiçi · e-fatura entegratörü · SMS · e-posta
```

## Üst panel (control plane, F17)
Ayrı bir Medusa uygulaması ve ayrı veritabanı (adr/0061; ayrıntı ADR'nin §1–§8'i ve Ek'leri, burada tekrarlanmaz):
- **Uygulamalar:** `apps/control-plane` (Medusa 2.21.2, port 9100, `qticaret_cp`; ticaret rotaları izin listesiyle kapalı), `apps/control-plane-panel` (Vite, 5174). Ortak kod `packages/server-kit` (kripto, zarf şifreleme, Ed25519 imza, redaksiyon, hata gövdesi), `packages/admin-ui` (iki panelin arayüzü), `packages/sector-packs` (sektör paketleri, veri), sözleşme `packages/types/src/control-plane` (Zod, katı).
- **Güven sınırı:** üst panel mağazanın veritabanına bağlanmaz, müşteri verisi tutmaz. Konuşma iki yönde Ed25519 imzalıdır, paylaşılan sır yok:
  - **Plan belgesi (üst panel → mağaza):** durum, paket, limitler, platform bayrakları, faturalama özeti; `serial` ile tekrar reddi. İtme (`POST /hooks/control-plane/plan`) + 15 dakikalık çekme. Mağaza son geçerli belgeyle çalışır; üst panele ulaşamamak durumu değiştirmez. Saklanan belge her yüklemede yeniden doğrulanır (Ek C19 I2).
  - **Kullanım raporu (mağaza → üst panel):** saatlik, imzalı, yalnız toplamlar (ürün, sipariş, personel, depolama, LLM, sürüm); kişi ya da ciro yok.
- **Durumlar:** `active` → `restricted` (ödeme gecikince otomatik; panel okunur, vitrin satar) → `suspended` (personel; vitrin 503). Veri hiç silinmez. Yönetimsiz kip (`CONTROL_PLANE_PUBLIC_KEYS` yok): bugünkü davranış.
- **Kurulum:** `provisioning` workflow'u + `TenantProvisioner` (yerelde `LocalProvisioner`, F16'da Docker). Çalışma sırları üretilir, mağazaya teslim edilir, üst panelde tutulmaz; çevrimdışı `age` emaneti kalır.

## Tenant modeli: instance-per-tenant
Her tenant = ayrı Medusa süreçleri + ayrı veritabanı. Gerekçe: izolasyon, KVKK, basit yedek/geri yükleme,
bir tenant'ın yükünün diğerini etkilememesi, Medusa'nın tek-mağaza varsayımıyla uyum. (adr/0001)
İleride tenant sayısı yüzleri bulursa paylaşımlı-kaynak optimizasyonu ayrı ADR ile değerlendirilir.

## Sağlayıcı kimlik bilgileri (önemli)
Mağazanın kendi sağlayıcı hesapları (PayTR, iyzico, Aras, Yurtiçi, e-fatura, SMS) **panelden girilir** (adr/0027; adr/0002'nin yerini aldı, 2026-10-27):
- Bilgiler `integration-credentials` modülünde durur. Gizli alanlar kayıt başına veri anahtarıyla AES-256-GCM ile şifrelenir, veri anahtarı env'deki KEK ile sarılır (`CREDENTIALS_ENCRYPTION_KEYS`, en yeni başta; ya da tek `CREDENTIALS_ENCRYPTION_KEY`; adr/0061 Ek C17). Anahtar kesintisiz döndürülür (docs/08).
- Gizli alanlar yalnızca yazılır: hiçbir yanıtta, logda ya da denetim kaydında görünmez.
- Kayıttan önce sağlayıcıya sorulur; değişiklik yeniden başlatma gerektirmez (sürümlü önbellek).
- Medusa module provider'ları izoledir. Sağlayıcı, mağazanın hesabını `@medusajs/framework`'ün paylaşılan `container`'ı üzerinden, çağrı anında okur (V2'de testle doğrulanır).
- Platformun kendi sırları (veritabanı, JWT, PII anahtarları, S3) env/secret store'da kalır; her biri ayrı değer olmalıdır (açılış aynı değeri iki anahtarda reddeder, adr/0061 Ek C19 I4). KEK'in OpenBao Transit'e taşınması F16'dadır (adr/0061 §4).

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
| `payment-paytr` | Payment provider | PayTR iFrame, bildirim, taksit, iade (F5, adr/0026) |
| `payment-iyzico` | Payment provider | iyzico Checkout Form, taksit, kalem bazlı iade (F5.11) |
| `webhook-events` | Custom modül | Gelen sağlayıcı bildirimlerinin tekil kaydı, idempotency (F5; F7 de kullanır) |
| `payment-bank-transfer` | Payment provider | Havale/EFT, manuel onay, süre aşımı iptali (F6) |
| `payment-cod` | Payment provider | Kapıda ödeme, ek ücret, tutar sınırı (F6) |
| `fulfillment-aras`, `fulfillment-yurtici` | Fulfillment provider | Etiket, takip; sabit ücret ya da desi tablosu (adr/0035; Geliver 2026-11-26 kaldırıldı) |
| `fulfillment-shop` | Fulfillment provider | "Kendi gönderimim": sabit ücret ya da tablo (adr/0087) |
| `notification-sms` | Notification provider | Netgsm vb. SMS |
| `notification-email` | Notification provider | Resend/SES |
| `einvoice` | Custom modül + provider deseni | e-Arşiv/e-Fatura, adaptör tabanlı |
| `platform-settings` | Custom modül | Feature flag'ler, mağaza ayarları, künye (secret İÇERMEZ) |
| `product-attributes` | Custom modül | Sektörel attribute şablonları (ör. çelik tipi, beden) |
| `legal-consent` | Custom modül | Sözleşme sürümleri, onay kayıtları, çerez onayı (İYS ileti izinleri `messaging`'de, ADR-0036) |
| `messaging` | Custom modül | Ticari ileti izni (İYS karşılığı, geçmişiyle) ve bastırma listesi; adresler yalnızca anahtarlı özetle (ADR-0036) |
| `audit-log` | Custom modül | Admin işlemlerinin denetim kaydı |
| `tr-address` | Custom modül | İl/ilçe/mahalle referans verisi |
| `seo-redirects` | Custom modül | 301/302/410, regex kurallar, zincir düzleştirme, 404 günlüğü + hedef önerisi (F3) |
| `seo-advisor` | Custom modül | Kural motoru: SEO/içerik skoru, bulgular, tek tık düzeltme, mağaza denetimi, paylaşım önizleme (F3, docs/14) |
| `brands` | Custom modül | Marka sayfaları (slug, logo, açıklama, SEO alanları), ürün ↔ marka link'i (F3) |
| `content` | Custom modül | İçerik sayfaları, blog, facet landing sayfaları; SEO alanlı (F3) |
| `product-qa` | Custom modül | Ürün Soru-Cevap, moderasyon, `QAPage` şeması (F10) |
| `seo-insights` | Custom modül | Search Console / CrUX / IndexNow entegrasyonları, SEO paneli verisi (F10) |
| `price-history` | Custom modül | Fiyat değişim geçmişi, indirimden önceki 10 günün en düşük fiyatı (adr/0023 Ek 2026-11-05); JSON-LD üstü çizili fiyat kaynağı (F4) |
| `wishlist` | Custom modül | Favori listesi (F10) |
| `back-in-stock` | Custom modül | Stok gelince haber ver abonelikleri (F10) |
| `product-reviews` | Custom modül | Satın alan müşteri yorumları + moderasyon (F10) |
| `marketing-feeds` | Custom modül + formatter deseni | Google/Meta/Akakçe/Cimri feed'leri (F10) |
| `accounting` | Custom modül + adaptör deseni | Paraşüt/Logo/Mikro aktarımı (F11) |
| `tenant-webhooks` | Custom modül | Tenant sistemlerine imzalı giden olaylar (F11) |
| `fraud-guard` | Custom modül | Captcha, velocity kuralları, şüpheli sipariş kuyruğu (F15) |
| `data-migration` | Custom modül + kaynak adaptörleri | Shopify/Ticimax/ikas vb. geçiş (F14) |

**Çekirdekte hazır gelenler (yeniden yazılmaz, yapılandırılır):** Product, Inventory, Stock Location,
Pricing (fiyat listeleri), Promotion, Customer (gruplar), Auth, API Key, Tax, Region, Sales Channel, Order Edit, Return, Exchange.

**Paylaşılan kütüphaneler (`lib/`):** `clients`, `errors`, `money`, `security` (safe-fetch, upload validator, CSV/XML güvenliği),
`seo` (Türkçe slug, url-registry, şablon motoru, JSON-LD üretici). Bkz. docs/02.
Hediye kartı, ürün çevirisi gibi yeteneklerin çekirdekte/resmi eklentide olup olmadığı Context7 ile doğrulanır.

## Sektörden bağımsızlık deseni
- `platform-settings` içinde feature flag'ler: `age_verification`, `engraving_option`, `cash_on_delivery`, ...
- `product-attributes`: şablon (ör. "Kesici Alet", "Giyim") → alan tanımları (tip, birim, zorunluluk, filtrelenebilir mi).
- Kod hiçbir yerde sektör adı kontrol etmez; sadece flag/şablon okur.

## Event akışı (ana senaryo)
```
cart.complete → stok rezervasyonu → order.placed
  ├─ subscriber: sipariş bildirimi (e-posta/SMS)
  ├─ subscriber: yasal onay snapshot'ı siparişe bağlanır
  ├─ subscriber: sunucu taraflı dönüşüm olayı (çerez onayı varsa)
  └─ subscriber: tenant webhook'ları (abonelik varsa)
order.fulfillment_created → kargo etiketi (Aras/Yurtiçi)
shipment tracking sorgusu → fulfillment güncellemesi → müşteri bildirimi
order.shipped (veya placed; tenant ayarı) → e-arşiv fatura workflow'u → muhasebe aktarımı
iade talebi → onay → iade gönderisi → depoya varış → para iadesi + stok + iade faturası
inventory güncellendi → stok bildirimi abonelerine haber, düşük stok uyarısı
product fiyatı güncellendi → price-history kaydı (+ audit log)
ürün/kategori/sayfa kaydedildi → seo-advisor değerlendirmesi (senkron) → url-registry + otomatik 301 → sitemap yeniden üretimi (debounce) → IndexNow
storefront 404 bildirdi → seo-advisor 404 günlüğü → hedef önerisi → admin tek tıkla 301
```

## SEO katmanı (özet; detay docs/13 ve docs/14)
- Store API her varlık için hazır `seo` payload'ı döner (title, description, canonical, robots, OG, breadcrumbs, JSON-LD). Tema SEO mantığı yazmaz.
- Sitemap ve robots backend'de üretilir (worker → S3), storefront proxy'ler.
- Ürün URL'si kategori içermez; birincil kategori breadcrumb ve şema için; URL desenleri tenant ayarı, değişimde toplu 301.
- `seo-advisor` kaydetme anında skor ve bulgu üretir; gece denetimi mağaza genelini tarar; LLM taslakları opsiyonel (adr/0005).

## Altyapı bileşenleri
- PostgreSQL (tenant başına DB), Redis (event bus, workflow engine, cache, lock)
- Medusa `workerMode`: `server` ve `worker` ayrı süreçler (prod). Geliştirmede `shared`.
- Obje depolama: S3 uyumlu (ürün görselleri, etiket PDF'leri, fatura PDF'leri, içe aktarma/rapor/feed dosyaları)
- CDN + WAF: görseller, DDoS ve bot koruması (sağlayıcı ve bölge: adr/0003)
- Arama (F18): Meilisearch — backend'de indeksleme subscriber'ı hazırlanır.
- Dış bağımlılık ilkesi: her dış servis adaptör arkasında ve mümkünse self-host alternatifi olan (captcha, hata izleme, obje depolama, arama, secret store);
  kaçınılmaz olanlar (kart ödeme, e-fatura iletimi, SMS, kargo taşıma) en ince katmanda tutulur (UBL üretimi, mükellef listesi, PDF bizde).
