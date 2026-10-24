# 03 — Yol Haritası (Backend + Admin)

> Her görev tek bir Claude Code oturumuna sığacak büyüklüktedir.
> Görev bitince kabul kriterleri işaretlenir ve `PROGRESS.md` güncellenir.
> "KK" = Kabul Kriteri. Bir faz, tüm KK'ları sağlanmadan kapanmaz.
> Medusa çekirdeğinde hazır gelen yetenekler (Inventory, Pricing, Promotion, Order Edit, Exchange vb.) yeniden yazılmaz;
> görev, onları TR'ye göre yapılandırmak, eksik kısmı özel modülle tamamlamak ve test etmektir.
> Her görevde önce Context7 ile çekirdekte ne olduğu doğrulanır.
> Güvenlik tabanı F0–F2'de kurulur (`docs/04-guvenlik.md` "Zamanlama"); F15 doğrulama fazıdır.
> SEO çekirdek özelliktir (F3), eklenti değildir: `docs/13-seo-mimarisi.md`, `docs/14-seo-advisor-kural-seti.md`.
> Kod dışı (hukuk, sözleşme, operasyon) gereksinimler: `docs/12-kod-disi-gereksinimler.md`.

## Faz özeti
| Faz | Konu | Aşama |
|---|---|---|
| F0 | Repo, araç zinciri ve güvenlik taraması | Temel |
| F1 | Medusa çekirdek + TR lokalizasyon | Temel |
| F2 | Platform çekirdek modülleri + güvenlik tabanı | Temel |
| F3 | Katalog, SEO motoru ve stok | Ticaret |
| F4 | Fiyatlandırma ve promosyon | Ticaret |
| F5 | Ödeme: iyzico | Ödeme |
| F6 | Ödeme: PayTR + havale/EFT + kapıda ödeme + yönlendirici + ters ibraz | Ödeme |
| F7 | Kargo, sipariş operasyonu, iade ve değişim | Operasyon |
| F8 | E-fatura / e-arşiv | Operasyon |
| F9 | Bildirimler | Operasyon |
| F10 | Müşteri hesabı, etkileşim, pazarlama ve SEO ölçümü | Büyüme |
| F11 | Raporlama, muhasebe ve dış entegrasyon API'si | Büyüme |
| F12 | Admin genişletmeleri | Bütünleştirme |
| F13 | Uyum ve yasal özellikler | Bütünleştirme |
| F14 | Veri taşıma ve geçiş araçları | Canlıya hazırlık |
| F15 | Sertleştirme (doğrulama: pentest, yük, fraud) | Canlıya hazırlık |
| F16 | Dağıtım ve tenant işletimi | Canlıya hazırlık |
| F17 | Control plane (abonelik, paketler, onboarding) | Platform |
| F18 | Storefront ve çoklu tema | Sonraki aşama |
| F19 | Genişleme: pazaryeri, B2B, yurt dışı, sadakat, ajan ticareti | Sonraki aşama |

**İlk müşteri canlıya çıkış eşiği:** F0–F16 tamamlanmış ve F18'den en az bir tema hazır.
F17 öncesinde tenant'lar F16 script'leriyle elle açılır.

---

## F0 — Repo, Araç Zinciri ve Güvenlik Taraması
**Hedef:** Tekrarlanabilir, temiz ve taranan geliştirme ortamı.

- F0.1 Monorepo iskeleti: pnpm workspaces, Turborepo, `packages/config` (tsconfig strict, eslint, prettier)
- F0.2 Medusa v2 kurulumu `apps/backend` (güncel sürüm Context7 ile doğrulanır → adr/0001)
- F0.3 `infra/docker/compose.dev.yml`: Postgres, Redis, Mailpit (e-posta yakalama), SeaweedFS (S3; MinIO arşivlendi → adr/0006)
- F0.4 Git hooks (lint-staged), conventional commits, commitlint, gitleaks pre-commit
- F0.5 CI iskeleti: lint, typecheck, unit test, build (GitHub Actions); `--frozen-lockfile`
- F0.6 `env.example` + ortam değişkeni şeması (Zod ile açılışta doğrulama; eksikse süreç başlamaz)
- F0.7 Güvenlik taraması CI'da: gitleaks, `pnpm audit` (kritik → build kırılır), SAST (Semgrep veya CodeQL), Trivy imaj taraması, SBOM (CycloneDX); pnpm postinstall script'leri kapalı
- F0.8 Renovate: haftalık, güvenlik yamaları anında, `minimumReleaseAge` 14 gün

**KK:**
- [x] `pnpm i && pnpm dev` temiz makinede çalışıyor (README adımlarıyla). README akışı sıfır volume ile doğrulandı;
  CI her push'ta temiz runner'da install, build ve test yapıyor.
- [x] CI yeşil; kasıtlı eklenen sahte secret ve bilinen zafiyetli paket CI'ı kırıyor (testli). Kanıt:
  [run 40090293700](https://github.com/denizcanmaya/eticaret-platform/actions/runs/40090293700): gitleaks, pnpm audit
  ve Trivy kırmızı.
- [x] Eksik env değişkeniyle backend açıklayıcı hatayla durur (F0.6, `EnvValidationError`)
- [x] adr/0001 (Medusa sürümü + tenant modeli) yazıldı

---

## F1 — Medusa Çekirdek + TR Lokalizasyon
**Hedef:** Türkiye için doğru yapılandırılmış boş mağaza.

- F1.1 Region: Türkiye, para birimi TRY, varsayılan dil tr
- F1.2 Vergi: KDV oranları (tenant'ın ürün gruplarına göre tax rate'ler), fiyatlar KDV dahil gösterim ayarı
- F1.3 `tr-address` modülü: il/ilçe/mahalle referans verisi + import script'i + Store API endpoint'leri
  (`GET /store/tr-address/provinces`, `.../districts?province=`, `.../neighborhoods?district=`)
- F1.4 Adres doğrulama: telefon (TR formatı), posta kodu, il-ilçe tutarlılığı (Zod)
- F1.5 Müşteri alanları: bireysel/kurumsal ayrımı, TCKN / VKN + vergi dairesi (fatura için), maskeleme
- F1.6 Seed script: demo ürünler, kategoriler, kargo seçenekleri (sektörsüz, genel demo). Markalar F3'teki `brands` modülüyle seed'e eklenir; Medusa çekirdeğinde marka modeli yok.
- F1.7 Admin dili Türkçe, i18n altyapısı (`src/admin/i18n`)
- F1.8 Store API kimlik doğrulama modeli: Medusa auth modülünün session/JWT seçenekleri Context7 ile doğrulanır → adr/0004 kabul edilir

**KK:**
- [x] Seed sonrası Store API'den TRY fiyatlı ürün listelenebiliyor (`seed-demo.spec.ts`)
- [x] Geçersiz il/ilçe kombinasyonu 400 döner (`tr-address-validation.spec.ts`)
- [x] TCKN loglarda ve admin listelerinde maskeli (`billing-profile.spec.ts`)
- [x] tr-address entegrasyon testleri geçiyor (`src/modules/tr-address/__tests__`, `tr-address.spec.ts`)
- [x] adr/0004 kabul edildi

---

## F2 — Platform Çekirdek Modülleri + Güvenlik Tabanı
**Hedef:** Sektörden bağımsızlığı, denetlenebilirliği ve güvenliği sağlayan temel. Sonraki her faz bunları hazır bulur.

- F2.1 `lib/clients`: ortak HTTP istemci (timeout, exponential retry, circuit breaker, header/body redaksiyonu, korelasyon ID)
- F2.2 `lib/errors`: `ProviderError`, `ValidationError`, `RetryableError` sınıfları ve Medusa hata eşleme
- F2.3 `platform-settings` modülü: mağaza ayarları + feature flag'ler (secret YOK), admin ayar sayfası; SEO ayarları (canonical host, URL desenleri, başlık şablonları, robots) burada
- F2.4 `product-attributes` modülü: şablon → alan tanımları (tip, birim, zorunluluk, filtrelenebilir mi, **SEO'da öne çıkar mı**, `variesBy` eşlemesi); ürün ↔ attribute değerleri link'i;
  admin'de ürün detayına widget; Store API'de ürünle birlikte dönme
- F2.5 `audit-log` modülü: admin mutasyonlarını middleware/subscriber ile kaydetme (kim, ne, ne zaman, önce/sonra özeti) + **hassas veri okuma kaydı** (TCKN/adres görüntüleme, dışa aktarma)
- F2.6 `/admin/integrations/health` endpoint deseni: her provider kendi `healthCheck()`'ini sunar
- F2.7 `lib/money`: kuruş tabanlı tutar tipi, yuvarlama kuralı, oransal dağıtım (indirim/kargo payını kalemlere bölme) — F4, F5, F8 bunu kullanır
- F2.8 Asenkron iş altyapısı deseni: uzun işler (içe aktarma, rapor, feed, SEO denetimi, sitemap) için iş kaydı + ilerleme durumu + sonuç dosyası (S3) + admin'de izleme
- F2.9 `lib/security`: `safe-fetch` (SSRF: DNS sonrası özel aralık reddi, yönlendirme yeniden doğrulama, boyut/zaman sınırı), `timingSafeEqual` yardımcıları,
  upload validator (magic bytes, boyut, piksel), CSV/Excel hücre kaçışlama, güvenli XML parser (DTD/entity kapalı), zip çıkarma sınırları
- F2.10 İstek katmanı güvenliği: Redis tabanlı rate limit middleware (uç bazlı profiller), güvenlik header'ları, CORS allowlist, hata yanıtı sanitizasyonu,
  pino yapılandırılmış log + redaksiyon listesi, CSRF (adr/0004'e göre), sayfalama üst sınırı
- F2.11 `lib/seo`: Türkçe slug üretici, başlık/meta şablon motoru, piksel genişliği tahmini; `url-registry` modülü (locale + path unique; tablo gerektirdiği için lib değil modül) — F3 bunu kullanır

**KK:**
- [ ] Feature flag kapalıyken ilgili endpoint/akış devreye girmiyor (testli)
- [ ] Attribute şablonu tanımlayıp ürüne değer atanabiliyor, Store API'de görünüyor
- [ ] Ürün fiyatı değişikliği audit log'da görünüyor; müşteri TCKN görüntüleme okuma kaydı düşüyor
- [x] HTTP istemci logunda Authorization/API key görünmüyor (testli) — F2 S6
- [x] `lib/money` oransal dağıtımda kuruş kaybı/fazlası olmuyor (testli, uç durumlar dahil) — F2 S1
- [ ] `safe-fetch` iç IP'ye ve DNS rebinding'e giden isteği reddediyor (testli); SVG ve sahte MIME yükleme reddediliyor
- [ ] Login ucunda limit aşımı 429 dönüyor; güvenlik header'ları tüm yanıtlarda (testli)
- [x] Slug üretici transliterasyon tablosunu geçiyor; aynı path ikinci varlığa verilemiyor — F2 S7

---

## F3 — Katalog, SEO Motoru ve Stok
**Hedef:** Mağazanın yüzlerce ürünü hızlıca yükleyip, SEO'su hazır ve doğru stokla satabilmesi. Detay: `docs/13`, `docs/14`.

### Katalog
- F3.1 Ürün yapısı: varyant/seçenek, kategori ağacı, koleksiyon, etiket (Medusa çekirdeği) + fiziksel ürünlerde ölçü/ağırlık zorunluluğu
  + GTIN/MPN/durum alanları + **birincil kategori** (`primary_category_id`) + **halef ürün** alanı (satıştan kalkınca 301 hedefi)
- F3.2 Fiziksel olmayan ürün tipi (dijital/hizmet; kargo gerektirmez) — flag ile
- F3.3 Görseller: S3 file provider (dev'de SeaweedFS, adr/0006), tür/boyut sınırı (`lib/security` upload validator; SVG kapalı; EXIF temizleme; yeniden kodlama),
  varyant görselleri, worker'da yeniden boyutlandırma + WebP/AVIF türevleri, slug'dan dosya adı, zorunlu alt alanı, OG 1200×630 kırpma
- F3.11 `brands` modülü: marka (slug, açıklama, logo, SEO alanları), ürün ↔ marka link'i, admin ekranı, Store API marka sayfası

### SEO
- F3.4 SEO alanları ve URL desenleri: ürün/kategori/marka/koleksiyon için `seo_title`, `seo_description`, `canonical_override`, `robots_override`, `og_image_override`, `focus_keyword`;
  şablondan fallback; mağaza geneli benzersizlik; URL desen seçimi (tenant) ve desen değişiminde toplu 301; Store API `seo` payload (doc 13 §1)
- F3.5 `seo-redirects` modülü: tam/önek/regex kurallar, 301/302/307/410, sorgu parametresi davranışı, zincir düzleştirme, döngü tespiti,
  slug/kategori/halef değişiminde otomatik 301, CSV içe/dışa aktarma, `GET /store/seo/resolve`, 404 günlüğü (`POST /store/seo/not-found`, rate limitli) + hedef önerisi
- F3.6 Sitemap: backend üretir (worker, debounce + günlük tam), sitemap index + ürün/kategori/marka/sayfa/landing + görsel sitemap, 50.000/50 MB bölme,
  `lastmod` yalnızca anlamlı değişimde, `noindex`/taslak dışarıda, S3'e yazar; Store API'den konum
- F3.12 JSON-LD üretici (`lib/seo/jsonld`): `ProductGroup`/`Product` + `Offer` (kargo, iade, üstü çizili fiyat F4.3 kaynağından), `BreadcrumbList`,
  `CollectionPage` + `ItemList`, `OnlineStore` (künye F13.9'dan), `Article`; JSON şema testleri; `/seo-schema` skill'iyle örneklem doğrulama
- F3.13 `seo-advisor` modülü: kural motoru (doc 14 §3.1–3.6), skor, bulgular, tek tık düzeltmeler, ürün/kategori/marka widget'ı + SERP/sosyal önizleme,
  liste sütunu ve filtre, yayın kapısı flag'i (`seo_publish_gate`), kural sürümleme ve i18n metinleri
- F3.14 Mağaza geneli SEO denetimi (job): doc 14 §3.9 kuralları, rapor dosyası (F2.8), 404 isabet listesi + "301 oluştur", zincir/döngü, mükerrer, öksüz listeleri
- F3.15 robots.txt yönetimi (admin, güvenli şablon, facet parametre engelleri, AI tarayıcı ön ayarları), canonical host + platform alt alan adı 301,
  staging/önizleme `noindex`, imzalı önizleme bağlantıları, IndexNow bildirimi (job, toplu)
- F3.16 `content` modülü: içerik sayfaları, blog yazıları (yazar, yayın/güncelleme tarihi), **facet landing sayfaları** (kategori + attribute/marka, path tabanlı,
  özgünlük kapıları doc 14 §3.7), zengin metin editörü, SEO alanları, Store API; ürün/kategori bağlantı kısa kodları
- F3.17 Facet navigasyon kuralları: parametre ayırıcı/sırası, boş kombinasyonda 404, allowlist landing → index + kendi canonical, sayfalama canonical kuralları, dahili arama `noindex`

### Stok
- F3.7 Stok: Inventory + Stock Location modülleri; depo tanımı, stok seviyeleri, sipariş anında rezervasyon,
  iptal/iadede stoğun geri dönmesi
- F3.8 Stok kuralları: düşük stok eşiği + admin uyarısı, stoksuz satış (ön sipariş) ayarı, stok hareket geçmişi
- F3.9 Toplu içe/dışa aktarma: Medusa'nın yerleşik CSV akışı doğrulanır; Excel (xlsx) + TR şablonu (SEO sütunları dahil),
  satır bazlı hata raporu, worker'da asenkron (F2.8); dışa aktarmada hücre kaçışlama, XML'de XXE koruması; yüklemede advisor ön değerlendirme özeti
- F3.10 Toplu düzenleme: fiyat, stok, yayın durumu, kategori, SEO şablonu uygula, alt metin doldur (admin)

**KK:**
- [ ] 1000 satırlık Excel içe aktarma worker'da tamamlanıyor, hatalı satırlar raporlanıyor
- [ ] Aynı son ürün için eşzamanlı iki checkout'tan yalnızca biri tamamlanıyor (testli)
- [ ] Slug değişince eski URL 301 ile yeni URL'e çözülüyor; A→B→C zinciri A→C'ye düzleşiyor; döngü reddediliyor
- [ ] Sınırı aşan görsel, SVG ve sahte MIME yüklemesi açıklayıcı hatayla reddediliyor; EXIF temizleniyor
- [ ] Düşük stok eşiğine inince admin uyarısı oluşuyor
- [ ] Her varlık türü için `seo` payload tam ve mutlak URL'li (contract test); JSON-LD şema doğrulamasından geçiyor
- [ ] Advisor skoru deterministik, p95 < 50 ms; eksik alt metin/GTIN/birincil kategori bulguları doğru (fixture'lı)
- [ ] 404 günlüğündeki yol için doğru 301 hedefi öneriliyor; tek tıkla kural oluşuyor
- [ ] Sitemap 50.000'de bölünüyor, taslak/noindex dışarıda; robots facet parametrelerini engelliyor, landing yolunu engellemiyor
- [ ] Özgünlük < %30 olan landing sayfası yayımlanamıyor (testli)
- [ ] Dışa aktarılan Excel'de formül başlangıçlı hücre kaçışlanmış

---

## F4 — Fiyatlandırma ve Promosyon
**Hedef:** TR mevzuatına uygun indirim gösterimi ve eksiksiz kampanya altyapısı.

- F4.1 Fiyat listeleri (Pricing modülü): indirimli fiyat, zamanlı fiyat, müşteri grubuna özel fiyat
- F4.2 `price-history` modülü: her varyant fiyat değişikliğinin kaydı (fiyat, para birimi, zaman, kaynak)
- F4.3 İndirim gösterimi kuralı: indirimli üründe "son 30 günün en düşük fiyatı" hesaplanıp Store API'de döner
  (Fiyat Etiketi Yönetmeliği — kesin kural hukukçuyla doğrulanır); JSON-LD `StrikethroughPrice` (F3.12) **aynı kaynaktan** beslenir
- F4.4 Kuponlar (Promotion modülü): yüzde/tutar indirim, ürün/kategori kapsamı, minimum sepet,
  toplam ve kişi başı kullanım limiti, geçerlilik tarihi
- F4.5 Otomatik kampanyalar: X al Y öde, sepette indirim, kargo bedava eşiği
- F4.6 Promosyon güvenliği: tek kullanımlık kodların toplu üretimi, kupon denemede rate limit, birleşme (stack) kuralları
- F4.7 İndirim dağılımı: indirimin kalemlere `lib/money` ile dağıtımı — iyzico sepeti, e-fatura ve kısmi iade aynı kaynağı kullanır
- F4.8 Hediye kartı / mağaza kredisi: çekirdekte veya resmi eklentide varsa kullanılır, yoksa özel modül (ADR)

**KK:**
- [ ] Kullanım limiti dolan kupon eşzamanlı isteklerde bile limit aşmıyor (testli)
- [ ] Son 30 gün en düşük fiyat, fiyat geçmişinden doğru hesaplanıyor (testli); JSON-LD'deki üstü çizili fiyat bununla tutarlı
- [ ] Kargo bedava eşiği sepet tutarına göre doğru uygulanıyor
- [ ] İndirimli siparişte kısmi iade tutarı, kalemin indirim payı düşülerek hesaplanıyor (testli)

---

## F5 — Ödeme: iyzico
**Hedef:** Üretime hazır iyzico payment provider. Detay: `docs/entegrasyonlar/iyzico.md`

- F5.1 `client.ts`: imzalı istek üretimi, sandbox/prod ayrımı (env), tip güvenli yanıtlar
- F5.2 `initiatePayment`: Checkout Form başlatma; basket item'lar sunucudaki sepetten üretilir
- F5.3 Callback akışı: `POST /hooks/iyzico/callback` → token ile sonuç sorgusu → cart complete workflow; başarı/başarısız dönüş URL'leri storefront origin allowlist'iyle sınırlı (open redirect yok)
- F5.4 `authorizePayment` / `capturePayment` / `getPaymentStatus` / `retrievePayment`
- F5.5 `refundPayment`: tam ve kısmi iade (kalem bazlı transaction ID eşlemesi)
- F5.6 `cancelPayment`: aynı gün iptal / sonrası iade mantığı
- F5.7 Webhook: imza doğrulama, idempotency tablosu, `getWebhookActionAndData`
- F5.8 Taksit: `POST /store/payment/installments` (BIN + tutar → banka/taksit tablosu), cache'li, rate limitli
- F5.9 Admin widget: sipariş detayında iyzico işlem bilgisi (paymentId, taksit, kart ailesi, son 4 hane maskeli)
- F5.10 Mock iyzico sunucusu (`packages/testing`) + entegrasyon testleri
- F5.11 Kayıtlı kart (iyzico kart saklama): müşteri onayıyla, kart verisi bizde değil iyzico'da (doğrula)

**KK:**
- [ ] Sandbox'ta tek çekim + taksitli ödeme uçtan uca başarılı
- [ ] 3DS başarısız/iptal senaryosu sepeti bozmadan geri dönüyor
- [ ] Aynı callback iki kez gelirse tek sipariş oluşuyor
- [ ] Kısmi iade doğru kalemlerden düşüyor
- [ ] Tutar manipülasyonu (istemci tutarı) etkisiz (testli); allowlist dışı dönüş URL'si reddediliyor (testli)
- [ ] Kapsam ≥ %80

---

## F6 — Ödeme: PayTR + Alternatif Ödemeler + Yönlendirici + Ters İbraz
Detay: `docs/entegrasyonlar/paytr.md`, `docs/entegrasyonlar/alternatif-odeme.md`

- F6.1 `payment-paytr` provider: iFrame token, HMAC hash, bildirim URL'i ("OK" yanıtı), iade
- F6.2 Region'a birden fazla provider tanımlama; tenant ayarıyla birincil/yedek seçimi
- F6.3 Yönlendirici kuralları (platform-settings): varsayılan provider, provider sağlık durumu kötüyse yedek
- F6.4 Ortak ödeme test paketi: her provider aynı sözleşme testlerinden geçer (contract tests)
- F6.5 `payment-bank-transfer` provider: "ödeme bekleniyor" durumu, IBAN bilgisi (platform-settings),
  admin'den manuel onay, süre dolunca otomatik iptal + stok iadesi (job)
- F6.6 `payment-cod` (kapıda ödeme, flag `cash_on_delivery`): ek ücret, tutar üst sınırı,
  yalnızca destekleyen kargo seçenekleriyle; kargo tahsilat mutabakatı alanları
- F6.7 Ters ibraz (chargeback) yönetimi: sağlayıcı bildirimi/elle kayıt → sipariş işareti + durum (açık/belge sunuldu/kazanıldı/kaybedildi) →
  belge paketi üretimi (fatura, kargo teslim kanıtı, sözleşme onay snapshot'ı, IP/zaman) → admin kuyruğu; kaybedilen ibrazda muhasebe kaydı (F11)

**KK:**
- [ ] Birincil provider devre dışıyken checkout yedekle tamamlanıyor
- [ ] Her provider (iyzico, PayTR, havale, kapıda ödeme) ortak contract test paketini geçiyor
- [ ] Süresi dolan havale siparişi iptal ediliyor ve stok geri dönüyor (testli)
- [ ] Kapıda ödeme flag kapalıyken veya tutar sınırı aşıldığında seçenek sunulmuyor (testli)
- [ ] Ters ibraz kaydı açılan siparişin belge paketi tek tıkla iniyor

---

## F7 — Kargo, Sipariş Operasyonu, İade ve Değişim
Detay: `docs/entegrasyonlar/geliver.md`

- F7.1 `fulfillment-geliver` provider: `getFulfillmentOptions`, `validateFulfillmentData`, `validateOption`
- F7.2 `canCalculate` / `calculatePrice`: desi hesaplama (ürün ölçü/ağırlık) + teklif, cache'li
- F7.3 `createFulfillment`: gönderi oluşturma, etiket PDF → obje depolama (private, presigned erişim), takip no kaydı
- F7.4 `cancelFulfillment`, `createReturnFulfillment` (iade kodu)
- F7.5 Takip webhook'u: `POST /hooks/geliver` → imza/doğrulama → fulfillment durum güncelleme → event
- F7.6 Fallback: webhook gelmeyen gönderiler için scheduled job ile periyodik sorgu
- F7.7 Admin: toplu etiket basma, kargo durum sütunu, "kargoya hazır" listesi
- F7.8 Kargo kuralları: koli birleştirme, bölge/ağırlık bazlı ücret, teslim süresi tahmini (JSON-LD `shippingDetails` kaynağı), mağazadan teslim alma seçeneği (flag)
- F7.9 İade talebi yönetimi (RMA): müşteri talebi + neden kodu → admin onay/ret → iade kodu →
  depoya varış kontrolü → iade workflow'u (para iadesi + stok + iade faturası)
- F7.10 Kısmi gönderim: tek siparişin birden çok koli/gönderiyle karşılanması
- F7.11 **Değişim (exchange):** Medusa çekirdeğinin exchange akışı doğrulanır; beden/renk değişimi talebi → fark tutarı (tahsilat/iade) → iade gönderisi + yeni gönderi → stok ve fatura (iade + yeni fatura, mali müşavirle doğrula)
- F7.12 **Sipariş düzenleme:** Medusa order edit ile adres değişikliği, kalem ekleme/çıkarma/miktar, fiyat düzeltme; ödeme farkı akışı; faturalandırılmış siparişte kısıt (F8 ile uyum); audit log
- F7.13 **Müşteri tarafı iptal:** kargoya verilmeden önce müşteri iptali (Store API), otomatik para iadesi + stok; sonrasında iade talebine yönlendirme
- F7.14 **Doğrudan taşıyıcı adaptörü:** ilk müşterinin anlaşmalı kargo firması (Yurtiçi/Aras/MNG/PTT/Sürat'ten biri) için aynı fulfillment arayüzüyle doğrudan entegrasyon; Geliver aracılığından bağımsızlık

**KK:**
- [ ] Test ortamında sipariş → etiket → takip ilerlemesi → "teslim edildi" akışı çalışıyor
- [ ] Ölçüsü eksik ürünle kargo hesabı açıklayıcı hata veriyor
- [ ] İade talebinden para iadesi + stok + iade faturasına kadar akış çalışıyor
- [ ] Webhook ve polling aynı güncellemeyi iki kez uygulamıyor
- [ ] Değişim akışı: fark tutarı doğru hesaplanıyor, stok iki yönde doğru (testli)
- [ ] Kargoya verilmiş sipariş müşteri tarafından iptal edilemiyor; verilmemiş olan iptal edilip iade ediliyor (testli)
- [ ] Doğrudan taşıyıcı adaptörü contract test paketini geçiyor; etiket PDF'i yetkisiz URL ile açılamıyor

---

## F8 — E-Fatura / E-Arşiv
Detay: `docs/entegrasyonlar/e-fatura.md`

- F8.1 `einvoice` modülü: Invoice modeli (sipariş ref, UUID, numara, durum, PDF url, hata)
- F8.2 **UBL-TR üretimi bizde** (`einvoice/ubl`): fatura/iade faturası XML'i, KDV dökümü, indirim/kargo satırları (mali müşavirle doğrula); `InvoiceAdapter` arayüzü entegratöre yalnızca imza+iletim bırakır; ilk adaptör
- F8.3 Fatura tipi belirleme: alıcı VKN'li ve e-fatura mükellefi ise e-Fatura, değilse e-Arşiv
- F8.4 Workflow: tetikleme zamanı tenant ayarı (sipariş/kargo); retry + dead-letter
- F8.5 İade/iptal faturası akışı (değişim dahil, F7.11)
- F8.6 Admin: fatura durumu widget'ı, PDF indir, "yeniden dene"
- F8.7 **Mükellef sorgusu bizde:** GİB'in yayımladığı e-fatura kayıtlı kullanıcı listesini periyodik indirip yerel tabloda tutan job; entegratör sorgusu yalnızca yedek
- F8.8 **Fatura PDF'i bizde:** UBL'den PDF üretimi (worker), tenant logosu/şablonu; private depolama + presigned erişim; entegratör PDF'i opsiyonel

**KK:**
- [ ] Test ortamında bireysel (e-Arşiv) ve kurumsal (e-Fatura) fatura kesiliyor
- [ ] Entegratör hata verirse sipariş akışı bozulmuyor, fatura "beklemede" kalıp retry ediliyor
- [ ] Aynı sipariş için mükerrer fatura oluşmuyor
- [ ] Ürettiğimiz UBL-TR, entegratörün ve GİB test aracının şema doğrulamasından geçiyor
- [ ] Mükellef listesi güncel; entegratör kapalıyken tip belirleme çalışıyor (testli)

---

## F9 — Bildirimler
Detay: `docs/entegrasyonlar/sms.md`

- F9.1 `notification-email` provider (Resend/SES), dev'de Mailpit
- F9.2 `notification-sms` provider (Netgsm vb.)
- F9.3 Şablon sistemi: React Email veya MJML; tenant marka renkleri/logo `platform-settings`'ten
- F9.4 Olaylar: sipariş alındı, ödeme başarısız, havale bekleniyor, kargoya verildi, teslim edildi,
  iade/değişim talebi alındı/onaylandı, şifre sıfırlama, e-posta doğrulama
- F9.5 İşlemsel ↔ ticari ileti ayrımı; ticari iletiler İYS izni olmadan gönderilmez
- F9.6 Tenant alan adından gönderim: domain doğrulama (SPF, DKIM, DMARC), bounce/şikayet işleme, bastırma listesi
- F9.7 Admin'e iç bildirimler: yeni sipariş, düşük stok, başarısız fatura, onay bekleyen havale, SEO denetim özeti (e-posta + admin içi)
- F9.8 **SMS kotası:** telefon, IP ve hesap başına SMS tetikleme limiti (OTP/şifre sıfırlama/stok bildirimi), eşik aşımında captcha; maliyet uyarısı (SMS pumping koruması)

**KK:**
- [ ] Tüm olaylar Mailpit'te doğru şablonla görünüyor
- [ ] İzni olmayan müşteriye ticari SMS gitmiyor (testli)
- [ ] Bounce alan adrese tekrar gönderim yapılmıyor
- [ ] Aynı numaraya limit üstü SMS isteği reddediliyor (testli)

---

## F10 — Müşteri Hesabı, Etkileşim, Pazarlama ve SEO Ölçümü
Detay: `docs/entegrasyonlar/pazarlama.md`, `docs/13-seo-mimarisi.md` §9–10

- F10.1 Müşteri hesabı: misafir checkout, kayıt/giriş (adr/0004 modeli), **e-posta doğrulama**, adres defteri (tr-address), sipariş geçmişi — Store API + testler
- F10.2 Sosyal giriş (Google, Apple): Medusa auth provider'larıyla (Context7 ile doğrula)
- F10.3 Müşteri grupları ve segmentler: fiyat listesi ve promosyon hedefleme için
- F10.4 `wishlist` modülü: favori listesi
- F10.5 `back-in-stock` modülü: stok gelince haber ver aboneliği → stok subscriber'ı → tek seferlik bildirim
- F10.6 `product-reviews` modülü: yalnızca satın alan müşteri, puan + metin (+ görsel), admin moderasyonu, ortalama puan Store API'de ve JSON-LD `aggregateRating`'de
- F10.7 Terk edilmiş sepet hatırlatma: job, izin kontrolü, tek kullanımlık geri dönüş linki
- F10.8 `marketing-feeds` modülü: Google Merchant Center (feed + **Merchant API** push), Meta katalog, Akakçe/Cimri feed'leri; worker'da periyodik üretim → S3; sayfa JSON-LD'si ile aynı kaynak
- F10.9 Sunucu taraflı dönüşüm olayları: Meta Conversions API, GA4 Measurement Protocol (satın alma, iade);
  çerez onayı kontrolü, kişisel veriler hash'lenerek
- F10.10 **Ürün Soru-Cevap** modülü: müşteri sorusu → tenant/onaylı müşteri cevabı → moderasyon → Store API + `QAPage` JSON-LD; doğrulanmamış hesap soramaz
- F10.11 **Search Console + CrUX entegrasyonu:** tenant OAuth ile GSC mülkü bağlar; Search Analytics, sitemap gönderimi, URL Inspection (kota planlı) ve CrUX API job'ları → `seo-advisor` S-GSC/S-CWV kuralları
- F10.12 Doğrulanmamış hesap kısıtları ve kötüye kullanım koruması: yorum/soru/abonelik spam'i için rate limit + doğrulama şartı
- F10.13 **LLM içerik taslakları** (adr/0005): `ContentDraftProvider` arayüzü + ilk sağlayıcı; açıklama/meta/alt/Soru-Cevap/paylaşım metni taslakları; kota, flag, "AI taslak" etiketi, kural motorundan geçiş

**KK:**
- [ ] Yalnızca ürünü satın almış müşteri yorum yazabiliyor; onaylanmamış yorum Store API'de görünmüyor
- [ ] Stok girişi sonrası abonelere tek bildirim gidiyor
- [ ] İzni olmayan müşteriye terk edilmiş sepet iletisi gitmiyor (testli)
- [ ] Google Merchant feed'i şema doğrulamasından geçiyor; feed fiyatı sayfa JSON-LD fiyatıyla aynı (testli)
- [ ] Çerez onayı yokken dönüşüm olayı gönderilmiyor (testli)
- [ ] Doğrulanmamış e-posta ile yorum/soru yazılamıyor (testli)
- [ ] GSC verisi panelde; indekslenmeyen ürün listesi advisor'da görünüyor
- [ ] LLM taslağı onaysız yayımlanamıyor; prompt'a kişisel veri gitmiyor (testli)

---

## F11 — Raporlama, Muhasebe ve Dış Entegrasyon API'si
Detay: `docs/entegrasyonlar/muhasebe.md`

- F11.1 Rapor altyapısı: tarih aralığı, filtre, CSV/Excel dışa aktarma (hücre kaçışlama); büyük raporlar asenkron (F2.8)
- F11.2 Satış raporları: ciro, sipariş adedi, ortalama sepet, ürün/kategori/marka performansı, iade/değişim oranı, promosyon etkisi, trafik kaynağına göre sipariş (SEO ↔ satış)
- F11.3 Finans raporları: KDV oranına göre satış dökümü, ödeme yöntemine göre tahsilat,
  ödeme sağlayıcı mutabakatı (sağlayıcı işlem listesi ↔ sipariş, job), ters ibraz listesi
- F11.4 Stok raporları: stok değeri, devir hızı, hareketsiz stok
- F11.5 `accounting` modülü: önce **standart dışa aktarım** (mali müşavirin alacağı Excel/CSV/UBL paketi), sonra `AccountingAdapter` (Paraşüt, Logo, Mikro) — ilk adaptör tenant talebine göre
- F11.6 Tenant dış API'si: Medusa secret API key yönetimi (kapsam, döndürme, iptal), OpenAPI dokümanı
- F11.7 `tenant-webhooks` modülü: tenant'ın kendi sistemlerine giden olaylar (sipariş, stok, iade); HMAC imza, retry, teslim logu, `safe-fetch`
- F11.8 Dahili arama terimleri raporu: çok aranan/sonuçsuz terimler → advisor S-SEARCH-01 ve odak kelime adayları

**KK:**
- [ ] Rapor toplamları sipariş verisiyle tutarlı (fixture ile testli)
- [ ] Muhasebe adaptörü hata verirse aktarım "beklemede" kalıp yeniden deneniyor, mükerrer kayıt oluşmuyor
- [ ] Giden webhook imzalı; başarısız teslim artan aralıkla yeniden deneniyor; iç IP hedefi reddediliyor
- [ ] İptal edilen API anahtarı anında reddediliyor ve hiçbir logda görünmüyor
- [ ] Dışa aktarılan raporda formül enjeksiyonu yok (testli)

---

## F12 — Admin Genişletmeleri
Detay: `docs/06-admin-ux.md`

- F12.1 Dashboard widget'ları: günlük ciro, bekleyen siparişler, kargoya hazır, başarısız ödeme/fatura, düşük stok, SEO skoru özeti
- F12.2 "Entegrasyonlar" sayfası: provider durumu, bağlantı testi, son hatalar (secret göstermez)
- F12.3 Sipariş operasyon ekranı: filtreler (ödeme/kargo/fatura durumu), toplu işlemler, sipariş düzenleme/iptal/değişim giriş noktaları
- F12.4 Ayarlar: feature flag'ler, attribute şablonları, yasal metin sürümleri, mağaza künyesi, SEO ayarları (desenler, şablonlar, robots, canonical host)
- F12.5 Audit log görüntüleyici (mutasyon + okuma kayıtları)
- F12.6 Rol bazlı yetki: owner, admin, operasyon, salt-okunur; **admin 2FA (TOTP)** — Medusa'da yerleşik değilse ADR + uygulama
- F12.7 Ekran bütünlüğü: önceki fazlarda eklenen ekranların menü yapısı, terim sözlüğü ve UX kontrol listesine uyumu
- F12.8 Sipariş iç notları ve müşteri iletişim geçmişi
- F12.9 Global arama: sipariş no, müşteri, ürün, takip no
- F12.10 **SEO paneli** (doc 14 §5): mağaza skoru, en düşük varlıklar, 404 + 301 oluştur, zincir/mükerrer/öksüz listeleri, GSC/CWV kartları, denetim raporu; **kurulum kontrol listesi** (künye, politikalar, canonical host, robots, OG, GSC, Merchant, IndexNow)
- F12.11 İçerik yönetimi ekranları: sayfalar, blog, facet landing (özgünlük göstergesi), Soru-Cevap moderasyonu

**KK:**
- [ ] Operasyon rolü ayarları değiştiremiyor (testli); 2FA'sız owner girişi engelleniyor
- [ ] Tüm admin sayfaları Türkçe, boş/hata/yükleniyor durumları tasarlanmış
- [ ] Kurulum kontrol listesindeki eksikler panelde görünüyor ve tamamlanınca kayboluyor

---

## F13 — Uyum ve Yasal Özellikler
- F13.1 `legal-consent`: sözleşme şablonları sürümlü (mesafeli satış, ön bilgilendirme, KVKK aydınlatma, çerez, iade politikası, kargo politikası); iade/kargo politikası alanları JSON-LD'ye (F3.12) kaynak
- F13.2 Checkout'ta onay kaydı: sürüm, zaman, IP, sipariş verisiyle doldurulmuş metnin snapshot'ı
- F13.3 Yaş doğrulama (feature flag `age_verification`): beyan + doğum tarihi kontrolü; ürün/kategori bazlı
- F13.4 Kısıtlı ürün kategorisi işareti (flag ile): satış öncesi ek onay / tenant uyarısı; SEO: index ayarı + `hasAdultConsideration` eşlemesi
- F13.5 KVKK: kişisel veri dışa aktarma ve silme/anonimleştirme talebi akışı, saklama süreleri job'u, `docs/kvkk-envanter.md`
- F13.6 Cayma hakkı süresi takibi ve iade penceresi kuralları
- F13.7 Yasal metin şablon kütüphanesi: avukat onaylı taslaklar, tenant değişkenleriyle doldurulur
- F13.8 Çerez onayı kaydı: kategori bazlı onay (zorunlu/analitik/pazarlama) Store API'de saklanır; F10.9 buna bakar
- F13.9 Mağaza künyesi: unvan, MERSİS, VKN, adres, KEP, ETBİS, sosyal hesaplar (`sameAs`) `platform-settings`'te; eksikse admin uyarısı, Store API'de ve `OnlineStore` JSON-LD'de döner
- F13.10 **Veri ihlali müdahale runbook'u:** tespit → sınırlama → etki analizi → tenant bilgilendirme şablonu → KVKK Kurulu bildirimi (72 saat) → ilgili kişi bildirimi → olay sonrası rapor; masa başı tatbikat (docs/04)

**KK:**
- [ ] Her siparişte ilgili sözleşme snapshot'ı ve onay kaydı mevcut
- [ ] Flag açıkken yaş onayı olmadan kısıtlı ürünlü sepet tamamlanamıyor
- [ ] Anonimleştirme sonrası siparişin muhasebe verisi korunuyor, kişisel veri temizleniyor
- [ ] Künye eksik mağazada admin uyarısı görünüyor
- [ ] İhlal runbook'u dokümante; tatbikat yapıldı ve kaydı var

---

## F14 — Veri Taşıma ve Geçiş Araçları
**Hedef:** Başka platformdan gelen mağazanın SEO'sunu ve verisini kaybetmeden taşınması. Detay: `docs/13` §12.

- F14.1 Geçiş çerçevesi: `MigrationSource` arayüzü (ürün, kategori, marka, müşteri, sipariş geçmişi, yorum, URL),
  kuru çalıştırma (dry-run) raporu, idempotent yeniden çalıştırma
- F14.2 Shopify kaynağı
- F14.3 Türk platformları kaynakları (Ticimax, ikas, IdeaSoft, T-Soft vb.) — erişim yöntemi (API/XML/CSV) her biri için doğrulanır; XML'de güvenli parser
- F14.4 Görsellerin taşınması (`safe-fetch` ile indir → yeniden kodla → S3) ve eski URL'lerden 301 yönlendirme üretimi (F3.5)
- F14.5 Müşteri şifreleri taşınamaz: toplu "şifreni belirle" davet akışı (işlemsel ileti)
- F14.6 Geçiş runbook'u: DNS geçişi, dondurma penceresi, doğrulama sayımları, geri dönüş planı
- F14.7 **SEO geçiş protokolü:** eski site URL envanteri (sitemap + tarama + GSC dışa aktarımı), eşleme raporu (eşleşmeyenler için karar), kesim öncesi kontrol listesi, kesim sonrası 30 gün 404/GSC izleme ve uyarılar

**KK:**
- [ ] Örnek veriyle Shopify geçişi dry-run + gerçek çalıştırma yapılıyor; sayımlar eşleşiyor
- [ ] Yarıda kalan geçiş tekrar çalıştırılınca mükerrer kayıt oluşmuyor
- [ ] Eski ürün URL'leri 301 ile yeni adreslere çözülüyor; en çok trafik alan ilk 100 URL'nin tamamı eşlenmiş
- [ ] Görsel indirme iç IP'ye yönlendiren URL'yi reddediyor (testli)

---

## F15 — Sertleştirme (Doğrulama)
Güvenlik tabanı F0–F2'de kuruldu; bu faz doğrular ve derinleştirir.

- F15.1 Güvenlik review (`/guvenlik-review` + `security-reviewer` ajanı), bulguların kapatılması
- F15.2 Taban doğrulaması: rate limit, header, CORS, CSRF, upload, SSRF testlerinin uçtan uca koşulması; OWASP ZAP otomatik taraması CI'da (staging)
- F15.3 Yük testi (k6): checkout, ürün listeleme, webhook patlaması, kampanya anı (ani trafik), sitemap/robots uçları
- F15.4 Gözlemlenebilirlik: yapılandırılmış log (pino), OpenTelemetry trace, hata izleme (self-host seçenekli, ADR-0003)
- F15.5 Yedekleme ve geri yükleme provası
- F15.6 `fraud-guard` modülü: login/kayıt/checkout'ta captcha (self-host seçenekli; sağlayıcı ADR ile), velocity kuralları (kart/IP/e-posta),
  şüpheli sipariş işareti + admin inceleme kuyruğu, kara liste
- F15.7 Kenar güvenliği: WAF, DDoS koruması, bot yönetimi (CDN katmanı; ADR-0003 ile birlikte)
- F15.8 Dış penetrasyon testi ve bulguların kapatılması
- F15.9 Sorumlu açıklama: `security.txt`, iletişim kanalı, SLA; bağımlılık ve imaj taramalarının dönemsel raporu

**KK:**
- [ ] Kritik/yüksek güvenlik bulgusu yok (iç review + dış pentest)
- [ ] Hedef yük altında p95 < 500 ms (Store API okuma), checkout hata oranı < %0,5
- [ ] Geri yükleme provası dokümante ve başarılı
- [ ] Velocity kuralını aşan checkout engelleniyor veya incelemeye düşüyor (testli)

---

## F16 — Dağıtım ve Tenant İşletimi
Detay: `docs/08-devops.md`, `adr/0003-hosting-ve-veri-yerlesimi.md`

- F16.1 ADR-0003 kararının uygulanması (hosting, bölge, orkestrasyon)
- F16.2 Üretim Dockerfile (multi-stage, non-root), server/worker ayrı süreç; DB/Redis TLS + auth, yalnızca iç ağ
- F16.3 Tenant şablonu: env şablonu, DB oluşturma, migration, admin kullanıcı, seed
- F16.4 `infra/tenant/create-tenant` script'i (idempotent)
- F16.5 CI/CD: staging otomatik, prod onaylı; migration stratejisi (geri uyumlu)
- F16.6 Tüm tenant'lara sürüm yayma (rolling, canary tenant)
- F16.7 Alan adı: varsayılan alt alan adı + tenant'ın kendi domain'i (DNS TXT sahiplik doğrulaması), otomatik SSL; özel domain bağlanınca platform alt alan adı 301
- F16.8 Tenant bazlı yedek ve tek tenant geri yükleme; RPO/RTO hedefleri
- F16.9 Platform izleme: tüm tenant'ların sağlık paneli, tenant etiketli merkezi log/hata, uyarı → nöbet, durum sayfası
- F16.10 Destek erişimi (break-glass): platform personelinin tenant admin'ine süreli, gerekçeli, audit log'lu erişimi; tenant'a bildirim
- F16.11 Tenant kapatma: veri dışa aktarma paketi, saklama süresi sonunda silme, secret iptali, DNS/sertifika temizliği + subdomain takeover kontrolü
- F16.12 Maliyet görünürlüğü: tenant başına kaynak kullanımı ve maliyet raporu
- F16.13 Staging/önizleme ortamlarının indekslenmediğinin otomatik kontrolü (`noindex` + auth), tenant başına SEO sağlık özeti platform panelinde

**KK:**
- [ ] Tek komutla yeni tenant ayağa kalkıyor ve health check yeşil
- [ ] Sürüm yükseltmede kesinti yok (rolling)
- [ ] Özel domain bağlanınca SSL otomatik alınıyor; sahiplik doğrulanmadan bağlanamıyor
- [ ] Tek tenant geri yüklemesi diğer tenant'ları etkilemiyor
- [ ] Destek erişimi audit log'da görünüyor ve süre dolunca kapanıyor
- [ ] Kapatılan tenant'ın alt alan adı üçüncü kişi tarafından devralınamıyor (testli)

---

## F17 — Control Plane
Ayrı uygulama (`apps/control-plane`). Başlamadan önce ayrı ADR (teknoloji, veri modeli, güvenlik sınırı, secret şifreleme).

- F17.1 Tenant kaydı ve onboarding sihirbazı: firma bilgisi, paket seçimi, alt alan adı, kurulum tetikleme (F16.4)
- F17.2 Paketler ve limitler: ürün/sipariş/personel/depolama/LLM kotası limitleri, kullanım ölçümü, limit uyarısı
- F17.3 Abonelik faturalama: periyodik tahsilat, deneme süresi, gecikmede kısıtlama; kendi e-faturamız (F8 adaptörü)
- F17.4 Secret girişi: tenant sağlayıcı anahtarlarını şifreli girer → secret store (KMS destekli envelope encryption, döndürme planı) → rolling restart (adr/0002)
- F17.5 Sürüm yönetimi: tenant sürüm görünümü, dalga planı, canary
- F17.6 Platform yönetici paneli: tenant listesi, durum, kullanım, destek erişimi başlatma (F16.10)
- F17.7 Sektör paketi atama: tenant'a attribute şablonları + flag ön ayarı + SEO şablon seti yükleme

**KK:**
- [ ] Yeni müşteri kendi kendine kayıt olup deneme mağazasını açabiliyor
- [ ] Abonelik ödemesi alınamazsa tanımlı süre sonunda mağaza kısıtlanıyor, veri silinmiyor
- [ ] Secret değişikliği kesintisiz uygulanıyor ve hiçbir yerde düz metin görünmüyor

---

## F18 — Storefront ve Çoklu Tema (sonraki aşama)
Şimdi kod yazılmaz, ama backend şu garantileri verir ve storefront şu kurallara uyar:
- Store API tema bağımsızdır; tema'ya özel alan backend'e sızmaz. `seo` payload'ı (doc 13 §1) her temada olduğu gibi basılır; tema kendi SEO mantığı yazmaz.
- **SSR zorunlu:** title, meta, canonical, robots, JSON-LD ilk HTML'de; JavaScript'le enjekte edilmez. Non-200 sayfalarda JS render'a güvenilmez.
- **Core Web Vitals bütçeleri:** LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (p75, mobil). LCP görseli lazy değil; `srcset`/WebP/AVIF; HTML ilk 2 MB içinde kritik içerik.
- `/sitemap.xml`, `/robots.txt`, `/llms.txt` (opsiyonel) backend'den proxy'lenir; 404'ler `POST /store/seo/not-found` ile bildirilir; `GET /store/seo/resolve` middleware'de.
- URL normalizasyonu (büyük harf, çift slash, trailing slash → 301), canonical host yönlendirmesi edge'de.
- Ajan dostu HTML: gerçek `<button>`/`<a>`, etiketli formlar, kararlı layout; geri tuşu manipülasyonu yok; intrusive interstitial yok.
- Tema ayarları (renk, logo, layout seçimi) `platform-settings`'te JSON şema ile tutulabilir.
- `packages/types` Store API sözleşmesini taşır; temalar bu sözleşmeye bağlanır; kimlik taşıma adr/0004.
- Çerez onayı (F13.8), dönüşüm olayları (F10.9) storefront'un hazır kullanacağı şekilde sunulur.
- Planlanan yapı: `apps/storefront` (Next.js) + `packages/themes/<tema>` + ortak `packages/ui`.
- Arama: Meilisearch (backend'de indeksleme subscriber'ı bu fazda eklenir).
- Kabul: demo mağaza `/seo-audit`, `/seo-technical`, `/seo-schema` skill'leri ve Lighthouse (SEO + Agentic Browsing) ile denetlenir; kritik bulgu yok.

---

## F19 — Genişleme (sonraki aşamalar)
Her başlık başlamadan önce kendi ADR'ı ve faz planıyla açılır.

- **Pazaryeri entegrasyonları:** Trendyol, Hepsiburada, N11, Amazon TR — ürün/stok/fiyat senkronu, sipariş çekme, iade
- **B2B:** firma hesapları, onaylı satın alma, vadeli ödeme/cari hesap, teklif (quote), firma fiyat listeleri
- **Yurt dışı satış:** çoklu para birimi, çoklu dil (ürün çevirisi, `hreflang`, locale'li slug), ETGB/mikro ihracat, uluslararası kargo
- **Ajan ticareti:** Google UCP profili (`/.well-known/ucp`), AP2 ödeme protokolü; Merchant Center + Product şeması ön koşul; ajan trafiği için sunucu tarafı erişim kontrolü
- **Sadakat programı:** puan kazanma/harcama, seviye, doğum günü kampanyası
- **Çok kanallı satış:** fiziksel mağaza stoğu, mağazadan stok sorgulama, POS entegrasyonu
- **Abonelik ürünleri:** periyodik sipariş (ör. aylık kutu)
- **Mobil uygulama:** aynı Store API üzerinden
- **Kendi e-posta gönderim altyapısı** ve **self-host gözlemlenebilirlik** (dış bağımlılığı azaltma; ADR-0003 ile)
