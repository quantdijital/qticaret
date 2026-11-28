# Çoklu dil (Türkçe/İngilizce) ve para birimi (USD/EUR) planı

> Durum: **taslak; Oğuzhan tarafından araştırmayla tamamlandı 2026-11-28; kararlar önerildi, ADR bekliyor.** İlk taslak Deniz (2026-11-27, PR #489). Kod yok. Yol haritasında F19 "Yurt dışı satış" (docs/03-yol-haritasi.md). Başlamadan önce tek ADR yazılır, §5'teki önerilen kararlar orada kesinleşir.
> Araştırma, kaynaklar ve güven düzeyleri: `docs/26-cok-dil-seo-arastirmasi.md`. Kod sayıları `origin/dev` @ `4ac35462a` (2026-11-28) üzerinden `git grep` ile; test dosyaları hariç.
> Kesin şart: **Türkçe SEO hiçbir aşamada bozulmaz.** Türkçe adresler, canonical, başlık, `lang` ve JSON-LD değişmez; İngilizce sayfalar ayrıca sıralanır (§7).

## 1. Kısa özet

- **Panel:** İngilizce çeviri tam: `apps/panel/src/locales/{tr,en}.json` **11.687**'şer anahtar, iki yönde fark 0; `packages/admin-ui/src/locales/{tr,en}.json` 53/53. Eksik olan dil seçimi: `src/lib/i18n.ts:23` `lng: "tr"` ve `apps/panel/index.html:2` `<html lang="tr">` sabit.
- **Vitrin:** tema metinleri `t()` ile geliyor (`packages/ui/src/theme.ts:39` `Translate`); yalnız `apps/storefront/src/lib/i18n/tr.json` var (**1.388** anahtar), `t` modül düzeyinde sabit (`index.ts:13`), istek başına değil. Sistem sayfa adresleri (`/sepet`, `/odeme`, `/hesap`…) ve **uygulama klasör adları** Türkçe (37 `page.tsx`).
- **Türkçe sabit yollar:** tema + `packages/ui` içinde **88** satır, `apps/storefront/src` içinde **256** satır; ayrıca `next.config.ts` başlık kuralları, CSP ve proxy yol testleri Türkçe yola bağlı.
- **Mağaza içeriği** (ürün, kategori, koleksiyon, marka, sayfa/blog, tema bölüm metinleri, menüler, nitelikler, açılır pencereler, tur programı, SEO alanları): tek dilde. **İşin en büyük parçası.**
- **Medusa çeviri modülü var:** `@medusajs/translation@2.22.6` kurulu, bayrakla açılıyor; 2.22.7'de varsayılan açık (§2.1).
- **Para birimi:** her yer TL varsayıyor: backend'de küçük harf `"try"` **49** dosya + büyük harf `"TRY"` **19** dosya; vitrinde tek TL bölgesi `liraRegion`, `formatLira`. PayTR USD/EUR/GBP/RUB eşleyebiliyor; iyzico `locale: "tr"` sabit; e-fatura TL dışını reddediyor (`einvoice.currency_unsupported`).
- **SEO altyapısı yarım:** `hreflang: []` backend'de boş, vitrin bu alanı hiç okumuyor; `og:locale` sabit `tr_TR`; site haritasında alternatif yapısı yok; `en` kökü rezerve değil.
- **E-posta, SMS, yasal metinler, PDF:** yalnız Türkçe. Backend hata mesajları tr + en hazır (1.253'er satır).

### Başlıkların yanındaki küçük İngilizce yazılar
Panel haritası (ADR-0079): her ekranın `{tr, en}` arama kelimeleri ve yardım metni (`packages/types/src/panel-map/*`). Komut menüsü araması içindir, paneli çevirmez; panel İngilizceye geçince kendiliğinden kullanılır.

## 2. Bugünkü durum (ayrıntı)

| Alan | Durum | Ana dosyalar |
|---|---|---|
| Panel metinleri | tr/en tam (11.687); dil seçimi yok; `index.html` `lang="tr"` | `apps/panel/src/lib/i18n.ts`, `apps/panel/index.html` |
| Panel biçimleri | 31 yerde `tr-TR` sabit; TL/₺/`"try"` geçen ~203 satır (yorum dahil, kaba) | `packages/admin-ui/src/lib/format.ts`, `features/products/detail/variant-fields.tsx` |
| Vitrin metinleri | yalnız `tr.json` (1.388), modül düzeyinde `t` | `apps/storefront/src/lib/i18n/index.ts` |
| Vitrin adresleri | Türkçe klasörler; 88 + 256 sabit yol satırı; `SYSTEM_ROOTS` ve backend `RESERVED_ROOT_SEGMENTS` tek dilli; **`en` rezerve değil** | `apps/storefront/src/lib/seo/paths.ts:8-32`, `apps/backend/src/lib/seo/paths.ts:8-55` |
| Vitrin yönlendirme | dil/ülke algılama yok (iyi); `isSystemPath`, `normalizedPath` yalnız ilk segmente bakıyor | `apps/storefront/src/proxy.ts`, `lib/seo/paths.ts:111-122,184-200` |
| Vitrin para | `formatLira`, `liraRegion` (5 dosyada 6 çağrı), ülke `tr`, analitik `CURRENCY = "TRY"`, OG fiyatı `TRY` | `packages/ui/src/money.ts`, `lib/store-api/requests.ts:128-142`, `lib/checkout/address-form.ts:87`, `lib/analytics/events.ts:8`, `screens/product.tsx:211` |
| Desteklenen dil/para | `["tr"]`, `["try"]`; ama neredeyse kullanılmıyor (3 yer); backend kendi `CATALOG_LOCALE = "tr"`'sini 35 dosyada kullanıyor | `packages/types/src/locale.ts`, `workflows/catalog/entity-paths.ts:37` |
| Adres kaydı | **yalnız şemada** dile hazır: `(locale, path)` benzersiz; her yazan/okuyan `CATALOG_LOCALE`; `resolve` sabit `tr` | `modules/url-registry/models/url-entry.ts`, `workflows/seo/redirects/resolve.ts:91` |
| SEO nesnesi | `hreflang: []`; canonical hep `tr` yolu; vitrin `alternates.languages` yok; `og:locale` sabit | `lib/seo/resolve.ts:210-249` (backend), `apps/storefront/src/lib/seo/metadata.ts:15,25` |
| SEO alanları | `seo_meta`'da dil sütunu yok; varlık başına tek satır (8 bağlantı); başlık hash'i dil bilmiyor | `modules/seo-meta/models/seo-meta.ts:34-50`, `links/*-seo-meta.ts` |
| Site haritası, robots | `xhtml:link` yok; robots Türkçe sistem yollarını kapatıyor | `lib/seo/sitemap.ts:8-26`, `migration-scripts/seo-robots-exact-system-pages.ts` |
| JSON-LD | `priceCurrency: "TRY"` sabit; `inLanguage` yok | `lib/seo/jsonld-product.ts:150,159`, `jsonld-dated.ts:78`, `jsonld-shipping.ts:20` |
| Önbellek | vitrin `shared` yol+sorgu anahtarlı (60 sn), `resolve` yalnız yol (10 sn); backend 27 store rotası `public, max-age`, `Vary` yalnız publishable key | `lib/store-api/server.ts:122`, `resolutions.ts:22-36`, `api/store/seo/resolve/route.ts:18-20` |
| İçerik çevirisi | tek dil (model tablosu §3 C) | `modules/content`, `storefront-layout`, `storefront-menus`, `product-attributes`, `popups`, `booking` |
| Hata mesajları | tr + en hazır | `apps/backend/src/lib/errors/messages/{tr,en}.ts` |
| E-posta/SMS | yalnız tr (27 dosya şablon; düzenlenebilir metin şablon başına tek satır) | `lib/messaging/texts.ts`, `modules/messaging/models/message-template-text.ts` |
| Yasal metinler | Türkçe başlangıç metinleri; `legal_document` `(kind, version)` benzersiz, dil yok | `lib/legal/starters/`, `modules/legal` |
| Ödeme | PayTR `try/eur/usd/gbp/rub`, `lang` hiç geçirilmiyor; iyzico `locale: "tr"` sabit; sağlayıcı seçimi bölgeye değil mağaza ayarına bağlı | `lib/payments/paytr/fields.ts:10-35`, `iyzico/checkout-form.ts:56`, `card-providers.ts:23-40` |
| Fatura | TL dışı reddedilir; tipler `"TRY"`; BirFatura JSON ucu yalnız standart satış | `lib/invoicing/draft.ts:169,196`, `birfatura/map.ts:138` |
| Besleme | Merchant API (Content API değil) kullanılıyor; veri kaynağı `contentLanguage: "tr", feedLabel: "TR", countries: ["TR"]` sabit | `lib/google/client.ts:147`, `lib/google/merchant.ts` |
| Rezervasyon (tur) | 7 dosyada `"try"`; `booking.currency_unsupported` | `lib/booking/cart-lines.ts:123`, `workflows/booking/*` |
| Kargo | yalnız Türkiye (adres veritabanı, yerli firmalar) | `modules/tr-address`, `fulfillment-*` |
| Bölge | tek bölge `Türkiye`, `try`, `countries: ["tr"]`, `is_tax_inclusive: true`, 5 sağlayıcı | `scripts/bootstrap/region.ts:38-56` |

### 2.1 Medusa çeviri modülü (açık nokta kapandı)

- **Kurulu:** `@medusajs/translation@2.22.6` (`pnpm-lock.yaml:3052`), `@medusajs/medusa`'nın bağımlılığı. `defineConfig` modülü her zaman ekler ama `disable: !FeatureFlag.isFeatureEnabled("translation")`; bayrak `MEDUSA_FF_TRANSLATION` ya da `featureFlags.translation`, varsayılan kapalı. Bizim `medusa-config.ts`'de bayrak yok.
- **2.22.7:** "Starting from Medusa v2.22.7, the Translation Module is enabled by default." Yükseltme ayrı PR (C1).
- **Kapsam (çekirdek):** ürün (title, subtitle, description, material), varyant, seçenek ve değerleri, kategori, koleksiyon, tür, etiket; v2.12.4'ten beri bölge, kargo seçeneği, vergi oranı.
- **İstek dili:** önce `?locale=` sorgusu, sonra `x-medusa-locale` başlığı (`apply-locale` ara katmanı). Çekirdek store rotaları `locale: req.locale` ile sorgular. **Çeviri yoksa özgün metin döner**: bu sessiz geri düşüş vitrinde "çeviri tamam mı" denetimiyle engellenir (§5 karar 3).
- **Bizim modüller:** `model.text().translatable()` 2.22.6'da var (v2.13.0+) ama **yalnız `text`** alanlarda; gövdelerimiz çoğunlukla `json` (`body`, `description_doc`, tema `draft/published`, tur `program`). Bu yüzden bizim modüllerde dil başına kendi alanımız tutulur (§5 karar 5).
- Doğrulanmadı: Medusa'nın `locale` kod biçimi (`en` mi `en-US` mi) ve `locale` tablosunun tohum değerleri; C1'de kurulu pakette bakılır.

### 2.2 Bu taslağın ilk sürümüne göre düzeltmeler

| # | İlk taslak | Doğrusu |
|---|---|---|
| 1 | Medusa çeviri modülü doğrulanmadı | Var ve kurulu (§2.1) |
| 2 | ~40 dosyada `"try"` | 49 + 19 dosya; tur akışı, dönüşüm olayları (`lib/conversions/events.ts`), kargo etiketi, mesaj tutar biçimleri, Shopify göç kontrolü de dahil |
| 3 | Panel 11.252 anahtar | 11.687; `admin-ui` ad alanı ve `index.html` `lang` da var |
| 4 | Temada 37 sabit bağlantı | 88 (tema + ui) + 256 (vitrin) satır; 37 `page.tsx` sayısı |
| 5 | — | `en` kökü rezerve değil; önce rezerve edilmeli (Aşama 0) |
| 6 | Adres kaydı dile hazır | Yalnız şemada; 35 dosya `CATALOG_LOCALE`, iki ayrı "varsayılan dil" sabiti |
| 7 | hreflang alanı boş | Vitrin de okumuyor; `og:locale`, OG fiyatı, `inLanguage` sabit/eksik |
| 8 | Sitemap'te alternatifler | Küçük değil: `SitemapEntry`, `sitemap-build.ts`, `sitemap-file` değişir |
| 9 | Önbellek yok | Dil başlıkla taşınırsa çapraz dil sızıntısı (§5 karar 6) |
| 10 | iyzico yok | iyzico dili sabit; sağlayıcı seçimi bölgeye göre değil |
| 11 | Yasal metin | `legal_document` dilsiz, onay kaydı sürüme bağlı: çeviri aynı sürümün kardeşi olur (E) |
| 12 | Advisor yok | docs/14'te dil kuralı yok; piksel genişliği ve metin ölçütleri Türkçe varsayımlı; hash dil başına |
| 13 | docs/13 §11 "SEO alanları locale taşır" | Yanlış: `seo_meta` taşımıyor, `x-default` kuralı kodda yok; ADR'de düzeltilir |
| 14 | Dil/ülke beslemesi | `lib/google/client.ts:147` veri kaynağı sabit `tr/TR` |
| 15 | — | Turnstile `language: "tr"` (`app/layout.tsx:113`) sabit |
| 16 | D1 "≈ $X göster, TL öde" | Türkçe vitrinde döviz gösterimi hukuken şüpheli; D1 yeniden tanımlandı (§3) |
| 17 | `/en` slug'ı açık soru | İngilizce slug; yoksa İngilizce URL üretilmez (§5 karar 2) |
| 18 | Eksik alanda Türkçeye düş | Düşmez: zorunlu alan eksikse `/en` sayfası 404 (§5 karar 3) |

## 3. Aşamalar

Her aşamada iki ortak koşul: (1) **TR HTML karşılaştırması** (§9.1, K23): örnek Türkçe sayfaların (ana sayfa, ürün, kategori, blog, sayfalı liste) canonical, title, description, `lang`, robots ve JSON-LD'si aşamadan önce ve sonra aynı; tek izinli fark, İngilizce vitrin açıkken eklenen hreflang ve dil seçici bağlantısı. (2) Googlebot benzeri istek testleri (§9.1) yeşil.

### 0 — Hazırlık (küçük, risksiz; 3 PR; hemen)

- **Kapsam:** dil kökünü rezerve etmek, dilin yalnız sorguyla taşınmasını güvenceye almak, SEO duman testi altyapısı.
- **PR 0-1 (Oğuzhan):** `apps/backend/src/lib/seo/paths.ts` `RESERVED_ROOT_SEGMENTS`'e `en` ve ISO 639-1 dil kodları için kural (iki harfli kök + `xx-yy` biçimi kayda verilemez); vitrin `SYSTEM_ROOTS` aynası; var olan kayıtlarda bu köklere çarpan yol var mı denetleyen göç betiği (varsa panelde uyarı, otomatik değiştirmez); eski `seo_redirect.source` içinde `/en/...` kaynaklı kural denetimi.
- **PR 0-2 (Deniz):** store tarafında dil yalnız `?locale=` sorgusuyla kabul edilir; `x-medusa-locale` başlığı store rotalarında yok sayılır (silinir), böylece `public, max-age` veren 27 rota URL'yle anahtarlanmaya devam eder. Süreç içi önbellekler (`workflows/seo/redirects/resolve.ts:204-218`, fiyat gösterimi) anahtara `locale`'i katar (bugün yalnız `tr`). `CATALOG_LOCALE` ile `packages/types` `DEFAULT_LOCALE` tek sabitte birleşir.
- **PR 0-3 (Oğuzhan):** SEO duman testi altyapısı (§9.1): vitrin birim testinde Googlebot benzeri istek tablosu (Accept-Language yok, ABD; `tr` başlıklı; çerezli) ve TR HTML anlık görüntüsü; canlı ortam için `pnpm seo:smoke -- --base <url>` betiği (öneri adı).
- **Kabul:** `/en` hiçbir kayda verilemez; aynı store isteği `x-medusa-locale: en` başlığıyla ve başlıksız aynı gövdeyi döner; duman testi bugünkü vitrinde yeşil ve TR görüntüsü kayıtlı.
- **SEO bozulmaz:** TR HTML farkı sıfır; robots ve site haritası farkı sıfır.

### A — Panel İngilizce (küçük, 2–3 PR; bağımsız, hemen yapılabilir)

- **Kapsam:** kullanıcı menüsünde dil seçimi (personel başına saklanır, tarayıcıda önbellek); sabit `lng` ve `index.html` `lang` dile göre; ortak `formatNumber / formatDate / formatMoney(tutar, para, dil)`, 31 sabit `tr-TR` buna taşınır; panel dili backend'e gider, hata mesajları İngilizce döner.
- **PR dilimleri:** A-1 dil seçimi + `lang` + saklama; A-2 biçim yardımcıları ve 31 yerin taşınması; A-3 backend hata dili + tr/en anahtar eşitliği testi (var olanı `admin-ui` ad alanını da kapsayacak biçimde genişletir) + İngilizce duman testi.
- **Kabul:** dil değişince yeniden yüklemeden tüm ekran İngilizce; para tutarı para biriminin kendi biçimiyle; eşitlik testi kırmızıysa CI kırmızı.
- **SEO bozulmaz:** vitrine dokunmaz; TR HTML farkı sıfır.
- **Sahibi:** Deniz (öneri).

### B — Vitrin kabuğu İngilizce, `/en` adresleri (orta, 6–7 PR)

- **Kapsam:** `/en` öneki, İngilizce sistem sayfaları, `en.json`, istek başına `t`, dil başına `lang`/`og:locale`/`content-language`, hreflang ve site haritası altyapısı, öneri bandı, dil seçici. İçerik henüz Türkçe olduğu için **`/en` bütünüyle `noindex`** ve hreflang/site haritasına girmez; katalog sayfaları İngilizce slug gelene kadar (C) 404.
- **Yönlendirme yöntemi:** klasörler yerinde kalır; proxy `/en/...` isteğini iç `rewrite` ile Türkçe klasöre verir ve dili iç başlıkla (`x-qt-locale`, yalnız proxy → sayfa) taşır. URL dili belirler, başlık yalnız iç aktarımdır. `[lang]` segmentiyle klasör taşıma Türkçe için de önek isteyeceği için seçilmez.
- **PR dilimleri:**
  - B-1 (Oğuzhan): tek yol haritası `packages/ui` (`routes.ts`: sistem sayfası anahtarı → `{tr, en}` yolu); temadaki 88 ve vitrindeki 256 sabit yol buna geçer. Davranış aynı, yalnız `tr`.
  - B-2 (Oğuzhan): proxy önek tanıma; `isSystemPath`, `isCataloguePage`, `resolvesAt`, `normalizedPath`, `isPaymentReturn`, `LAYOUT_PREVIEW`, `isPreviewPath`, CSP yol testleri önekten sonraki segmente bakar; `next.config.ts` başlık kurallarına `/en/...` karşılıkları (ödeme dönüşü, önizleme, `ode`, `abonelik`).
  - B-3 (Oğuzhan): `en.json` (1.388 anahtar), istek başına `t`, `formatMoney` dile ve paraya duyarlı, `<html lang>`, `og:locale`, `content-language`, Turnstile dili; vitrin tr/en anahtar eşitliği testi.
  - B-4 (Deniz): url-registry'de `locale` gerçek parametre (35 dosyada `CATALOG_LOCALE` yerine çağıranın dili); `resolve` dil bilir; 404 raporu (`seo_not_found`) dil içerir; IndexNow ve denetim işleri dil başına.
  - B-5 (Oğuzhan): SEO çıktısı: backend `resolveSeoPayload` hreflang kümesi + x-default kuralı; vitrin `metadataOf` `alternates.languages`; site haritası `xhtml:link` (yalnız yayımlanmış karşılığı olan URL'ler) ve dil başına bölme; robots'a İngilizce sistem yolları (`/en/cart`, `/en/search`…).
  - B-6 (Oğuzhan): dil seçici (`<a href>`) ve öneri bandı (§5 karar 1); "İngilizce vitrin" mağaza ayarı (varsayılan kapalı).
- **Kabul:** ayar kapalıyken `/en/*` 404 ve hiçbir Türkçe sayfada hreflang yok; açıkken `/en` ve sistem sayfaları İngilizce, `noindex` ve canonical'ı Türkçe sayfayı göstermez (docs/13 §1'deki canonical/`noindex` çelişkisine düşülmez). Ödeme dönüşü `/en/...` altında kart sağlayıcısının çerçevesinde çalışır.
- **SEO bozulmaz:** TR HTML farkı sıfır (ayar kapalıyken ve `/en` `noindex` iken hreflang eklenmez); `/en` istekleri Türkçe 404 listesini kirletmez; `/` ve Türkçe sayfalar her Accept-Language ve çerezde aynı 200 yanıtı verir.
- **Sahibi:** Oğuzhan (yönlendirme, SEO, tema yolları, bant, seçici); Deniz (B-4).

### C — Mağaza içeriğinin çevirisi (büyük, 8–10 PR)

- **Kapsam:** çekirdek varlıklar Medusa Translation ile; bizim modüllerde dil başına alan; İngilizce slug; tamamlanma denetimi; panel çeviri ekranları; yapay zekâ taslağı + insan onayı; `/en`'in indekse açılması; İngilizce Merchant veri kaynağı.
- **Çeviri gereken bizim modeller (öneri: dil başına kardeş satır, `<model>` + `locale`):**

| Model | Alanlar | Not |
|---|---|---|
| `catalog-extension/product-extension` | `description_doc`, `summary_doc` (json), `badge`, `addons` etiketleri | vitrindeki zengin açıklama |
| `catalog-extension/collection-extension`, `category-extension`, `category-image` | `description`, `description_doc`, `image_alt`, `alt` | |
| `brands/brand` | `name`, `description`, `description_doc` | slug url-registry'de |
| `seo-meta/seo-meta` | `seo_title`, `seo_description`, `focus_keyword`, `og_image_alt`; hash'ler dil başına | **`locale` sütunu**; bağlantı tek satırdan dil başına satıra |
| `content/content-entry`, `content-term`, `content-author`, `landing-page` | başlık, `body` (json), özet, `excerpt`, `image_alt`, `job_title`, `bio`, `facet_value` | `(kind, handle)` dilsiz kalır; İngilizce slug url-registry'de |
| `storefront-layout` (+ `storefront-design`, revizyonlar) | bölüm metinleri `draft/published` belgesinde | tema editöründe dil başına metin |
| `storefront-menus/storefront-menu-item`, `storefront-menu` | `label`, `url`, `title` | `url` dil başına |
| `product-attributes/*` | `label`, `unit`, `options`, `group`, `aliases`, `option_title`, değerler | şablon adları da |
| `popups/popup` | `title`, `body`, `image_alt`, `button_label`, `button_href` | |
| `booking/bookable` | `program` (json), `traveler_fields`, `cancellation_tiers` etiketleri | tur programı |
| `legal`, `messaging` | E aşamasında | |

- **PR dilimleri:**
  - C1 (Deniz): Medusa 2.22.7'ye yükseltme (ayrı PR; bayrak gereksizleşir); `locale` kod biçimi doğrulaması; çekirdek varlıkların İngilizcesi Store API'de `?locale=en`.
  - C2 (ortak): çeviri modeli ADR'si ve ortak yardımcı (`locale`'li kardeş satır, "zorunlu alanlar" tanımı, tamamlanma hesabı); `seo_meta` `locale` sütunu ve göçü (Deniz).
  - C3 (Deniz): url-registry `locale='en'` girişleri, İngilizce slug üretimi ve 301 (dil içinde); İngilizce slug'ı olmayan varlığın İngilizce URL'si yok.
  - C4 (Deniz): içerik/blog, marka, nitelik, menü, açılır pencere, tur programı modellerinin dil satırları ve Store API'de `?locale=` ile dönüşü.
  - C5 (Oğuzhan): tema editöründe dil başına bölüm metinleri ve menüler; vitrin "çeviri tamam mı" denetimi (eksikse 404; isteğe bağlı alan eksikse gösterilmez, Türkçe metin İngilizce sayfaya girmez).
  - C6 (ortak): panelde düzenleme ekranlarında "Türkçe | English" sekmesi, varlık başına tamamlanma göstergesi, "eksik çeviriler" listesi.
  - C7 (ortak): "Yapay zekâyla çevir" (docs/22 çekirdeği ve docs/23 kredisi): taslak üretir, kayıt "onay bekliyor" durumunda kalır; toplu yayın tek tek ya da örneklem incelemesiyle onaylanmadan olmaz; başlık, meta ve JSON-LD metni de incelenir.
  - C8 (Oğuzhan): `/en`'in indekse açılması: "İngilizce vitrin" açıkken yalnız tamamlanmış sayfalar `index`, hreflang ve site haritasına girer; advisor'a dil başına kurallar (docs/14 eki: İngilizce başlık genişliği, eksik çeviri, yinelenen başlık dil içinde).
  - C9 (Deniz): Merchant API'de İngilizce veri kaynağı (`contentLanguage: "en"`, ayrı feed label, `[link]` `/en` URL'si); D1'e kadar TRY fiyatla açılmaz, D1'le birlikte açılır.
- **Kabul:** bir ürünün İngilizcesi yarımken `/en/<slug>` 404, hreflang'de ve site haritasında yok; tamamlanınca üçünde de var ve karşılıklı; yapay zekâ taslağı onaysız yayımlanmaz; panel eksikler listesi doğru sayıyı gösterir.
- **SEO bozulmaz:** TR HTML farkı yalnız eklenen hreflang + seçici; Türkçe `seo_meta` İngilizce yazımla değişmez (dil başına satır testi); Türkçe slug değişmez; yinelenen başlık denetimi dilleri karıştırmaz.
- **Sahibi:** ortak model; Deniz backend ve yükseltme; Oğuzhan tema editörü, vitrin denetimi, indekse açma.

### D1 — `/en` pazarında gerçek döviz fiyatı ve ödeme (orta–büyük, 6–8 PR)

D1 ilk taslaktaki "yalnız gösterim" değildir: Türkçe vitrinde döviz göstermek hukuken şüpheli (§8). Yeni tanım: **`/en` pazarında fiyat kurla hesaplanır, sepet ve ödeme de o para biriminde olur.** Yani ilk taslağın D1'i ile D2'nin "gerçek döviz ödemesi" birleşti; D2 yalnız elle fiyat ve fatura otomasyonudur.

- **Kapsam:** uluslararası bölge (tek para birimi, mağaza ayarıyla USD ya da EUR, varsayılan USD; Türkiye hariç ülkeler); günlük TCMB kur işi + marj + yuvarlama ile varyant fiyatı; `liraRegion` kilidi kalkar, bölge URL'nin pazarından; `/en`'de Türkiye adresi seçilirse sepet TRY bölgesine geçer ve kullanıcıya bildirilir; 68 dosyadaki TL varsayımı (kargo eşiği, kampanya, hediye kartı, ödeme bağlantısı, rapor, muhasebe, besleme, JSON-LD, dönüşüm olayları, rezervasyon) para birimine duyarlı; bölge başına ödeme sağlayıcısı; tur ürünlerinde uyruk/ikamet beyanı.
- **PR dilimleri:**
  - D1-1 (Deniz): uluslararası bölge + mağaza para birimi + `price_preference`; panelde bölge başına sağlayıcı seçimi (Medusa `region_payment_provider`); `card-providers.ts` bölgeye bakar.
  - D1-2 (Deniz): kur işi (TCMB, günde bir; kaynak, tarih ve kur siparişte saklanır), fiyat hesaplama (kur × marj, yuvarlama kuralı), sepette kur sabitleme.
  - D1-3 (Deniz): `"try"`/`"TRY"` yerlerinin para birimine duyarlı hâle gelmesi (kargo, kampanya, hediye kartı TL'de kalır ve `/en`'de kullanılamaz, raporlar para birimi başına).
  - D1-4 (Deniz): PayTR `currency` + `lang: "en"`, iyzico `currency` + `locale: "en"`; döviz ödemede taksit kapalı; isteğe bağlı Stripe sağlayıcısı (yalnız yurt dışı şirketi olan mağaza, §8.3).
  - D1-5 (Oğuzhan): vitrinde fiyat, JSON-LD `priceCurrency`, OG fiyatı, analitik para birimi URL pazarından; Türkiye adresine geçişte bölge değişim bildirimi; ödeme sayfası metinleri.
  - D1-6 (Deniz): tur ürünlerinde uyruk/ikamet beyanı (ayar, yalnız tarihli/hizmet ürünleri); T.C. vatandaşı + Türkiye yerleşik beyanında yurt içi tur sepeti TRY bölgesine düşer.
  - D1-7 (Deniz): fatura geçici yolu: TL dışı siparişte otomatik kesim kapalı, sipariş "faturayı dış programda kesin" durumuna düşer (bugünkü geri yazma yolu); `einvoice.currency_unsupported` engeli otomatik kesimde korunur. Merchant İngilizce veri kaynağı açılır (C9).
- **Ön koşul:** "Yurt dışı satış" ayarı E1 (İngilizce ön bilgilendirme ve mesafeli satış sözleşmesi) bitmeden açılamaz; avukat ve mali müşavir maddeleri (§8.4) cevaplanmadan canlıda açılmaz.
- **Kabul:** Türkiye teslimat adresli hiçbir sipariş TRY dışında oluşamaz (bölge testi); `/en` ürün sayfasında görünen fiyat, JSON-LD `price`/`priceCurrency` ve Merchant verisi aynı; aynı URL hiçbir çerez ya da IP ile başka para birimi göstermez; sepette kur sabit kalır.
- **SEO bozulmaz:** Türkçe sayfalarda fiyat, para birimi ve JSON-LD değişmez (TL, KDV dahil); `/en` fiyatı bot için de aynı (Googlebot benzeri istek testi).
- **Sahibi:** Deniz (bölge, para, ödeme, kur, fatura); Oğuzhan (vitrin fiyat gösterimi, JSON-LD).

### E — E-posta, SMS, yasal metinler, belgeler (orta, 3–4 PR)

- **Kapsam:** İngilizce mesaj tabloları ve şablonlar; sipariş hangi dilde verildiyse mesajlar o dilde (`order.metadata.locale`); düzenlenebilir metinler dil başına; İngilizce yasal başlangıç metinleri (**avukat kontrolü**); İngilizce sipariş PDF'leri. Kargo etiketi ve e-fatura Türkçe kalır (resmî belge).
- **PR dilimleri:** E1 yasal metinler: `legal_document` dil kardeşi (aynı `kind/version`, onay kaydı dil bilgisini de tutar), İngilizce ön bilgilendirme ve mesafeli satış; Türkçe metin müşteriye bağlantıyla ayrıca verilir; E2 mesaj tabloları ve şablonlar; E3 düzenlenebilir metinler dil başına; E4 PDF'ler.
- **Kabul:** İngilizce sipariş tüm e-postaları İngilizce alır; Türkçe siparişte hiçbir metin değişmez; onay kaydı hangi dildeki metnin onaylandığını gösterir.
- **SEO bozulmaz:** `/yasal/*` Türkçe sayfaları ve URL'leri aynı; İngilizce yasal sayfalar ayrı URL'de, karşılıklı hreflang.
- **Sahibi:** Deniz.

### D2 — Elle döviz fiyatı ve fatura otomasyonu (büyük, 4–6 PR)

- **Kapsam:** varyant başına elle döviz fiyatı (kur fiyatını ezer; Shopify'daki "sabit fiyat yüzdeyi ezer" deseni); indirim öncesi fiyat geçmişi para birimi başına (son 10 gün en düşük, Fiyat Etiketi m.11, Reklam m.14); döviz faturası BirFatura `SendDocument` + UBL-TR XML (`DocumentCurrencyCode`, `PricingExchangeRate`, istisna kodu 301); ETGB numarası bağlanınca KDV'siz fatura ("ETGB bekliyor" sipariş adımı); ETGB limiti (30.000 €, 600 kg) sepet uyarısı (ayar).
- **PR dilimleri:** D2-1 elle fiyat + panel; D2-2 fiyat geçmişi para birimi başına; D2-3 UBL-TR döviz faturası; D2-4 ETGB adımı ve KDV istisnası; D2-5 ETGB limit uyarısı.
- **Kabul:** ETGB numarası olmadan KDV'siz fatura kesilemez; fatura kuru siparişte saklanan kurdan; mali müşavir cevapları (docs/mali-musavir-sorulari.md §8) uygulanmış.
- **SEO bozulmaz:** fiyat değişikliği yalnız `/en` pazarında; Merchant verisi ve sayfa aynı anda güncellenir.
- **Sahibi:** Deniz. **Yurt dışı kargo** (yabancı adres, uluslararası firma, gümrük, varış ülkesi kısıtları) ayrı projedir.

## 4. Önerilen sıra ve iş bölümü

**0 → A → B → C → D1 → E → D2.** A, 0 ile paralel yürüyebilir. B `/en` `noindex` ile başlar, C8'de içerik hazır olunca açılır. D1'in satışa açılması E1'e bağlı (yukarıda).

| Kim | İş |
|---|---|
| Oğuzhan | vitrin yönlendirme, SEO (hreflang, site haritası, robots, duman testi), tema yolları, öneri bandı, dil seçici, tema editöründe çeviri, vitrin fiyat gösterimi |
| Deniz | backend bölge, para birimi ve ödeme, kur ve fatura, url-registry `locale`, Medusa yükseltmesi, Merchant veri kaynağı, e-posta ve yasal metinler (E), panel dili (A, öneri) |
| Ortak | çeviri modeli (C2), panel çeviri ekranları (C6), yapay zekâ çevirisi (C7) |

## 5. Kararlar (önerilen karar + varsayılan + ayar)

| # | Konu | Önerilen karar | Varsayılan | Mağaza ayarı |
|---|---|---|---|---|
| 1 | URL | Türkçe öneksiz, bugünkü URL'ler hiç değişmez; İngilizce `/en/...`. Dil algılama ve otomatik yönlendirme yok: ne bota ne kullanıcıya. Dil seçici düz `<a href>` bağlantısı. Kullanıcıya yalnız kapatılabilir öneri bandı: "This page is available in English"; istemcide tarayıcı diline (`navigator.languages`) bakar, sunucu HTML'inde yoktur, bot kullanıcı aracısına hiç çizilmez (`data-nosnippet`), yönlendirmez; seçim çerezde tutulur, URL'yi değiştirmez | bant açık | "Dil öneri bandı" aç/kapa |
| 2 | İngilizce slug | url-registry `locale='en'` girişi; çevrilmiş slug yoksa İngilizce URL üretilmez, Türkçe slug'a düşmez | yapay zekâ taslağından slug önerisi, onayla | — |
| 3 | Eksik çeviri | Zorunlu alanlar çevrilmeden `/en` sayfası yayımlanmaz: 404, hreflang ve site haritasında yok. Medusa'nın özgün metne düşmesi vitrin denetimiyle engellenir. İsteğe bağlı alan eksikse gösterilmez | "İngilizce vitrin" kapalı | "İngilizce vitrin" aç/kapa; açılınca yalnız tamamlanmış sayfalar; panelde tamamlanma göstergesi ve eksikler listesi |
| 4 | Çeviri yöntemi | Yapay zekâ taslağı + insan onayı; toplu yayın onaysız olmaz; kredi sistemi (docs/22–23); elle çeviri her zaman mümkün | taslak "onay bekliyor" | "Yapay zekâyla çevir" düğmesi (kredi varsa) |
| 5 | Çeviri depolama | Çekirdek varlıklar Medusa Translation (2.22.7'ye yükseltme ayrı PR); bizim modüllerde dil başına alan (`seo_meta` `locale` sütunu; içerik, blog, tema bölüm metinleri, menüler, nitelikler, açılır pencereler, tur programı dil satırı; tablo §3 C) | — | — |
| 6 | Önbellek | Dil yalnız URL'de ve Store API'de `?locale=` sorgusunda; başlıkla taşınmaz (`x-medusa-locale` store'da yok sayılır). Herkese açık önbellek başlığı veren 27 rota ve süreç içi önbellekler dili anahtara katar. `Vary: Accept-Language` kullanılmaz, çünkü içerik başlığa göre değişmez | — | — |
| 7 | hreflang | `tr` ve `en` (yalnız dil kodu); `<head>` içinde `<link>` (Yandex sitemap'i okumuyor) + site haritasında `xhtml:link`; HTTP `Link` başlığı yok. `content-language` meta (Bing için); `html lang` ve `og:locale` dile göre | x-default: İngilizce vitrin açıksa `/en`, değilse hiç (tek dilli sitede hreflang yok) | "x-default hedefi": İngilizce / Türkçe |
| 8 | Para birimi ve pazar | Para birimi URL'ye bağlı. `/` Türkiye pazarı: TRY, KDV dahil. `/en` uluslararası pazar: tek para birimi. Aynı URL'de çerezle para birimi değiştirilmez. İkinci yabancı para gerekirse Shopify modeliyle ikinci pazar URL'si (`/en-eu` EUR) ve `en-XX` hreflang; ilk sürümde yok. JSON-LD `priceCurrency` ve görünen fiyat URL'nin pazarına göre. Merchant Center: pazar başına ayrı veri kaynağı, Merchant API | USD | "Uluslararası para birimi": USD / EUR |
| 9 | Hukuk kısıtları | Yapı gereği zorunlu; ayrıntı §8.2 | — | tur ürünlerinde "uyruk beyanı" (açık, tur sektör paketinde) |
| 10 | Ödeme | Sağlayıcı bölgeye bağlı (Medusa yerleşik). TR bölgesi: PayTR ya da iyzico, TRY. Uluslararası bölge, ilk tercih: aynı yerli sağlayıcının döviz tahsilatı ya da bankanın dövizli sanal POS'u, mağazanın kendi Türk şirketiyle. Stripe yalnız yurt dışı şirketi olan mağazaya seçenek (resmî Medusa sağlayıcısı, PaymentIntent, bölge başına; Adaptive Pricing kullanılamaz) | uluslararası bölgede PayTR döviz | panelde bölge başına sağlayıcı (Deniz) |
| 11 | Fatura ve vergi | Yurt dışı satış faturası döviz cinsinden; kur, kaynak ve tarih siparişte saklanır. ETGB ile KDV istisnası; ETGB no gelmeden KDV'siz fatura kesilmez. BirFatura JSON ucu yetmez, UBL-TR XML gerekir (D2); D1'de dış programda kesim. Yurt dışı kargo ayrı proje | D1: elle kesim | "Fatura kesimi (döviz)": dış program / otomatik (D2'den sonra) |
| 12 | Kur | TCMB, günde bir (15:30 ilanından sonra); marj ve yuvarlama | döviz satış kuru, %0 marj, ,99'a yuvarla (öneri; mali müşavire sorulur) | kur türü, marj %, yuvarlama (,99 / tam sayı / yok) |
| 13 | Panel dili (A) | Bağımsız, hemen | Türkçe | personel başına dil |
| 14 | Sıra | 0 → A → B → C → D1 → E → D2; D1 = `/en`'de kurla gerçek döviz satışı, D2 = elle fiyat + fatura otomasyonu | — | — |
| 15 | İş bölümü | §4 | — | — |

## 6. Mağaza ayarları (özet, varsayılanlarıyla)

Sahibin kuralı: ikili soru yerine ayar ve varsayılan. Riskler §10'a taşındı.

| Ayar | Varsayılan | Aşama |
|---|---|---|
| İngilizce vitrin | kapalı | B (açılınca yalnız tamamlanmış sayfalar indekse girer, C8) |
| Dil öneri bandı | açık | B |
| x-default hedefi | İngilizce (vitrin açıksa) | B |
| Yurt dışı satış | kapalı; E1 ve hukuk onayı olmadan açılamaz | D1 |
| Uluslararası para birimi | USD (EUR seçilebilir) | D1 |
| Uluslararası bölge ülkeleri | Türkiye hariç tümü; mağaza daraltabilir | D1 |
| Kur türü, marj, yuvarlama | döviz satış, %0, ,99 | D1 |
| Uluslararası ödeme sağlayıcısı | PayTR döviz (iyzico döviz / banka dövizli POS / Stripe) | D1 |
| Uyruk/ikamet beyanı (tarihli/hizmet ürünleri) | açık (tur sektör paketinde) | D1 |
| Ürün "yurt dışına satılabilir" ve GTİP kodu (en az 4 hane) | açık; GTİP boş | D1/D2 |
| Yurt dışı vergi gösterimi | "Gümrük ve vergiler alıcıya ait (DAP)", ödeme sayfasında açık uyarı | D1 |
| Döviz fatura kesimi | dış program | D1 → D2 |
| ETGB limitleri | 30.000 €, 600 kg | D2 |

## 7. SEO sözleşmesi (zorunlu kurallar)

Her kural bir testle korunur (§9). Kaynaklar docs/26'da ayrıntılı; burada asıl kaynak. "İkincil" = birincil bulunamadı; "resmî değil" = arama motoru çalışanının kişisel açıklaması.

| No | Kural | Kaynak | Koruyan test |
|---|---|---|---|
| K1 | Her dil/pazar alt klasörde ve sabit URL'de; Türkçe öneksiz kalır | https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites | duman: `/`, `/en` 200 ve doğru dil |
| K2 | Otomatik yönlendirme yok (dil, IP, çerez); yalnız istemci öneri bandı | aynı sayfa ("Avoid automatically redirecting…"); https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages | duman: Accept-Language yok/`tr`/`en`, çerez var/yok → aynı 200, `Location` yok |
| K3 | Hazır i18n kitaplığı kullanılırsa algılama ve `Link` başlığı kapalı (next-intl `localeDetection: false`, `alternateLinks: false`) | https://next-intl.dev/docs/routing/configuration ; deney (docs/26 §6) | bağımlılık denetimi |
| K4 | Aynı URL çerezle ya da IP ile farklı dil/para göstermez | https://support.google.com/merchants/answer/15404838 ("against Google Shopping requirements"); https://support.google.com/merchants/answer/4752265 ; Shopify: paylaşılan URL'nin yalnız bir sürümü indekslenir https://help.shopify.com/en/manual/markets/seo | duman: farklı çerezlerle gövde özeti aynı |
| K5 | Çeviri ve fiyat sunucu HTML'inde | https://support.google.com/merchants/answer/12159029 ("Googlebot crawls the data present in the HTML…") | duman: JS'siz HTML'de dil ve fiyat |
| K6 | hreflang önce `<head>` `<link>`; site haritası Google için ek; HTTP `Link` başlığı yok | https://developers.google.com/search/docs/specialty/international/localized-versions ; https://yandex.com/support/webmaster/en/yandex-indexing/locale-pages | birim: metadata çıktısı; duman: `Link` başlığı yok |
| K7 | Karşılıklı ve kendine referanslı hreflang; canonical kendi URL'si ve aynı dilde, kümedeki URL'lerden biri | localized-versions; https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls | birim + duman: çift yönlü küme |
| K8 | Site haritasında `xhtml:link` alternatifleri (Yandex okumaz) | localized-versions; Yandex locale-pages | birim: `sitemap.ts` |
| K9 | `html lang`, `og:locale`, `content-language` sayfanın diliyle aynı | Google `lang` kullanmıyor (managing-multi-regional-sites); Bing: Canel tweet 2020, resmî değil https://twitter.com/facan/status/1304120691172601856 | duman |
| K10 | Çevirisi eksik sayfanın o dilde URL'si yok: 404, hreflang ve site haritasında yok; `noindex` yalnız B'deki site geneli geçiş | localized-versions ("only considered duplicates if the main content… untranslated"; "you can omit some languages") | birim: tamamlanma denetimi; duman: eksik ürün 404 |
| K11 | Slug ve SEO alanları dil başına; slug değişince dil içinde 301 | docs/13 §2 | url-registry testleri |
| K12 | Para birimi URL'nin pazarına bağlı; JSON-LD `price`/`priceCurrency` görünen fiyatla aynı | https://developers.google.com/search/docs/appearance/structured-data/merchant-listing ("distinct URL per currency"); MC 12159029 | duman: görünen fiyat = JSON-LD |
| K13 | Merchant Center pazar başına veri kaynağı, Merchant API ile (Content API 18.08.2026'da kapandı) | https://support.google.com/merchants/answer/14991840 ; https://developers.google.com/shopping-content/guides/sunset | birim: veri kaynağı girdisi |
| K14 | Yapay zekâ çevirisi insan onayı olmadan toplu yayımlanmaz; başlık, meta, JSON-LD de incelenir | https://developers.google.com/search/docs/essentials/spam-policies ; https://developers.google.com/search/docs/fundamentals/using-gen-ai-content ; https://developers.google.com/search/updates (2025-06-11) | iş akışı testi: onaysız yayın reddi |
| K15 | Yayından önce ve sonra Search Console URL denetimi (Uluslararası Hedefleme raporu 2022'de kalktı) | https://support.google.com/webmasters/answer/12474899 | §9.2 kontrol listesi |
| K16 | hreflang yalnız dil kodu (`tr`, `en`); ikinci pazar açılırsa `en-XX`; bir değer tek URL'ye; yalnız geçerli ISO 639-1/3166-1 | localized-versions | birim: kod doğrulayıcı |
| K17 | Kümede tek x-default; mağaza ayarı; kök hiçbir zaman yönlendirmez | https://developers.google.com/search/blog/2023/05/x-default | birim |
| K18 | Sayfalı listenin her sayfası kendine canonical ve karşı dildeki aynı sayfa numarasıyla eş; filtre/sıralama URL'leri hreflang almaz | https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading ; faceted-navigation belgesi (çıkarım) | birim |
| K19 | Bing ve Yandex: `content-language`; Yandex Webmaster'da site doğrulanır ve bölge seçilir | Canel tweet (resmî değil); https://yandex.com/support/webmaster/en/site-geography/site-region (arama özeti) | §9.3 |
| K20 | Site haritası dil/tür başına bölünür; dosya başına ≤50.000 URL ve ≤50 MB; alternatifler boyuta girdiği için ~10–20 bin URL'de bölme (çıkarım) | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | birim: bölme eşiği |
| K21 | Merchant `[link]` o pazarın sunucu HTML'i; `link_template` ülke/dil için kullanılmaz (yalnız `{store_code}`); fiyat KDV dahil (ABD/Kanada hariç) | https://support.google.com/merchants/answer/13871172 ; https://support.google.com/merchants/answer/7052209 | birim |
| K22 | Her dil sayfası kendi başına tam: İngilizce sayfada Türkçe başlık, slug ya da metin kalıntısı yok | yapay zekâ aramasında hreflang'e güvenilemez (Glenn Gabe deneyi, resmî değil) https://www.gsqi.com/marketing-blog/ai-search-hreflang-multilingual-queries/ | duman: İngilizce sayfada Türkçe karakter/anahtar taraması |
| K23 | Her aşamada TR HTML önce/sonra karşılaştırması; fark yalnız hreflang + dil seçici | çıkarım (docs/26 §2) | anlık görüntü testi |
| K24 | Dil ve para URL'den; önbellek çereze ya da Accept-Language'e göre bölünmez, `Vary: Accept-Language` yok; çerez yalnız bandı gizler; `x-medusa-locale` store'da yok sayılır | WPML önbellek hatası https://wpml.org/errata/caching-plugins-may-cause-issues-with-wcml-multi-currency-settings ; deney (docs/26 §6) | duman: başlık enjeksiyonu aynı gövde |

## 8. Pazar modeli: dil × para birimi × bölge × ödeme sağlayıcısı

### 8.1 Pazarlar

| Pazar | URL | Dil / hreflang | Para | Medusa bölgesi | Ülkeler | Vergi gösterimi | Ödeme |
|---|---|---|---|---|---|---|---|
| Türkiye | `/` (öneksiz) | `tr` | TRY | Türkiye (bugünkü) | **yalnız `tr`** | KDV dahil | PayTR / iyzico / havale / kapıda |
| Uluslararası | `/en` | `en` | USD (ayar: EUR) | Uluslararası (yeni) | Türkiye hariç, mağaza seçer | ihracatta KDV'siz (ETGB ile), gümrük alıcıya (DAP); tur hizmeti Türkiye'de KDV'li | PayTR döviz / iyzico döviz / banka dövizli POS / Stripe (yalnız yurt dışı şirket) |
| İleride: ikinci yabancı para | `/en-eu` | `en-DE`, `en-FR`… (ülke başına satır; `EU` geçerli ISO 3166-1 kodu değil, doğrulanmadı) | EUR | ayrı bölge | AB ülkeleri | AB tüketici kuralları | aynı |

- Medusa kuralları (Context7 ile doğrulandı): bir ülke yalnız bir bölgede olabilir; sepet para birimi bölgeninkiyle aynı olmak zorunda (v2.21.0+); sağlayıcı bölgeye bağlanır.
- Ürün sayfasındaki para birimi URL'ye bağlıdır; sepet ve ödeme ise bölgeye. `/en`'de Türkiye adresi seçilirse sepet TRY bölgesine geçer, ödeme sayfası (indekslenmeyen) bunu bildirir; ürün sayfası USD kalır. Hizmet ürünlerinde teslimat adresi olmadığı için bölgeyi fatura ülkesi ve uyruk/ikamet beyanı belirler.

### 8.2 Hukuki kısıtlar (yapı gereği zorunlu)

Hukuki görüş değildir. **[A]** = avukata doğrulatılacak, **[M]** = mali müşavire doğrulatılacak.

1. **Türkiye ülkesi yalnız TRY bölgesinde.** Türkiye teslimat adresli sipariş yalnız TL ile ödenir. Gerekçe: tüketiciye etiket, liste ve reklam fiyatı TL (Fiyat Etiketi Yönetmeliği m.9/4; Ticari Reklam Yönetmeliği m.13/4). [A]
2. **Türkçe vitrinde fiyat TL ve tüm vergiler dahil.** TL şartı m.9/4 ve m.13/4'te; "tüm vergiler dahil" şartı Fiyat Etiketi **m.5/2-c** ve Reklam **m.13/2**'de. Türkçe vitrinde döviz fiyat çizilmez; bilgi amaçlı döviz gösterimi de yok (m.13/1 anlam karışıklığı riski, doğrulanmadı). [A]
3. **Mal satışı:** 6 Mart 2025 değişikliğiyle (Tebliğ 2025-32/72, RG 06.03.2025/32833, m.8/9) Türkiye'de yerleşikler arasında taşıt dışı menkul satışında döviz serbest. Yine de Türkiye pazarında ürün fiyatı TL kuralı uygulanır, çünkü fiyat gösterimi yönetmelikleri TL istiyor. [A]
4. **Hizmet ve tur:** 32 sayılı Karar'a ilişkin Tebliğ **m.8/7**: Türkiye'de yerleşikler arası hizmet sözleşmesi dövizle yapılamaz. İstisnalar: (a) T.C. ile vatandaşlık bağı olmayan taraf; (c) yurt dışında gerçekleşen faaliyet; (ç) Türkiye'de başlayıp yurt dışında biten ya da tersi; (d) Kültür ve Turizm Bakanlığı belgeli tesiste **konaklama** sözleşmesi. **(d) yurt içi turu kapsamaz.** HMB SSS: döviz kazandırıcı olsa da Türkiye'de yerleşike yurt içinde sunulan hizmet dövizle yapılamaz. Sonuç: Türkiye'de yerleşik T.C. vatandaşına yurt içi tur dövizle satılmaz; yabancı uyruklu müşteriye satılabilir. Ödemede uyruk beyanı istenir (ayar; yalnız tarihli/hizmet ürünleri). **[A]: beyanın yeterliliği ve saklanacak belge (KVKK).**
5. **Yurt dışı paket tur ve yurt dışına ulaşım/konaklama** için TL gösterim zorunluluğu yok (m.9/4 ve m.13/4 istisnaları); kambiyo açısından da m.8/7-ç. Ürün düzeyinde "döviz uygunluğu" türü (yurt içi tur / yurt dışı tur / belgeli konaklama) bu ayrımı taşır. [A]
6. **Yabancı tüketiciye İngilizce vitrinde döviz fiyat:** Türk tüketici mevzuatının uygulanıp uygulanmadığına dair açık hüküm bulunamadı (doğrulanmadı). Güvenli tasarım: döviz fiyat yalnız `/en` pazarında, Türkiye adresine TL. [A]
7. **Ön bilgilendirme "anlaşılabilir bir dilde"** (Mesafeli Sözleşmeler Yön. m.6): İngilizce metin + Türkçe metin bağlantısı (805 sayılı Kanun riski, doğrulanmadı). [A]
8. **AB tüketicisi:** İngilizce + EUR fiyat "yöneltme" göstergesi sayılabilir (ABAD Pammer/Alpenhof); 14 gün cayma vb. AB kuralları uygulanabilir. `/en-eu` açılmadan önce. [A]
9. **İndirim öncesi fiyat** para birimi/kanal başına (son 10 gün; Fiyat Etiketi m.11, Reklam m.14/3). [A]
10. **Fatura:** yurt dışındaki müşteriye döviz fatura serbest, TL karşılığı şart değil (VUK m.215/2-a); KDV matrahı için kur saklanır (KDV m.26). [M]
11. **ETGB ile KDV istisnası** (KDV m.11/1-a, m.12/1; tevsik ETGB ile); ETGB no gelmeden KDV'siz fatura kesilmez. Limit 30.000 € / 600 kg (RG 03.01.2026/33126, yayım günü yürürlükte; önceki 15.000 € / 300 kg). "2024'te 1.500 €'ya düşürüldü" iddiası yanlış; 1.500 € ithalat tarafı eşiği. [M]
12. **Yabancı turiste Türkiye'de tur KDV'lidir** (hizmetten Türkiye'de faydalanılıyor, KDV m.12/2-b). [M]

### 8.3 Ödeme sağlayıcıları

| Sağlayıcı | Türk şirketiyle | Döviz | Not |
|---|---|---|---|
| PayTR | evet | TL, EUR, USD, GBP, RUB (belge + kod) | canlı hesapta döviz yetkisi ve hangi parada ödendiği PayTR'ye sorulur |
| iyzico | evet | TRY, USD, EUR, GBP, NOK, CHF | yardım merkezine göre TL'ye çevrilip aktarılır, döviz ödemede taksit yok (doğrulanmadı) |
| Banka dövizli sanal POS (ör. Akbank) | evet | TL, USD, GBP, EUR, JPY | gelir döviz hesaba alınabilir; ayrı entegrasyon |
| Stripe | **hayır** (Türkiye listede yok) | 135+ | yalnız yurt dışı şirketi olan mağaza; Medusa resmî sağlayıcısı PaymentIntent kullanır → Adaptive Pricing yok (yalnız Checkout ve Checkout Sessions'lı Elements'te çalışır); Visa/MC Türk kartları ağ düzeyinde destekli ama banka reddi olabilir, Troy yok; **bıçak** ("other weapons") ve **seyahat rezervasyonu** kısıtlı işler listesinde onay gerektirebilir |
| PayPal | hayır (2016'dan beri Türkiye'de yok; 2026 durumu doğrulanmadı) | — | — |
| Paddle, Lemon Squeezy | — | — | fiziksel ürün ve insan hizmeti yasak; uygun değil |

### 8.4 Canlıya açmadan önce cevap bekleyenler

Avukat ve mali müşavir soruları: `docs/mali-musavir-sorulari.md` §8 ve §9. Sağlayıcılara: PayTR döviz yetkisi ve ödeme para birimi; iyzico döviz koşulları; Stripe kısıtlı iş onayı (yalnız Stripe seçilirse).

## 9. Test ve izleme

### 9.1 CI'da Googlebot benzeri istek testleri

Vitrin birim testi (proxy + `metadataOf` + site haritası üreticisi, sahte backend) her PR'da; aynı tablo canlı ortamda `pnpm seo:smoke` ile. İstek: kullanıcı aracısı Googlebot, Accept-Language yok, çerez yok, ABD.

| Denetim | Beklenen |
|---|---|
| `/`, örnek Türkçe ürün/kategori/blog, `/en` ve karşılıkları | 200, `Location` yok; Accept-Language `en`/`tr` ve dil çereziyle aynı gövde özeti |
| `<html lang>`, `og:locale`, `content-language` | Türkçe sayfada `tr`/`tr_TR`, İngilizcede `en`/`en_US` |
| canonical | kendi URL'si, aynı dil, mutlak, kanonik host |
| hreflang | `tr` ↔ `en` karşılıklı, kendine referanslı, tek x-default (ayara göre); İngilizce vitrin kapalıyken hiç yok; HTTP `Link` başlığı yok |
| çevirisi eksik ürün | `/en/...` 404; Türkçe sayfasında `en` hreflang'i yok; site haritasında yok |
| site haritası | yayımlanmış her çift için `xhtml:link`; dosya bölme eşiği |
| `priceCurrency` | görünen fiyatla aynı tutar ve para; `/` TRY, `/en` USD (ayar) |
| `Vary` ve önbellek | `Vary`'de Accept-Language ya da Cookie yok; `x-medusa-locale` başlıklı ve başlıksız store yanıtı aynı; `x-forwarded-host` hreflang'i değiştirmez |
| robots | `/en` sistem yolları kapalı; B'de `/en` `noindex` |
| TR HTML anlık görüntüsü (K23) | aşamadan önceki görüntüyle fark yalnız izinli satırlar |

### 9.2 Search Console kontrol listesi

**Yayından önce:** Türkçe mülkte "Sayfalar" raporu ve en çok tıklanan 20 Türkçe URL'nin URL Denetimi çıktısı kaydedilir (Google'ın seçtiği standart = kendisi); site haritası gönderim durumu; `/en` önekiyle eski URL var mı.
**Yayın günü:** İngilizce site haritası gönderilir; örnek 10 `/en` URL'si "Canlı URL'yi test et" ile: HTML'de İngilizce metin, kendine canonical, hreflang çifti; dizine ekleme isteği.
**Sonraki 2–6 hafta, haftada bir:** Türkçe URL'lerde "Google'ın seçtiği standart" değişmedi mi; "Kopya, Google kullanıcıdan farklı bir standart seçti" listesinde `/en` ya da Türkçe URL var mı; Türkçe sorgularda gösterim ve tıklama düşüşü (ülke filtresi Türkiye); `/en` sayfalarının indekslenme oranı. Hreflang alternatiflerinin raporda "indekslenmedi" görünmesi beklenebilir (Illyes 2026, ikincil).
**Geri alma ölçütü:** Türkçe gösterimde haftalık %15'ten büyük ve açıklanamayan düşüş → `/en` yeniden `noindex`, hreflang kapatılır, nedeni aranır (öneri eşik).

### 9.3 Yandex ve Bing

- **Yandex Webmaster** (Türkiye payı ~%21,6): site doğrulanır; site haritası gönderilir (hreflang'i sitemap'ten okumaz, HTML'den okur); "Site bölgesi" Türkiye; İngilizce pazar büyürse yeniden değerlendirilir; `/en` örnek URL'leri "Sayfa denetimi" ile kontrol edilir.
- **Bing Webmaster** (~%0,8, ama Copilot ve DuckDuckGo'yu besler): site haritası + IndexNow (bugün var, dil başına duyuru B-4'te).

## 10. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Kök ya da öneksiz URL'ye dil algılama/yönlendirme eklenmesi | Googlebot yalnız tek dili görür (geçmiş vaka, docs/26 §6) | K2; duman testi; öneri bandı yalnız istemcide |
| Yarı çevrili `/en` | çift içerik, kalite sinyali | K10; B'de `noindex`, C'de sayfa bazında 404 |
| Dilin başlıkla taşınıp önbelleğe girmesi | çapraz dil sızıntısı, önbellek zehirlenmesi | K24; `x-medusa-locale` yok sayılır; `Link` başlığı yok |
| Yanlış hreflang eşleşmesi | "hiç olmamasından kötü" (Mueller 2018, ikincil) | birim testleri; yalnız yayımlanmış çiftler |
| Türkçe `seo_meta` üzerine İngilizce yazım | Türkçe başlık bozulur | dil başına satır; C2 göç testi |
| Bölge değişimi | sepette fiyat ve kampanya değişir; hediye kartı/kredi TL | bildirim; TL araçları `/en`'de kapalı |
| Türkiye'deki tüketiciye döviz | idari para cezası | §8.2; Türkiye yalnız TRY bölgesinde |
| Yurt içi turun dövizle Türk yerleşike satılması | kambiyo ihlali | uyruk beyanı; [A] onayı |
| Fatura/vergi hatası (kur, istisna, ETGB) | vergi riski | D1'de elle kesim; D2 mali müşavir cevaplarıyla |
| PayTR/iyzico döviz koşulları | tahsilatın TL'ye çevrilmesi, komisyon | sağlayıcıya yazılı soru; banka dövizli POS seçeneği |
| Stripe kısıtlı işler | hesap kapatma | onay alınmadan Stripe açılmaz |
| Medusa 2.22.7 yükseltmesi | çekirdek davranış değişikliği | ayrı PR, tam CI |
| Kalıcı maliyet | her yeni ekran metni iki dilde | anahtar eşitliği testleri (panel + vitrin) |
| Yapay zekâ çevirisi kalitesi | ölçekli içerik kötüye kullanımı sayılma | K14; onay ve örneklem incelemesi |

## 11. Kaynakça

Ayrıntılı liste ve güven düzeyleri: `docs/26-cok-dil-seo-arastirmasi.md` (her tablonun kaynak sütunu; doğrulama özeti §10).

- Google uluslararası: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites · https://developers.google.com/search/docs/specialty/international/localized-versions · https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages · https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google ürün ve Merchant: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing · https://support.google.com/merchants/answer/15404838 · https://support.google.com/merchants/answer/4752265 · https://support.google.com/merchants/answer/12159029 · https://developers.google.com/shopping-content/guides/sunset
- Yandex: https://yandex.com/support/webmaster/en/yandex-indexing/locale-pages · Bing (resmî değil): https://www.seroundtable.com/bing-hreflang-weak-signal-30099.html
- Shopify: https://help.shopify.com/en/manual/markets/seo · https://help.shopify.com/en/manual/international/managing-international-domains
- Medusa: https://docs.medusajs.com/resources/commerce-modules/translation · https://docs.medusajs.com/resources/recipes/multi-region-store
- next-intl: https://next-intl.dev/docs/routing/configuration
- Mevzuat: Tebliğ değişikliği https://www.resmigazete.gov.tr/eskiler/2025/03/20250306-6.htm · Fiyat Etiketi https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.19819.pdf · Ticari Reklam https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.20435.pdf · ETGB https://www.resmigazete.gov.tr/eskiler/2026/01/20260103-4.htm
- Stripe: https://stripe.com/global · https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing · https://stripe.com/legal/restricted-businesses
