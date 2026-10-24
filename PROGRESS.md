# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F2 — Platform çekirdek modülleri + güvenlik tabanı** (planlandı, kod yok). F1 tamamlandı; `f1-tr-localization` için push ve PR bekleniyor.

## Son oturum özeti
2026-10-24 (gece, devam): F2 planlandı (`/faz-baslat F2`).
- Medusa 2.21.2 API'leri üç araştırma ajanıyla doğrulandı (Context7 + v2.21.2 kaynağı): HTTP katmanı, modül/link/admin, asenkron iş/dosya/para. Planı değiştiren bulgular:
  - **HTTP katmanı:** Yerleşik rate limit, güvenlik header'ı ve `limit` üst sınırı yok. Varsayılan error handler unique/FK ihlalinde kolon ve değeri yanıta yazıyor. `/admin/uploads` multer'ı sınırsız ve bellek içi çalışıyor. `x-request-id` doğrulanmadan kabul ediliyor.
  - **Logger:** `defineConfig({ logger })` ile değiştirilebiliyor; arayüz yalnızca string mesaj alıyor.
  - **Event'ler:** Actor bilgisi taşımıyor. Fiyat değişimi için güvenilir workflow event'i yok, bu yüzden denetim kaydı HTTP sınırında tutulacak.
  - **Store API:** Bağlı veri `allowFields` middleware'iyle açılıyor (2.21.0+).
  - **Handle:** `toHandle` Türkçe karakterleri ASCII'ye çevirmiyor (`şef-bıçağı`).
  - **Background step:** Gövdesi `run()`'ı çağıran süreçte (server) koşuyor. In-memory engine restart'ta zamanlayıcıları kaybediyor. `file-local` imzasız ve herkese açık.
- ADR taslakları yazıldı (hepsi "Önerildi"): 0010 para/yuvarlama, 0011 denetim kaydı, 0012 ayarlar/bayraklar, 0013 ürün özellikleri, 0014 asenkron işler. ADR-0004'e CSRF için doğrulanan gerçekler eklendi.
- docs/12'ye iki kalem eklendi: denetim kaydı saklama süresi ve kuruş yuvarlama kuralı. docs/03'te F2.11 `url-registry` modül olarak netleştirildi.

2026-10-24 (gece): F1'in sekiz görevi (S1–S8) tek oturumda bitirildi. Kullanıcı önerilen seçeneklerin uygulanmasını istedi. ADR 0004, 0007, 0008 ve 0009 kabul edildi.
- **S1–S2:**
  - İdempotent tenant bootstrap: TR region/TRY, KDV dahil fiyat, KDV20 varsayılan, KDV10 ve KDV1 ürün tipine bağlı.
  - Sektörsüz demo seed: 4 ürün, 3 kategori, TR kargo seçenekleri.
  - Script'ler: `tenant:bootstrap`, `seed:demo` (`--allow-non-local` olmadan yalnızca development/test'te çalışır).
- **S3–S5:**
  - `tr-address` modülü: Türkçe eşleştirme ve sıralama anahtarları, ASCII'ye katlanmış yedek eşleştirme.
  - Tek transaction'lı import (`tr-address:import`). 32.076 mahalle ilk yüklemede ~4,3 sn, yeniden yüklemede ~1,6 sn.
  - Store route'ları: limit ≤100, `Vary` başlığı.
  - Adres doğrulama: store middleware'i, sepet ve müşteri adresi workflow hook'ları. Hata kodları i18n anahtarı. Alan eşlemesi adr/0008 ekinde.
- **S6–S7:**
  - Admin i18n (tr/en). Login widget'ı admin'i ilk ziyarette bir kez Türkçe'ye çevirir.
  - `billing-profile` modülü: TCKN/VKN kontrol hanesi doğrulaması, AES-256-GCM (AAD müşteriye bağlı) ve HMAC, route sınırında şifreleme, müşteri bazlı kilit, maskeli store/admin API ve widget, müşteri silinince soft delete.
- **S8:** Cookie `HttpOnly`, `SameSite=Lax`, NODE_ENV açıkça local değilse `Secure`. Session ömrü 10 saat. Redis session store; staging/prod'da `REDIS_URL` zorunlu.
- **Kalite:**
  - Testler: 108 birim, 24 modül entegrasyon, 62 HTTP entegrasyon. CI artık modül testlerini de çalıştırıyor.
  - Bağımsız güvenlik ve kod incelemesi yapıldı; kritik veya yüksek bulgu yok. Orta ve düşük bulgular düzeltildi.
  - Dev sunucusunda Playwright ile doğrulandı: admin Türkçe açılıyor, müşteri detayında maskeli fatura widget'ı görünüyor.

Önceki oturumlar: F1 planlaması ve F0.2–F0.8 (2026-10-24), F0.1 monorepo (2026-10-24 sabahı), SEO ve güvenlik dokümanları (2026-10-22).

## Sıradaki görev
1. **Kullanıcı:**
   - `f1-tr-localization`'ı push edip PR açmak (CI'da modül testleri ilk kez çalışacak).
   - Yerel dev DB'deki doğrulama verisini isterse silmek: "Deneme Müşteri" ve demo seed. Ortam `pnpm db:down -v` ile sıfırlanabilir.
2. **S1: F2.2 + F2.7** (`lib/errors` + `lib/money`). Önce ADR-0010 onaylanır.
   - Dal `f2-platform-core`: F1 PR'ı merge edildiyse `main`'den, edilmediyse `f1-tr-localization` üzerinden açılır.

### F2 görev planı (oturum büyüklüğünde, önerilen sıra)
| # | Görev | Kapsam | Bağımlılık | ADR |
|---|---|---|---|---|
| S1 | F2.2 + F2.7 | `lib/errors` ve `lib/money` (detay aşağıda). Birim testleri | — | 0010 |
| S2 | F2.10a | Pino logger, redaksiyon, istek ID'si, hata yanıtı sanitizasyonu | S1 | — |
| S3 | F2.10b | Güvenlik header'ları, Redis rate limit, CSRF, sayfalama sınırı, upload boyut kapısı. KK: login 429, header'lar | S2 | 0004 eki |
| S4 | F2.9a | `safe-fetch` (SSRF) + timing-safe yardımcıları. KK: iç IP / rebinding reddi | S1 | — |
| S5 | F2.9b | Upload validator + `/admin/uploads` kapısı, CSV kaçışlama, güvenli XML, zip sınırları. KK: SVG / sahte MIME reddi | S3, S4 | — |
| S6 | F2.1 + F2.6 | HTTP istemcisi + `/admin/integrations/health` deseni. KK: logda Authorization yok | S2, S4 | — |
| S7 | F2.11 | `lib/seo` + `url-registry` modülü. KK: slug tablosu, path tekilliği | S1 | — |
| S8 | F2.5 | `audit-log` modülü, mutasyon ve okuma kaydı. KK: fiyat değişimi, TCKN okuma | S3 | 0011 |
| S9 | F2.3a | `platform-settings` backend: bölümler, bayraklar, cache, uygulama noktaları. KK: kapalı bayrak | S7, S8 | 0012 |
| S10 | F2.3b | Admin: Ayarlar > Özellikler ve Ayarlar > SEO sayfaları | S9 | — |
| S11 | F2.4a | `product-attributes` backend: modül, link'ler, workflow'lar, admin/store API. KK: Store API'de değer | S8 | 0013 |
| S12 | F2.4b | Admin: ürün widget'ı + şablon yönetim sayfası | S11 | — |
| S13 | F2.8 | `async-job` modülü, file-s3, "İşler" sayfası; ilk tip denetim kaydı CSV dışa aktarma | S5, S8 | 0014 |

Görev ayrıntıları:
- **S1:**
  - `ProviderError { provider, code, retryable, safeMessageKey }`, `ValidationError`, `RetryableError`.
  - Medusa hata tiplerine eşleme tablosu. 502/503 gibi Medusa'da karşılığı olmayan durumlar S2'deki errorHandler'da üretilir.
  - `lib/money`: ADR-0010'a göre kuruş tipi, Medusa sınır dönüşümü, ROUND_HALF_UP, en büyük kalan dağıtımı.
- **S2:**
  - Medusa logger'ı `defineConfig({ logger })` ile pino adaptörüne geçer. Modül container'larına da geçtiği doğrulanır.
  - `lib/logging`: `{ event, ... }` alanlı yapılandırılmış logger, docs/10 ve adr/0009 redaksiyon listesi (+ `cookie`, `set-cookie`), AsyncLocalStorage istek bağlamı.
  - İstek ID'si: gelen `x-request-id` biçim kontrolünden geçer; yoksa veya geçersizse UUID üretilir. Yanıta `X-Request-Id` yazılır.
  - errorHandler varsayılanı sarar:
    - DB kaynaklı mesajlar (unique/FK/not-null) genel mesajla değiştirilir.
    - 5xx yanıtı genel mesaj döner.
    - Yanıtta `request_id` bulunur.
    - Test: unique ihlali yanıtında değer görünmez.
  - Script logları (seed, bootstrap, import) yapılandırılmış loga geçer (F1'den devreden).
- **S3:**
  - **Header'lar:** Global `"/*"` middleware'i şunları ekler: HSTS (yerel değilse), `nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy. `X-Powered-By` kaldırılır. Admin `/app` statiklerinin bu middleware'den geçip geçmediği doğrulanır; geçmiyorsa admin CSP F16'da reverse proxy'de uygulanır.
  - **Rate limit:**
    - Medusa Redis istemcisini dışarı açmadığı için kendi ioredis bağlantımız kullanılır. `REDIS_URL` yoksa (dev/test) bellek içi store.
    - Profiller: login (`/auth/{customer,user}/emailpass`), kayıt, şifre sıfırlama, token yenileme, varsayılan store/admin.
    - Checkout, kupon, taksit, SMS ve webhook profilleri tanımlanır; uçları ilgili fazda bağlanır.
    - Anahtar: IP + hash'lenmiş kimlik. Yanıt: 429 + `Retry-After`.
    - Limit, admin auth ve publishable key kontrolünden sonra çalışır.
  - **CSRF:** ADR-0004 F2.10 ekindeki kurallar.
  - **Sayfalama:** `/store/*`'da `limit > 100` 400 döner. Admin dashboard'un kullandığı limitler Playwright ile ölçülür, ardından admin'e de uygulanır.
  - **Upload:** `/admin/uploads` için multer öncesi Content-Length üst sınırı.
  - **CORS:** Allowlist dışı origin için regresyon testi.
- **S4:**
  - `node:http(s)` istekleri özel bir `lookup` ile yapılır. DNS çözümünden sonra adres `net.BlockList` ile kontrol edilir:
    - özel, loopback, link-local/metadata, CGNAT, multicast, ayrılmış aralıklar
    - IPv6 ULA, IPv4-mapped, NAT64
  - Bağlantı doğrulanan IP'ye gider, bu yüzden DNS rebinding işe yaramaz.
  - Yalnızca http/https ve port allowlist. Yönlendirmeler elle izlenir ve her adımda yeniden doğrulanır (en çok 5). Toplam süre ve yanıt boyutu sınırlıdır.
  - Yeni bağımlılık yok.
- **S5:**
  - **Upload validator:**
    - Tür magic bytes ile belirlenir (jpeg/png/webp/avif). SVG ve tanınmayan türler reddedilir.
    - Boyut ve piksel sınırı uygulanır.
    - Validator `/admin/uploads` POST'unda multer'dan sonra çalışır (aynı matcher + `methods`).
    - Yeniden kodlama ve EXIF temizleme F3.3'te.
  - **CSV:** `= + - @ \t \r` ile başlayan hücreler kaçışlanır; RFC 4180 tırnaklama.
  - **XML:** DOCTYPE içeren girdi reddedilir, entity işleme kapalı, boyut sınırı var.
  - **Zip:** Giriş sayısı, gerçek açılmış toplam boyut ve sıkıştırma oranı sınırlanır; path traversal ve symlink reddedilir. xlsx de zip olduğundan F3.9'da önce bu kontrolden geçer.
- **S6:**
  - **İstemci:** Node `fetch`. Özellikleri:
    - istek başına timeout
    - üstel geri çekilme + jitter (yalnız idempotent ya da açıkça işaretli isteklerde; 429'da `Retry-After`'a uyulur)
    - süreç başına devre kesici
    - `x-request-id` korelasyonu, header/gövde redaksiyonu
    - Zod ile yanıt parse etme, `ProviderError` / `RetryableError`
    - Medusa'nın `retryExecution`'ında üstel geri çekilme yok, kullanılmaz.
    - Kullanıcı kontrollü URL'lerde transport olarak `safe-fetch` kullanılır.
    - Testler `node:http` sahte sunucusuyla yazılır.
  - **Sağlık:**
    - Arayüz: `IntegrationHealthCheck { id, kind, check(signal) }`.
    - Provider'lar izole olduğundan kontroller provider sınıfından ayrı bir kayıt defterinde tutulur; aynı istemci ve env yapılandırmasını kullanır.
    - `GET /admin/integrations/health`: kontroller paralel ve zaman sınırlı çalışır, sonuç 30 sn cache'lenir. Yanıtta secret veya ham hata olmaz.
    - İlk kontrol Redis'tir; dosya deposu S13'te eklenir.
    - Core `/health` her zaman 200 döner; readiness ucu F16'da.
- **S7:**
  - **Slug:** docs/13 §2.1 kuralları. F3.1'de ürün handle'ı bu üreticiden verilir.
  - **Şablon motoru:** Tokenlar desteklenir. Bilinmeyen token kaydetme anında hata verir; boş token kalan ayırıcıları temizler.
  - **Piksel genişliği:** Tablo, Arial ile aynı metriklere sahip Liberation Sans'tan (OFL) üretilir. Sınırlar doc 14 ve `/seo-*` skill'leriyle doğrulanır.
  - **`url-registry` modülü:** `(locale, path)` unique; durum `active` | `reserved`; `claim` / `release` / `resolve`.
- **S8:** ADR-0011'e göre:
  - mutasyon middleware'i ve kaynak kayıt defteri (ilk giriş: varyant fiyatları)
  - okuma middleware'i: fatura profili, müşteri detayı ve adresleri, sipariş detayı
  - `GET /admin/audit-log`, `recordAuditEntryStep`
  - secret API key actor'ı testi
- **S9:** ADR-0012'ye göre:
  - `store` ve `seo` bölümleri. SEO bölümü canonical host, URL deseni, başlık şablonları (S7 motoruyla doğrulanır) ve robots şablonunu içerir.
  - Bayrak kayıt defteri, Redis sürüm sayaçlı cache, `requireFeature`, `assertFeatureEnabledStep`.
  - Admin API ve denetim kaydı girişleri.
  - KK testi bir test bayrağıyla yapılır.
- **S10:**
  - Sayfalar: `src/admin/routes/settings/features` ve `settings/seo`; SEO sayfasında şablon önizlemesi var.
  - Admin'e JS SDK (`sdk.client.fetch`) eklenir.
  - Kurallar: `@medusajs/ui`, i18n, yükleniyor/boş/hata durumları, Playwright smoke.
- **S11:** ADR-0013'e göre:
  - modül ve link'ler
  - şablon ve değer workflow'ları (ürün başına kilitli upsert)
  - Store'da `allowFields`; matcher hem `/store/products` hem `/store/products/:id`
  - facet indeksleri, denetim kaydı girişi
- **S12:** `product.details` widget'ı (şablon seçimi + dinamik form) ve `settings/attribute-templates` sayfası.
- **S13:** ADR-0014'e göre:
  - modül, iş tipi kayıt defteri, enqueue workflow'u ve subscriber
  - heartbeat, süpürücü ve saklama job'ları
  - file-s3 (SeaweedFS) bağlantısı ve env şeması, sonuç indirme ucu, "İşler" sayfası

Paralel zincirler:
- S1 → S2 → S3 → S8 → S9 → S10
- S8 → S11 → S12
- S1 → S4 → S5 ve S6
- S1 → S7 → S9
- S13 en son (S5 ve S8'den sonra)

Önerilen sıra, güvenlik tabanını (S1–S3) yeni route'lardan önce kurar (docs/04 "Route eklenmeden önce hazır").

## Açık sorular / bloklayıcılar
- [ ] **Renovate GitHub App kurulumu (kullanıcı):** github.com/apps/renovate → `denizcanmaya/eticaret-platform`. Kurulunca onboarding PR'ı kontrol edilecek.
- [ ] **Takip edilen açıklar** (adr/0001 "Bilinen açıklar"):
  - zod → 4.6.6: 2026-10-25'ten itibaren uygun; doğrudan bağımlılık + admin-sdk override.
  - body-parser → 1.20.9 ve multer → 2.5.0: 2026-11-05'ten itibaren uygun.
  - @graphql-tools/utils 10.x: kabul edilmiş risk (yalnızca build sırasında).
- [ ] Medusa 2.22.x yükseltmesi: en erken 2026-11-06 (2.22.1 için 14 gün); ayrı PR.
- [ ] **F2 kararları** (ilgili oturumda onaylanacak):
  - ADR-0010 (S1): kuruş tam sayı, yarım yukarı yuvarlama, en büyük kalan dağıtımı.
  - ADR-0011 (S8): denetim kaydı HTTP sınırında; okuma kaydı yazılamazsa istek reddedilir (fail closed).
  - ADR-0012 (S9): bayraklar kodda tanımlı, DB'de yalnızca farklar; kapalı bayrakta 404.
  - ADR-0013 (S11): tipli EAV satırları ve ürün ↔ şablon/değer link'leri.
  - ADR-0014 (S13): iş kaydı modülü, event → subscriber → workflow; file-s3 F3.3'ten öne çekilir.
- [ ] **F2 yeni bağımlılıkları** (her biri kendi oturumunda `pnpm add` onayıyla; exact sürüm, ≥14 gün):
  - `pino` (S2)
  - `ioredis` (S3; framework'ün opsiyonel peer aralığı ^5.4.1)
  - `fast-xml-parser` ve `yauzl` (S5)
  - Görsel boyutu için kendi başlık okuyucumuz ya da `image-size` (S5'te karar)
  - S4, S6 ve S7 yeni bağımlılık getirmez.
- [ ] **F2 planlamasında çıkan, sonraki fazlara devreden işler:**
  - **Redis modülleri (F16):** Prod için Redis event bus, workflow engine, locking ve caching modülleri gerekli. Bunlar olmadan server/worker ayrımı, restart sonrası iş devamı ve tek instance'ta zamanlanmış iş garantisi yok (ADR-0014).
  - **trust proxy (F16):** Medusa `trust proxy = 1` ayarlıyor. Rate limit IP'si doğru olsun diye prod'da tam bir reverse proxy katmanı olmalı.
  - **Handle (F3.1):** Ürün, kategori ve koleksiyon handle'ları `lib/seo` slug üreticisinden verilir; Medusa'nın `toHandle`'ı Türkçe karakterleri ASCII'ye çevirmiyor.
  - **İçe aktarma (F3.9):** Medusa'nın ürün içe aktarması dosyayı presigned URL ile doğrudan depoya yükleyebiliyor. Bu yol `/admin/uploads` doğrulamasından geçmez; F3.9'da ele alınacak.
- [ ] **F1'den devreden işler:**
  - Kargo KDV oranı için `shipping_option` vergi kuralı, mali müşavir onayından sonra (docs/12).
  - Soft-delete edilmiş fatura profillerini kalıcı silme / KVKK imha işi (F13).
  - Locking modülünün Redis sağlayıcısına geçmesi ve üretim imajında `NODE_ENV=production` (F16).
  - Yapılandırılmış log sarmalayıcısı (`{ event, ... }`) ve pino redaksiyonu (F2.10). Script logları şimdilik düz metin.
  - Telefon E.164 normalizasyonu yalnızca Store API yolunda yapılıyor; workflow ile yazılan sepet adresi ham telefonu saklar (doğrulama iki yolda da var).
  - `tr-address` ve fatura profili Store API sözleşme tipleri `packages/types`'a (F18).
  - Tam vergi kimliğini gösterme: yetki (F12) ve okuma audit log'u (F2.5).
- [ ] Çok dilli içerik: Medusa Translation modülü feature flag arkasında, şimdilik kapalı. Ana içerik Türkçe; çok dil F19.
- [ ] Medusa'da CSRF koruması yok → F2 S3'te Origin kontrolü + custom header (ADR-0004 F2.10 eki).
- [ ] Trivy imaj taraması: üretim Dockerfile'ı ile birlikte F16'da.
- [ ] GitHub Actions dakikaları: private repo, ücretsiz kota 2000 dk/ay; ilk ayda izlenecek.
- [ ] `adr/0003` hosting ve veri yerleşimi kararı (en geç F15 öncesi; KVKK danışmanı görüşü gerekli)
- [ ] Kod dışı gereksinimler takibi: `docs/12-kod-disi-gereksinimler.md` (avukat, mali müşavir, sağlayıcı anlaşmaları)
- [ ] `adr/0005` içerik önerileri: kural motoru + opsiyonel LLM (kabul bekliyor; LLM sağlayıcı seçimi F10.13 öncesi)
- [ ] Admin 2FA yöntemi ADR (F12.6 öncesi; Medusa'da yerleşik mi doğrulanacak)
- [ ] docs/15 açık doğrulamalar: ikas headless/API, Shopify B2B changelog, Google TR ücretsiz listeleme (tenant hesabında)

## Faz durumu
| Faz | Durum |
|---|---|
| F0 Repo & araçlar | ✅ |
| F1 Medusa çekirdek + TR lokalizasyon | ✅ |
| F2 Platform çekirdek modülleri | ⏳ |
| F3 Katalog, SEO motoru ve stok | ⬜ |
| F4 Fiyatlandırma ve promosyon | ⬜ |
| F5 Ödeme: iyzico | ⬜ |
| F6 Ödeme: PayTR + havale/EFT + kapıda ödeme + yönlendirici + ters ibraz | ⬜ |
| F7 Kargo, sipariş operasyonu, iade ve değişim | ⬜ |
| F8 E-fatura | ⬜ |
| F9 Bildirimler (e-posta/SMS) | ⬜ |
| F10 Müşteri hesabı, etkileşim, pazarlama ve SEO ölçümü | ⬜ |
| F11 Raporlama, muhasebe ve dış API | ⬜ |
| F12 Admin genişletmeleri | ⬜ |
| F13 Uyum & yasal özellikler | ⬜ |
| F14 Veri taşıma ve geçiş araçları | ⬜ |
| F15 Sertleştirme (güvenlik/dolandırıcılık/yük) | ⬜ |
| F16 Dağıtım & tenant işletimi | ⬜ |
| F17 Control plane | ⬜ |
| F18 Storefront & temalar (sonraki aşama) | ⬜ |
| F19 Genişleme: pazaryeri, B2B, yurt dışı, ajan ticareti (sonraki aşama) | ⬜ |

Durum: ⬜ başlamadı · ⏳ devam · ✅ bitti · ⛔ bloklu
