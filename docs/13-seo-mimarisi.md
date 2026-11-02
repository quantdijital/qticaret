# 13 — SEO Mimarisi

> Hedef: tenant hangi temayı kullanırsa kullansın, hiçbir SEO bilgisi olmadan **doğru** çıktı alsın;
> bilgisi olan tenant ise her şeyi elle yönetebilsin. SEO burada bir eklenti değil, katalog modelinin parçasıdır.
> Kural motoru ve öneri sistemi: `docs/14-seo-advisor-kural-seti.md`. Rakip karşılaştırması: `docs/15-rakip-analizi-ve-farklilasma.md`.
> Google kuralları değişir; bu dokümandaki "(doğrula)" işaretli maddeler ilgili fazda yerel `/seo-*` skill'leri ve resmi dokümanla teyit edilir.

## 1. Temel ilke: backend tek doğruluk kaynağı
Store API her sayfa türü için hazır bir `seo` nesnesi döner; tema bunu olduğu gibi basar, kendi SEO mantığı yazmaz.
```ts
interface SeoPayload {
  title: string                 // şablondan üretilmiş veya elle girilmiş
  description: string
  canonical: string             // mutlak URL, tenant'ın canonical host'uyla
  robots: "index,follow" | "noindex,follow" | "noindex,nofollow"
  openGraph: { title; description; image; imageAlt; type; url }
  twitter: { card: "summary_large_image"; ... }
  breadcrumbs: Array<{ name; url }>
  jsonLd: object[]              // doğrulanmış JSON-LD blokları (bkz. §5)
  hreflang: Array<{ locale; url }>  // F19'a kadar boş
  pagination?: { current; total; nextUrl?; prevUrl? }
}
```
- SEO alanları ürün, varyant grubu, kategori, marka, koleksiyon, içerik sayfası, blog yazısı ve facet landing sayfasında aynı arayüzle bulunur.
- JSON-LD ve meta etiketleri **sunucu tarafında ilk HTML'de** basılır (F18 garantisi). JavaScript ile sonradan enjekte edilen yapılandırılmış veri gecikmeli işlenir veya yok sayılır; canonical/noindex çelişkisi olursa Google hangisini alacağını kendisi seçer (Google, Aralık 2025 JS SEO rehberi).
- Googlebot HTML'in ilk 2 MB'ını alır; `<head>` ve JSON-LD her zaman HTML'in başında yer alır, inline base64 görsel yasaktır.

## 2. URL ve bilgi mimarisi

### 2.1 Slug kuralları
- Türkçe transliterasyon: `ş→s, ı→i, ğ→g, ç→c, ö→o, ü→u, İ→i`; küçük harf; boşluk ve noktalama → `-`; ardışık `-` tekleştirilir; baştaki/sondaki `-` atılır.
- Uzunluk üst sınırı 80 karakter (kelime sınırında kes); sadece `[a-z0-9-]`. Google Unicode URL'yi destekler ama ASCII dışı karakterleri yüzde kodlamasıyla ister (`%C3%BC` gibi uzar, paylaşımda çirkinleşir); bu yüzden transliterasyon. Ayırıcı tire, alt çizgi değil.
- Model/ölçü gibi anlamlı sayılar korunur ("20-cm", "x50"); durak kelimeler (ve, ile, için) **atılmaz** (TR'de sorgu eşleşmesi için faydalı, doğrula).
- Slug **değiştirilebilir**; her değişiklik `seo-redirects`'e otomatik 301 yazar ve eski slug'ı "rezerve" tutar (başka ürün alamaz, yönlendirme bozulmaz).
- Benzersizlik: `url-registry` tablosu (locale, path) unique. Ürün, kategori, marka, sayfa aynı registry'ye girer; çakışma kaydetme anında engellenir.
- Sayısal/ID'li URL yok (`/urun/12345` yok). İthal verideki ID'li URL'ler geçişte 301 ile eşlenir (F14).

### 2.2 URL desenleri
Tenant kurulumda bir desen seti seçer; desen tokenlarla tanımlıdır ve sonradan değiştirilirse tüm varlıklar için 301 otomatik üretilir.
| Varlık | Varsayılan | Alternatif (düz) |
|---|---|---|
| Ürün | `/urun/{slug}` | `/{slug}` |
| Kategori | `/kategori/{ata-slug'ları}/{slug}` (kökten bu kategoriye tüm zincir) | `/{slug}` |
| Marka | `/marka/{slug}` | `/{slug}` |
| Koleksiyon / kampanya | `/koleksiyon/{slug}` | |
| Facet landing | `/kategori/{slug}/{facet-slug}` (ör. `/kategori/bicak/paslanmaz-celik`) | |
| İçerik sayfası | `/{slug}` | |
| Blog | `/blog/{slug}` | |
| Arama | `/arama?q=` (noindex) | |

- **Ürün URL'si kategori içermez.** Bir ürün birden çok kategoride olabilir; URL tek, canonical tek. (Shopify'daki `/collections/x/products/y` çoğaltması bilinçli olarak yok.)
- Her ürünün bir **birincil kategorisi** vardır (`primary_category_id`); breadcrumb, JSON-LD ve "kategoriye dön" bağlantısı bundan üretilir. Birincil kategori yoksa en derin kategori seçilir ve advisor uyarır.
- Kategori URL'si hiyerarşiyi taşır; kategori taşınırsa alt ağaç için 301 üretilir.
- Facet landing yolu (`/kategori/{slug}/{facet-slug}`) alt kategori yollarıyla aynı biçimdedir. İkisi de `url-registry`'ye yazıldığı için çakışma kayıtta reddedilir; F3.17 bu ad alanını kesinleştirir.
- Trailing slash yok; büyük harf, çift slash, `index.html` gibi varyantlar 301 ile normalize edilir (edge/storefront katmanı, F18).
- Canonical host tenant ayarıdır (`www` tercihli/tercihsiz). Varsayılan `<slug>.<platform-domain>`, özel domain bağlanınca ona **301** olur (hem güvenlik hem çift indeks önleme).

### 2.3 Varyantlar
- Varyant ayrı URL almaz; `?variant=<id>` parametresi ile ön seçilir (Google her varyantın parametreyle ön seçilebilir bir URL'si olmasını ister), canonical varyant seçilmemiş ana ürün URL'sine gider.
- Renk gibi görsel olarak ayrışan varyantlar için opsiyonel "varyantı ayrı sayfa yap" bayrağı (ayrı slug + kendi görselleri + `ProductGroup` içinde `hasVariant`), tenant kararıyla.
- Yapılandırılmış veri: `ProductGroup` (`productGroupID` = ana ürün SKU'su) + `hasVariant[Product]` + `variesBy` (Google yalnızca color, size, suggestedAge, suggestedGender, material, pattern değerlerini tanır; attribute şablonundaki seçenek bu altıdan birine eşlenmemişse `variesBy` yazılmaz). Her varyantın kendi `sku`/`gtin` ve tam Offer'ı olur.

### 2.4 Stok dışı ve kaldırılan ürünler
| Durum | Davranış |
|---|---|
| Geçici stok dışı | Sayfa kalır, `availability: OutOfStock` (veya `BackOrder`/`PreOrder` ayara göre), "stok gelince haber ver" (F10.5), benzer ürünler; sitemap'te kalır |
| Satıştan kaldırıldı, gerçek eşdeğeri var | 301 → halef ürün (ürün formunda "yerine geçen ürün" alanı). Google yalnızca gerçek eşdeğere yönlendirmeyi önerir |
| Satıştan kaldırıldı, halef yok | Sayfa bir süre (varsayılan 90 gün) 200 ile kalır: "artık satılmıyor" + benzer ürünler + kategori bağlantısı (gerçek içerik; soft-404 değil); sitemap'ten anında çıkar; süre sonunda 410. Kategoriye/ana sayfaya "kör 301" **yapılmaz** (Google önermiyor) |
| Taslak / yayında değil | 404 (önizleme token'ı ile admin görebilir), sitemap'te yok |
| Kısıtlı kategori (F13.4) | Tenant ayarına göre indexlenir veya `noindex` |

## 3. Meta bilgileri ve şablonlar
- Her varlıkta: `seo_title`, `seo_description`, `canonical_override`, `robots_override`, `og_image_override`, `focus_keyword` (opsiyonel).
- Boş bırakılanlar **şablondan** üretilir; şablonlar tenant ayarıdır ve varlık türüne göre tokenlar alır:
  - Ürün: `{ürün_adı} | {marka} | {mağaza}` → `{ürün_adı} - {öne_çıkan_attribute} | {marka}` (skill önerisi: `[Ürün] - [Özellik] | [Marka]`)
  - Kategori: `{kategori} Modelleri ve Fiyatları | {mağaza}`
  - Marka: `{marka} Ürünleri | {mağaza}`
  - Meta description ürün: `{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}` (ör. "1.250 TL'den başlayan fiyatlarla, ücretsiz kargo")
- Şablonlar ve tenant metinleri sayfaya basılırken kaçışlanır (F18): HTML'de entity, JSON-LD içinde `<` → `\u003c` (`</script>` kapanışı olmasın). robots.txt `text/plain` + nosniff ile servis edilir. `canonical_host` alan adı doğrulaması gelene kadar yalnızca bağlantı üretiminde kullanılır; sunucu tarafı istek ve yönlendirme hedefi olmadan önce doğrulanmış alan adlarıyla sınırlanır (F16/F18).
- Uzunluk hedefleri (lint): başlık 30–60 karakter (piksel genişliği tahmini ile), açıklama 70–155. Türkçe karakterler geniş; piksel tahmini font metrik tablosundan.
- Mağaza genelinde başlık/açıklama **benzersizliği** denetlenir (hash + normalize karşılaştırma).
- Sayfalama: `?sayfa=2` sayfaları kendi canonical'ına sahiptir (`rel=prev/next` Google tarafından kullanılmıyor); başlığa " - Sayfa 2" eklenir; 1. sayfa parametresiz canonical (`?sayfa=1` 301 ile temiz adrese gider). Son sayfadan sonrası 404.
- OG görseli: elle seçilmemişse ana ürün görseli 1200×630'a kırpılır (worker, F3.3); kategori/marka için şablonlu görsel üretimi (logo + ad) opsiyonel.
- Paylaşım önizlemesi admin'de gösterilir (Google sonuç kartı, WhatsApp/Instagram/X kart önizlemesi) — bkz. doc 14 §6.

## 4. Yönlendirmeler (`seo-redirects`)
- Kural tipleri: tam eşleşme, önek, **regex** (güvenli motor, zaman aşımı, catastrophic backtracking koruması), 301/302/307/410.
- Sorgu parametresi davranışı: koru / at / belirli parametreleri koru.
- Slug değişimi, kategori taşıma, desen değişimi, halef ürün ataması otomatik 301 üretir (kaynak `auto`, elle silinebilir).
- **Zincir düzleştirme:** A→B varken B→C eklenirse A→C'ye güncellenir. **Döngü tespiti** kaydetme anında.
- Toplu içe/dışa aktarma (CSV); geçiş aracı (F14) doğrudan bu tabloya yazar.
- İsabet sayacı ve son isabet zamanı; 12 ay isabet almayan kurallar için "temizle" önerisi.
- Store API çözümleme ucu: `GET /store/seo/resolve?path=` → `{ type: "entity"|"redirect"|"gone"|"not_found", ... }`. Storefront middleware her 404 öncesi bunu sorar (cache'li).
- **404 günlüğü:** storefront `POST /store/seo/not-found` ile yolu ve referer'ı bildirir (rate limitli, PII'siz). Günlük job toplar; advisor benzer slug / eski slug / geçiş tablosu üzerinden hedef önerir, admin tek tıkla 301 oluşturur.

## 5. Yapılandırılmış veri (JSON-LD)
Backend `jsonLd` dizisini üretir; tema değiştiremez (sadece ek blok ekleyebilir). Her blok JSON şemayla test edilir.

| Sayfa | Bloklar |
|---|---|
| Ürün | `Product` (tek varyant) veya `ProductGroup` + `hasVariant[Product]`; her `Product` içinde `Offer` (`price`, `priceCurrency: TRY`, `availability`, `url`, `sku`, `gtin13`/`mpn`, `itemCondition`, `priceValidUntil` (zamanlı fiyat varsa), `shippingDetails`, `hasMerchantReturnPolicy`); `brand`; `image[]`; `aggregateRating` + `review[]` (F10.6'dan, yalnızca onaylı); indirimde ek `UnitPriceSpecification` `priceType: https://schema.org/StrikethroughPrice` ile eski fiyat, güncel fiyat Offer'da `priceType`'sız — üstü çizili fiyat **F4.3 30 gün kuralıyla aynı kaynaktan** gelir; `BreadcrumbList` |
| Kategori / marka / koleksiyon | `CollectionPage` + `ItemList` (ilk sayfa ürünleri), `BreadcrumbList` |
| Ana sayfa | `OnlineStore` (Organization'ın e-ticaret alt tipi; Google en spesifik tipi önerir) — künye (F13.9): ad, logo, adres, telefon, `sameAs` sosyal hesaplar; organizasyon seviyesinde `hasMerchantReturnPolicy` ve `hasShippingService` (ürün seviyesi bunları override eder; öncelik: Merchant Center ayarı > ürün markup > organizasyon markup); `WebSite` (SearchAction **yok**, sitelinks arama kutusu Kasım 2024'te kaldırıldı) |
| İçerik / blog | `Article`/`BlogPosting` (yazar, tarih, güncelleme tarihi, yayıncı) |
| Ürün Soru-Cevap (F10.10) | `QAPage` (gerçek kullanıcı soruları). **`FAQPage` kullanılmaz**: Google FAQ rich result'ı 7 Mayıs 2026'da tüm siteler için kaldırdı (doküman Haziran 2026'da silindi); `HowTo` Eylül 2023'ten beri yok. SSS içeriği kullanıcı için sayfada kalabilir, şema yatırımı yapılmaz |
| Yetişkin ürünler | `hasAdultConsideration` (2026-05, zorunlu; değer `SexualContentConsideration`) — kısıtlı kategori bayrağıyla (F13.4) eşlenir |

Kurallar:
- `price` sayısal string (sembolsüz), `availability` tam schema.org URL'si, tüm URL'ler mutlak, `brand.name` boş olamaz, `aggregateRating` varsa `ratingValue` + `reviewCount` zorunlu.
- `shippingDetails` kargo seçeneklerinden (F7.8: bölge/ücret/teslim süresi; zorunlu alt alanlar `shippingRate`, `deliveryTime`, `shippingDestination` F3.12'de resmi dokümandan teyit edilir), `hasMerchantReturnPolicy` iade politikasından (F13.1: `applicableCountry`, `returnPolicyCategory`, `merchantReturnDays`, `returnFees`) otomatik türetilir; tenant ayrıca Search Console/Merchant Center'dan da tanımlayabilir (o ayar markup'ı ezer).
- Merchant listing için yalnızca `Offer` kullanılır (`AggregateOffer` kabul edilmez); `price` > 0; `sku` tek değer ve boşluksuz.
- Merchant Center ile **tutarlılık**: sayfadaki JSON-LD fiyat/stok/GTIN, feed'dekiyle aynı kaynaktan üretilir; Google "otomatik ürün güncellemeleri" bu eşleşmeye bakar.
- Sertifika/standart bilgisi (`Certification`) attribute şablonundan gelebilir (ör. CE, TSE) — sektör nötr.

## 6. Sitemap ve robots
- **Backend üretir** (worker, değişiklik sonrası debounce'lu + günlük tam üretim) → S3; storefront `/sitemap.xml` ve `/robots.txt`'yi proxy'ler. Tema bağımsız, tek kaynak.
- Sitemap index: `sitemap-products-N.xml`, `-categories`, `-brands`, `-collections`, `-pages`, `-posts`, `-landings`; dosya başına 50.000 URL / 50 MB sınırı; gzip.
- `lastmod` yalnızca içerik/fiyat/stok gibi anlamlı değişimde güncellenir (üretim zamanı değil).
- Görsel sitemap uzantısı (`image:image` + `image:loc`, URL başına en çok 1.000 görsel; `caption/title/license` alanları 2022'de kaldırıldı) ürün görselleri için; video varsa video sitemap (`thumbnail_loc`, `title`, `description`, `content_loc`/`player_loc` zorunlu). `priority` ve `changefreq` yazılmaz (Google yok sayar).
- Dışarıda: `noindex` varlıklar, taslaklar, kısıtlı kategori (ayara göre), arama ve filtre URL'leri, hesap/sepet/checkout.
- Vitrinin sistem sayfaları (backend `lib/seo/paths.ts` `SYSTEM_PAGES` ve `RESERVED_ROOT_SEGMENTS`, vitrin `lib/seo/paths.ts` `SYSTEM_ROOTS`; ikisi birlikte değişir): kayıt bu köklerden birini tam yol olarak alamaz. 2026-11-02 eki: iletilerdeki token bağlantıları `/abonelik/cik`, `/abonelik/onay`, `/stok-bildirimi/onay` (`noindex,nofollow`, `Referrer-Policy: no-referrer`; adr/0038 Ek) ve `/cerez-tercihleri` (`noindex,follow`). robots.txt bunları engellemez: tarayıcı `noindex`'i görebilsin.
- robots.txt admin'den düzenlenebilir; güvenli varsayılan şablon: `Disallow: /sepet, /odeme, /hesap, /arama`, filtre engelleri için `{facet_disallow}` satırı (§7); `Sitemap:` satırı; AI tarayıcı ön ayarları (§9).
- Staging ve önizleme ortamları: `X-Robots-Tag: noindex` + basic auth; yanlışlıkla indekslenme testi (F16).
- IndexNow: yayın/güncelleme/silme olaylarında tek uç (`api.indexnow.org`) üzerinden Bing, Yandex, Naver, Seznam, Amazon'a anahtarlı toplu bildirim (job). Google katılımcı değil; Google Indexing API yalnızca `JobPosting`/`BroadcastEvent` için çalışır, ürün sayfalarında kullanılamaz. Google için yol: sitemap + GSC sitemap gönderimi + URL Inspection (kota 2.000/gün/site).

## 7. Facet navigasyon ve listeleme sayfaları
- Filtre URL'leri parametreyle (`?marka=x&renk=y&fiyat=100-500&sirala=...`; ayırıcı yalnızca `&`, sabit parametre sırası). Google'ın güncel önerisi (Aralık 2025 facet rehberi): indekslenmeyecek filtre URL'leri **robots.txt ile taranmaz** (`Disallow: /*?*renk=` gibi desenler; canonical/nofollow/noindex uzun vadede daha zayıf ve tarama bütçesini korumaz). robots.txt şablonu facet parametrelerini otomatik üretir; canonical yine temiz kategori URL'sine işaret eder.
- Boş sonuç veren filtre kombinasyonu o URL'de **404** döner (genel 404 sayfasına yönlendirme yok); boş kategori sayfası `noindex` veya 404 (tenant ayarı) ve advisor uyarısı.
- **Facet landing sayfaları** (allowlist): tenant bir kategori + attribute/marka kombinasyonunu "landing" olarak işaretler → **path tabanlı** kendi slug'ı (`/kategori/bicak/paslanmaz-celik`; parametre değil, bu yüzden robots engeline takılmaz), başlığı, açıklaması, en az N kelime **özgün** metni, kendi canonical'ı, sitemap'e girer. Programatik sayfa güvenlik kapıları: sayfalar arası benzersiz içerik ≥ %40 (altında uyarı, %30 altında yayın engeli), 50–100'lük partiler halinde yayın, en az %5 insan incelemesi, "tek başına değerli mi" testi (Google ölçekli içerik kötüye kullanımı politikası).
  - **Uygulama notu (F3 T14a, 2026-10-26):**
    - Landing kaydı `content` modülünde (`landing_page`): kategori + tek facet (marka ya da filtrelenebilir seçim özelliğinin bir değeri). Kategori ve facet sonradan değişmez; kategori + facet ve kategori + adres benzersizdir.
    - Yol kategorinin bugünkü yolu + adres (`/kategori/ev-ve-yasam/seramik`). Kategori taşınınca landing'ler de taşınır (eski yol 301); kategori gizlenince sayfa 404, silinince 410.
    - Özgünlük: metnin 5 kelimelik dizilerinin MinHash imzası (`lib/content/originality`); facet ve kategori adları ölçümden önce yer tutucuya çevrilir. Bir sayfa, metni kendisinden önce yayına girmiş canlı sayfalarla ölçülür (metnin sahibi onu ilk yayına alan). Kapı yayına alırken ve canlı metin değişirken çalışır; gece işi hepsini yeniden ölçer.
    - Sitemap (`landings`), IndexNow ve 404 önerileri yalnızca kategorisi görünen landing'leri alır. Ürün listesi kategorinin görünen alt kategorilerini kapsar.
- **Uygulama notu (F3 T14b, 2026-10-26):**
  - Parametreler: `marka` (marka handle'ları), filtrelenebilir seçim özelliklerinin anahtarları (seçenek değerleri), `fiyat` (`100-500`, uçlardan biri açık olabilir), `sirala` (`yeni`, `fiyat-artan`, `fiyat-azalan`; varsayılan `onerilen` yazılmaz), `sayfa`. Bir anahtarın birden çok değeri virgülle (`renk=kirmizi,mavi`). Bu adlar ve başka adreslerin parametreleri (`variant`, `q`, `utm_*`, `gclid` vb.) filtrelenebilir özelliğin anahtarı olamaz.
  - Kanonik biçim: `marka`, sonra özellik anahtarları alfabetik, her birinin değerleri sıralı ve tekil; sonra `fiyat`, `sirala`, `sayfa`. Diğer parametreler (`utm_source`) geldikleri sırayla sona eklenir ve yönlendirme yaptırmaz. Başka sıra ya da biçim (tekrarlanan anahtar, boş ya da geçersiz değer, `sayfa=1`, varsayılan sıralama) tek 301 ile kanonik biçime gider.
  - Kategoride tek facet (tek anahtar, tek değer, fiyat ve sıralama yok) yayındaki bir landing'e karşılık geliyorsa 301 ile landing'e gider; `sayfa` ve diğer parametreler korunur.
  - Ürünü olmayan filtre kombinasyonu, son sayfadan sonrası (sayfa başına 24 ürün) ve tuzak sorgular (6'dan fazla anahtar, anahtar başına 10'dan, toplam 12'den fazla değer, 10.000'den büyük sayfa) 404. Fiyat bu sayıma girmez (bölgeye bağlı); fiyatla boş kalan sayfada 404'ü storefront verir.
  - Sorguyla biten yönlendirme (eski yol, kural) hedefin liste yanıtıyla birleşir: tek atlama.
  - Filtreli, fiyatlı ya da sıralı liste `noindex,follow`, canonical temiz sayfa. Numaralı sayfanın JSON-LD'si kendi adresini ve "Sayfa N" adını taşır, ilk sayfanın ürün listesini taşımaz. Resolve yanıtında okunan sorgu `listing` alanında (`page_size` dahil; storefront ürünleri buna göre ister).
  - robots.txt şablonundaki `{facet_disallow}` satırı her filtre, `fiyat` ve `sirala` için `Disallow: /*?{ad}=` ve `Disallow: /*&{ad}=` satırlarına açılır; `sayfa` ve landing yolları açık kalır. Mağaza denetimi (S-ROBOTS-01) açık kalan filtre adresini bulur.
  - `/store/seo/site` storefront'un kendi sayfalarının robots değerini verir: arama `noindex,follow`; sepet, ödeme, hesap, giriş `noindex,nofollow`.
- Sıralama ve fiyat aralığı parametreleri asla indekslenmez. Sayfalama §3.
- Dahili arama sayfası `noindex`; arama terimleri raporu (F11) içerik fırsatı önerir (çok aranan ama ürünü/sayfası olmayan terimler).

## 8. Görseller
- Dosya adı slug'dan üretilir: `{urun-slug}-{sira}.webp`; orijinal ad meta olarak saklanır.
- `alt` zorunlu alan; boşsa öneri: `{ürün adı} {varyant/öne çıkan attribute} - {sıra açıklaması}`; lint eksik alt'ı işaretler.
- Ana görsel ≥ 800×800 (Google Alışveriş uygunluğu), ürün başına ≥ 3 görsel hedefi; WebP + AVIF türevleri, `srcset` boyut seti; LCP görseli lazy değil (F18).
- EXIF temizlenir, yeniden kodlanır (güvenlik, `docs/04`). Sıkıştırma kalite hedefi ve boyut üst sınırı tenant ayarı.
- AI ile üretilmiş/düzenlenmiş ürün görseli yüklenirse IPTC `DigitalSourceType` etiketi (Merchant Center gereği; görsel üretim özelliği eklenirse).
- Görsel CDN ve cache: değişmeyen URL + içerik hash'li sürümleme.

## 9. AI arama, GEO ve ajan ticareti
Google'ın resmi görüşü: üretken arama için optimizasyon **hâlâ SEO'dur**; ayrı bir disiplin değildir. Yapılacaklar:
- **SSR zorunlu** (F18): AI tarayıcıları JavaScript çalıştırmaz; ürün içeriği, fiyat, JSON-LD ilk HTML'de.
- robots.txt'de AI tarayıcı ön ayarları: "AI aramada görün" (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot izinli) / "eğitim tarayıcılarını engelle" (CCBot, Bytespider, Google-Extended). Kullanıcı tetiklemeli fetcher'lar (ChatGPT-User, Google-Agent) robots'a uymaz; engel gerekiyorsa sunucu tarafı.
- `llms.txt` opsiyonel bir toggle; **Google tarafından yok sayılır**, tenant'a abartılmaz; diğer AI servisleri için zararsız.
- AI özelliklerinde görünümü kontrol: `nosnippet`, `data-nosnippet`, `max-snippet` (ayrı AI opt-out dosyası yok).
- İçerik yapısı (içerik modülü editörü): soru biçimli başlıklar, 2–4 cümlelik paragraflar, karşılaştırma tabloları, 130–170 kelimelik kendi kendine yeten cevap blokları, yayın ve güncelleme tarihi, yazar bilgisi (`Person`) — advisor'ın içerik kuralları (doc 14).
- Marka varlığı (`sameAs`: Instagram, YouTube, LinkedIn, Wikipedia/Wikidata) künyeden JSON-LD'ye.
- **Ajan ticareti (F19):** Google'ın UCP (Universal Commerce Protocol) profili `/.well-known/ucp` ile yetenek ilanı (checkout, fulfillment, discount) ve AP2 ödeme protokolü; Merchant Center + temiz Product şeması ön koşul. Protokol yeni; F19 ADR'ıyla değerlendirilir. F18 temaları **ajan dostu** HTML üretir: gerçek `<button>`/`<a>`, etiketli formlar, kararlı layout (Lighthouse "Agentic Browsing" kategorisi).
- Spam politikaları: geri tuşu ele geçirme (`pushState` ile) yasak (2026-04, cezalı); ölçekli AI içerik için ADR-0005 kuralları.

## 10. Google Merchant Center, Search Console ve ölçüm
- **Merchant Center:** feed (F10.8) + **Merchant API** ile push (Content API for Shopping 18 Ağustos 2026'da kapandı; yeni entegrasyon yalnızca Merchant API). Ürün sayfasındaki JSON-LD ile feed aynı kaynaktan; Google "otomatik ürün güncellemeleri" sayfadaki `price/priceCurrency/availability/itemCondition` markup'ının **sunucu tarafı HTML'de** olmasını ve kullanıcıya gösterilenle aynı olmasını ister. Türkiye ücretsiz listeleme ülke listesindedir; tenant Merchant hesabında teyit eder.
- **Search Console (F10.11):** tenant kendi mülkünü OAuth ile bağlar → Search Analytics (kota 1.200 sorgu/dk/site), sitemap gönderimi, URL Inspection (2.000/gün/site; büyük kataloglarda örnekleme ve öncelik sırası) → admin SEO paneli: indekslenmeyen ürünler, tıklaması düşen sayfalar, en çok gösterim alan ama düşük CTR'li sayfalar (başlık/açıklama önerisi tetikler).
- **CrUX API** (ücretsiz, Google Cloud API anahtarı gerekir, 150 sorgu/dk): origin ve URL bazında gerçek Core Web Vitals; düşük trafikli ürün URL'lerinde veri olmaz, origin seviyesine düşülür. Eşikler LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (75. yüzdelik, mobil/masaüstü ayrı). Haftalık job, panelde trend.
- **Yandex Webmaster** ve Bing Webmaster: IndexNow + sitemap. TR'de arama payı Google ~%87, Yandex ~%11 (Aralık 2025) ama e-ticaret sitelerine gelen arama trafiğinde Yandex ~%1; düşük öncelik, sıfır maliyetli olduğu için IndexNow ile kapsanır.
- Dönüşüm ölçümü sunucu tarafında (F10.9); SEO trafiği ↔ sipariş ilişkisi raporda (F11).

## 11. Çoklu mağaza, dil ve ülke
- Tenant başına tek canonical host; platform alt alan adı 301.
- Önizleme bağlantıları (taslak ürün/sayfa) imzalı, süreli token; `noindex`.
- F19'a hazırlık: slug ve SEO alanları `locale` sütunu taşır; `hreflang` çıktısı payload'da hazır; `x-default` kuralı; para birimi/ülke bazlı Offer.

## 12. Geçişte SEO koruması (F14)
1. Eski sitenin URL envanteri: sitemap + tarama (`/seo-sitemap`, `/seo-technical` skill'leri yardımcı) + GSC dışa aktarımı (en çok trafik alan URL'ler).
2. Eşleme: ürün/kategori/marka/sayfa/görsel URL'leri → yeni URL'ler; eşleşmeyenler raporlanır (karar: 301 hedefi / 410).
3. Kesim öncesi kontrol: sitemap karşılaştırma sayımı, örneklem 301 testi, canonical/robots doğrulama, staging'de `/seo-audit` koşusu.
4. Kesim sonrası 30 gün: 404 günlüğü izleme, GSC kapsam karşılaştırması, sıralama düşüşü uyarısı.

## 13. Fazlara dağılım
| Konu | Faz |
|---|---|
| Slug, registry, desenler, birincil kategori, GTIN/MPN/marka alanları, `brands` modülü | F3.1, F3.4, F3.11 |
| Redirect motoru + 404 günlüğü | F3.5 |
| Sitemap/robots/IndexNow | F3.6, F3.15 |
| JSON-LD üretici + testler | F3.12 |
| Advisor kural motoru + skor + widget | F3.13 (doc 14) |
| Mağaza geneli SEO denetimi | F3.14 |
| İçerik modülü (sayfa, blog, facet landing) | F3.16 |
| Facet robots kuralları | F3.17 |
| Soru-Cevap (`QAPage`) | F10.10 |
| GSC + CrUX entegrasyonu, SEO paneli | F10.11, F12.10 |
| Merchant API push | F10.8 |
| LLM taslakları (adr/0005) | F10.13 |
| SSR, CWV bütçeleri, ajan dostu HTML, llms.txt/robots ön ayarları | F18 |
| hreflang, UCP | F19 |

## 14. Test
- Slug transliterasyon tablosu (Türkçe karakterler, çift boşluk, emoji, sadece noktalama) birim testli.
- `seo` payload contract testleri: her varlık türü için zorunlu alanlar ve mutlak URL.
- JSON-LD blokları JSON şemayla doğrulanır; F18'de `/seo-schema` skill'i ve Google Rich Results Test ile örneklem.
- Redirect motoru: zincir düzleştirme, döngü, regex zaman aşımı, sorgu parametresi davranışı.
- Sitemap: 50.000 bölme, `noindex` dışlama, `lastmod` yalnızca anlamlı değişimde.
- Facet kuralları: allowlist dışı kombinasyon `noindex`, landing sayfası `index` + kendi canonical'ı.
