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
- **Herkese açık fiyat tek kaynaktır (adr/0068 §7):** JSON-LD `Offer`, ürün akışları (Merchant, Meta), site haritası, arama dizini, raflar, `/store/price-display` (paylaşılan önbellekli) ve toplu kampanya e-postası fiyatı müşteri bağlamı olmadan, perakende olarak okur. Toptancı fiyatı yalnız oturum açmış toptancının kişisel uçlarından (`/store/customers/me/wholesale*`, `private, no-store`) gelir; bir toptancı ürün sayfasını açtığında da JSON-LD perakende kalır (botlar giriş yapmaz). Vitrinin paylaşılan önbelleği müşterinin kendi yollarını ve KDV hariç (toptan) fiyat gösterimini hiç tutmaz (`lib/store-api/personal.ts`); toptancının oturumunda analitik olaylar tutarsız gider (`lib/analytics/amounts.ts`). Herkese açık bir okuyucuya müşteri bağlamı eklemek SEO çıktısını kişiye göre değiştirir: yapılmaz.

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
| Kategori | `/kategori/{ata-slug'ları}/{slug}` (kökten bu kategoriye tüm zincir) | `/{ata-slug'ları}/{slug}` (öneksiz ağaç, adr/0017 Ek 2026-11-23) ya da `/{slug}` |
| Marka | `/marka/{slug}` | `/{slug}` |
| Koleksiyon / kampanya | `/koleksiyon/{slug}` (gizlenen koleksiyon pasif kategori gibi: 404, yolu saklı, site haritasında yok; açıklaması meta açıklamanın, görseli paylaşım görselinin yedeği) | |
| Facet landing | `/kategori/{slug}/{facet-slug}` (ör. `/kategori/bicak/paslanmaz-celik`) | |
| İçerik sayfası | `/{slug}` | |
| Blog | `/blog/{slug}` | |
| Blog kategorisi / etiketi | `/blog/kategori/{slug}`, `/blog/etiket/{slug}` (adr/0019 Ek 2026-11-03) | |
| Blog yazarı | `/blog/yazar/{slug}` (adr/0060; canlı yazısı yoksa `noindex,follow`, site haritasında yok) | |
| Arama | `/arama?q=` (noindex) | |

- **Ürün URL'si kategori içermez.** Bir ürün birden çok kategoride olabilir; URL tek, canonical tek. (Shopify'daki `/collections/x/products/y` çoğaltması bilinçli olarak yok.)
- Her ürünün bir **birincil kategorisi** vardır (`primary_category_id`); breadcrumb, JSON-LD ve "kategoriye dön" bağlantısı bundan üretilir. Birincil kategori yoksa en derin kategori seçilir ve advisor uyarır.
- Kategori URL'si hiyerarşiyi taşır (önekli ve öneksiz ağaç biçimleri); kategori taşınırsa ya da adı değişirse alt ağaç için 301 üretilir. Öneksiz ağaçta kök segment mağazanın ayrılmış sözcüklerinden biri olamaz (`/sepet/x` reddedilir); kökteki ürün, sayfa ve markayla çakışma kayıtta reddedilir.
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
  - `{kısa_açıklama}`, JSON-LD `description`, akışlar, arama ve advisor ürünün düz metin `description`'ını okur. Açıklaması içerik belgesi olan üründe (ADR-0055) bu metni sunucu belgeden türetir ve belge her kaydedildiğinde yeniden yazar (başlık ve paragraflar boş satırla, liste maddeleri satır satır, tablo satırı "hücre · hücre"; en çok 20.000 karakter). Belgeyi okuyan tek yer vitrinin açıklama gövdesidir (`/store/products/{id}/description`).
  - **Kısa açıklama** (adr/0055 Ek 2026-11-06; ürünün yazıldığı gibi kısa metni, `product_extension.summary_doc`) mağazanın yazmadığı metnin yerine geçer. Belgenin düz metni tek satır olur: blok, liste maddesi ve satır sonları sırayla, mağazanın açık bıraktığı satırın sonuna nokta eklenir ("Yıkanmış keten, rahat kesim. Sedef düğme."). Kesme kelime sınırında:
    - `{kısa_açıklama}`: önce kısa açıklama (140 karaktere kadar, son nokta şablona bırakılır), yoksa alt başlık, yoksa açıklamanın ilk cümleleri.
    - Şablon boş çıkarsa meta açıklama: önce kısa açıklama (155 karaktere kadar), yoksa açıklamanın ilk cümleleri, yoksa liste sayfasının kendi cümlesi. OpenGraph ve Twitter açıklaması meta açıklamanın aynısıdır. `seo_description` yazılmışsa hep o.
    - JSON-LD `description` ve akışların (Google Merchant, Meta, Akakçe, Cimri) açıklaması: düz metin `description`, boşsa kısa açıklama (kesilmeden), o da yoksa akışta ürün adı.
- Şablonlar ve tenant metinleri sayfaya basılırken kaçışlanır (F18): HTML'de entity, JSON-LD içinde `<` → `\u003c` (`</script>` kapanışı olmasın). robots.txt `text/plain` + nosniff ile servis edilir. `canonical_host` alan adı doğrulaması gelene kadar yalnızca bağlantı üretiminde kullanılır; sunucu tarafı istek ve yönlendirme hedefi olmadan önce doğrulanmış alan adlarıyla sınırlanır (F16/F18).
- **Mağaza adı başlıkta bir kez** (2026-11-06): backend başlığı kurduktan sonra (şablondan ya da elle girilmiş `seo_title`'dan) aralarında boşluklu ayraç (`|`, `-`, `–`, `·` …) olan parçalardan öncekini tekrarlayanı ayracıyla birlikte atar (büyük/küçük harf ve boşluk farkı sayılmaz; `lib/seo/template.ts` `withoutRepeatedParts`). Marka adı mağaza adıyla aynıysa, ürün adı zaten "| Mağaza" ile bitiyorsa ya da yazar mağaza adını taşıyorsa ad bir kez görünür. Kelime içindeki tire (`N690-Böhler`) ayraç sayılmaz. Vitrin şablon eklemez: başlık backend'den `title.absolute` olarak basılır (Next `title.template` yok).
- Uzunluk hedefleri (lint): başlık 30–60 karakter (piksel genişliği tahmini ile), açıklama 70–155. Türkçe karakterler geniş; piksel tahmini font metrik tablosundan.
- Mağaza genelinde başlık/açıklama **benzersizliği** denetlenir (hash + normalize karşılaştırma).
- Sayfalama: `?sayfa=2` sayfaları kendi canonical'ına sahiptir (`rel=prev/next` Google tarafından kullanılmıyor); başlığa " – Sayfa 2" eklenir; 1. sayfa parametresiz canonical (`?sayfa=1` 301 ile temiz adrese gider). Son sayfadan sonrası 404.
  - **Başlık** (2026-11-06): ek mağaza adından önce girer, ad sonda ve bir kez kalır (`Kupalar – Sayfa 2 | My L'arte`); başlık mağaza adıyla bitmiyorsa sona eklenir. Ek başlığı 60 karakterin üstüne çıkarırsa önündeki kısım kelime sınırında `…` ile kısalır; sayfa numarası ve mağaza adı görünür kalır (tek kelime sığmıyorsa kesilmez). 1. sayfa ek almaz. Açıklama sayfalar arasında aynı kalır.
  - Tek yer vitrin `lib/seo/paging.ts` (`pageTitle`, `pagedSeo`): kategori, marka, koleksiyon, landing, `/kampanyalar` (resolve'un `listing.page`'i), blog kategori/etiket arşivleri ve yazar sayfası (`?sayfa=`), vitrinin kendi listeleri `/magaza`, `/blog`, `/yorumlar`. Backend `seo` yükünün başlığı 1. sayfanınkidir; numaralı sayfanın canonical'ını, robots'unu ve JSON-LD adını (`Kupalar – Sayfa 2`) backend verir (`listing-seo.ts`). `/arama` `noindex` ve ek almaz.
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
- **404 ve 410 sayfası ilk HTML'de tam** (2026-11-06): `not_found` alan adres için vitrin vekili isteği `/_bulunamadi` sayfasına 404 durumuyla yeniden yazar (410 için `/_kaldirildi` gibi). Sayfa normal çizilir: başlık, metin, arama ve kategori kutuları JS'siz tarayıcıya ve tarayıcıya ilk HTML'de gider. Neden: Next 16, çizilirken `notFound()` atan sayfayı boş hata kabuğu (`<html id="__next_error__">`) olarak gönderir; içerik yalnız istemcide çizilir. Sayfanın kendi bulduğu 404'ler (son sayfadan sonrası, başkasının siparişi) `notFound()` ile kalır: durum ve `noindex` doğru, gövde JS ile gelir (Next sınırı; docs/21 2026-11-06).
- **Hız sınırı 503'tür, 500 değil** (2026-11-06): backend bir ziyaretçinin okumasını 429 ile geri çevirince vitrin bunu `Retry-After` süresince tutar ve o ziyaretçinin katalog sayfalarına (ana sayfa, listeler, kayıt sayfaları, arama) `503` + aynı `Retry-After` döner. Sepet, ödeme, hesap, token bağlantıları ve rota işleyicileri bunun dışında; formların kendi sınırı ve canlı arama sayılmaz. Sınıra çarpan ilk sayfa çizimi hâlâ 500 olabilir (sayfa kendi durumunu seçemez); vekilin `resolve` çağrısı çarptıysa o istek de 503 olur.
- **404 günlüğü:** storefront `POST /store/seo/not-found` ile yolu ve referer'ı bildirir (rate limitli, PII'siz). Günlük job toplar; advisor benzer slug / eski slug / geçiş tablosu üzerinden hedef önerir, admin tek tıkla 301 oluşturur.

## 5. Yapılandırılmış veri (JSON-LD)
Backend `jsonLd` dizisini üretir; tema değiştiremez (sadece ek blok ekleyebilir). Her blok JSON şemayla test edilir.

| Sayfa | Bloklar |
|---|---|
| Ürün | `Product` (tek varyant) veya `ProductGroup` + `hasVariant[Product]`; her `Product` içinde `Offer` (`price`, `priceCurrency: TRY`, `availability`, `url`, `sku`, `gtin13`/`mpn`, `itemCondition`, `priceValidUntil` (zamanlı fiyat varsa), `shippingDetails`, `hasMerchantReturnPolicy`); `brand`; `image[]`; `aggregateRating` + `review[]` (F10.6'dan, yalnızca onaylı); indirimde ek `UnitPriceSpecification` `priceType: https://schema.org/StrikethroughPrice` ile eski fiyat, güncel fiyat Offer'da `priceType`'sız — üstü çizili fiyat **F4.3 indirim öncesi fiyat kuralıyla (10 gün, adr/0023 Ek 2026-11-05) aynı kaynaktan** gelir; hazır video varsa ürünle aynı `@graph`'ta video başına `VideoObject`, ürün `subjectOf` ile bağlanır (adr/0069 §9); `BreadcrumbList` |
| Kategori / marka / koleksiyon | `CollectionPage` + `ItemList` (ilk sayfa ürünleri), `BreadcrumbList` |
| Ana sayfa | `OnlineStore` (Organization'ın e-ticaret alt tipi; Google en spesifik tipi önerir) — künye (F13.9): ad, logo, adres, telefon, `sameAs` sosyal hesaplar; organizasyon seviyesinde `hasMerchantReturnPolicy` ve `hasShippingService` (ürün seviyesi bunları override eder; öncelik: Merchant Center ayarı > ürün markup > organizasyon markup); `WebSite` (SearchAction **yok**, sitelinks arama kutusu Kasım 2024'te kaldırıldı) |
| İçerik / blog | `Article`/`BlogPosting` (yazar, tarih, güncelleme tarihi, yayıncı); yazar seçilmişse `Person` (`name`, yazar sayfası `url`, `jobTitle`, `image`, `sameAs`; adr/0060) |
| Blog yazarı | `ProfilePage` (`mainEntity` `Person`) + `BreadcrumbList` (adr/0060) |
| Ürün Soru-Cevap (F10.10) | `QAPage` (gerçek kullanıcı soruları; mağazanın kendi eklediği SSS sorusu basılmaz, adr/0074 Ek 2026-11-21 (6)). **`FAQPage` kullanılmaz**: Google FAQ rich result'ı 7 Mayıs 2026'da tüm siteler için kaldırdı (doküman Haziran 2026'da silindi); `HowTo` Eylül 2023'ten beri yok. SSS içeriği kullanıcı için sayfada kalabilir, şema yatırımı yapılmaz. Tema düzenleyicinin SSS bölümü de (ana sayfa, ürün, kategori; içerik sayfasındaki "Sayfa SSS'si" dahil, adr/0073 Ek 2026-11-24 (2)) yalnız sayfada görünür, cevaplar HTML'dedir, `FAQPage` basılmaz (adr/0049 Ek 2026-11-06) |
| Tarihli ürün (adr/0076 §10) | `Product` yanında mağaza ayarına göre `TouristTrip` (yaklaşan kalkışlar `subTrip`, her biri `Offer`'lı) ya da kalkış başına `Event`; kargo ve iade alanları yazılmaz. `TouristTrip`'te ürünün programı varsa `itinerary`: `ItemList` + adım başına `ListItem` (`position`, `name` = adım başlığı, `description` = gövdenin düz metni, ≤ 300 karakter); program yoksa ya da boşsa yazılmaz, `Event`'te hiç yok (adr/0078 §8) |
| Yetişkin ürünler | `hasAdultConsideration` (2026-05, zorunlu; değer `SexualContentConsideration`) — kısıtlı kategori bayrağıyla (F13.4) eşlenir |

Kurallar:
- `price` sayısal string (sembolsüz), `availability` tam schema.org URL'si, tüm URL'ler mutlak, `brand.name` boş olamaz, `aggregateRating` varsa `ratingValue` + `reviewCount` zorunlu.
- `aggregateRating` ve `review` yalnız kendi onaylı ürün yorumlarımızdandır (F10.6). **Google yorumları (adr/0058) hiçbir bloğa girmez**, ne `Product` ne `OnlineStore`/`LocalBusiness`: Google'ın review snippet kuralları başka sitelerden toplanan puanı yasaklar ("Don't aggregate reviews or ratings from other websites") ve işletmenin kendi kontrol ettiği yorumlar `LocalBusiness`/`Organization` yıldızına uygun değildir. Vitrin onları yalnız metin olarak gösterir (`/yorumlar`); test: `integration-tests/http/google-reviews.spec.ts`.
- `shippingDetails` kargo seçeneklerinden (F7.8: bölge/ücret/teslim süresi; zorunlu alt alanlar `shippingRate`, `deliveryTime`, `shippingDestination` F3.12'de resmi dokümandan teyit edilir), `hasMerchantReturnPolicy` iade politikasından (F13.1: `applicableCountry`, `returnPolicyCategory`, `merchantReturnDays`, `returnFees`) otomatik türetilir; tenant ayrıca Search Console/Merchant Center'dan da tanımlayabilir (o ayar markup'ı ezer).
- Merchant listing için yalnızca `Offer` kullanılır (`AggregateOffer` kabul edilmez); `price` > 0; `sku` tek değer ve boşluksuz.
- Merchant Center ile **tutarlılık**: sayfadaki JSON-LD fiyat/stok/GTIN, feed'dekiyle aynı kaynaktan üretilir; Google "otomatik ürün güncellemeleri" bu eşleşmeye bakar.
- Sertifika/standart bilgisi (`Certification`) attribute şablonundan gelebilir (ör. CE, TSE) — sektör nötr.

## 6. Sitemap ve robots
- **Backend üretir** (worker, değişiklik sonrası debounce'lu + günlük tam üretim) → S3; storefront `/sitemap.xml` ve `/robots.txt`'yi proxy'ler. Tema bağımsız, tek kaynak.
- Sitemap index: `sitemap-products-N.xml`, `-categories`, `-brands`, `-collections`, `-pages`, `-posts`, `-landings`; dosya başına 50.000 URL / 50 MB sınırı; gzip.
- `lastmod` yalnızca içerik/fiyat/stok gibi anlamlı değişimde güncellenir (üretim zamanı değil).
- Görsel sitemap uzantısı (`image:image` + `image:loc`, URL başına en çok 1.000 görsel; `caption/title/license` alanları 2022'de kaldırıldı) ürün görselleri için. Video site haritası yok: Google ürün sayfasındaki destekleyici videoyu video sonuçlarına almaz (2023-12-04); ürün videosu `VideoObject` JSON-LD ile anlatılır (adr/0069 §9). `priority` ve `changefreq` yazılmaz (Google yok sayar).
- Dışarıda: `noindex` varlıklar, taslaklar, kısıtlı kategori (ayara göre), arama ve filtre URL'leri, hesap/sepet/checkout.
- Vitrinin sistem sayfaları (backend `lib/seo/paths.ts` `SYSTEM_PAGES` ve `RESERVED_ROOT_SEGMENTS`, vitrin `lib/seo/paths.ts` `SYSTEM_ROOTS`; ikisi birlikte değişir): kayıt bu köklerden birini tam yol olarak alamaz. 2026-11-02 eki: iletilerdeki token bağlantıları `/abonelik/cik`, `/abonelik/onay`, `/stok-bildirimi/onay` (`noindex,nofollow`, `Referrer-Policy: no-referrer`; adr/0038 Ek) ve `/cerez-tercihleri` (`noindex,follow`). robots.txt bunları engellemez: tarayıcı `noindex`'i görebilsin. 2026-11-03 eki: ödeme bağlantısının sayfası `/ode/<token>` (`noindex,nofollow`; adr/0051) ve hediye kartı bakiyesi `/hediye-karti/bakiye` (adr/0025 Ek) kökleri de ayrılmıştır.
- robots.txt admin'den düzenlenebilir; güvenli varsayılan şablon: `Disallow: /sepet, /odeme, /hesap, /arama`, filtre engelleri için `{facet_disallow}` satırı (§7); `Sitemap:` satırı; AI tarayıcı ön ayarları (§9).
- Staging ve önizleme ortamları: `X-Robots-Tag: noindex` + basic auth; yanlışlıkla indekslenme testi (F16).
- IndexNow: yayın/güncelleme/silme olaylarında tek uç (`api.indexnow.org`) üzerinden Bing, Yandex, Naver, Seznam, Amazon'a anahtarlı toplu bildirim (job). Google katılımcı değil; Google Indexing API yalnızca `JobPosting`/`BroadcastEvent` için çalışır, ürün sayfalarında kullanılamaz. Google için yol: sitemap + GSC sitemap gönderimi + URL Inspection (kota 2.000/gün/site).

## 7. Facet navigasyon ve listeleme sayfaları
- Filtre URL'leri parametreyle (`?marka=x&renk=y&fiyat=100-500&sirala=...`; ayırıcı yalnızca `&`, sabit parametre sırası). Google'ın güncel önerisi (Aralık 2025 facet rehberi): indekslenmeyecek filtre URL'leri **robots.txt ile taranmaz** (`Disallow: /*?*renk=` gibi desenler; canonical/nofollow/noindex uzun vadede daha zayıf ve tarama bütçesini korumaz). robots.txt şablonu facet parametrelerini otomatik üretir; canonical yine temiz kategori URL'sine işaret eder.
- Boş sonuç veren filtre kombinasyonu o URL'de **404** döner (genel 404 sayfasına yönlendirme yok); boş kategori sayfası `noindex` veya 404 (tenant ayarı) ve advisor uyarısı.
- **Facet landing sayfaları** (allowlist): tenant bir kategori + attribute/marka kombinasyonunu "landing" olarak işaretler → **path tabanlı** kendi slug'ı (`/kategori/bicak/paslanmaz-celik`; parametre değil, bu yüzden robots engeline takılmaz), başlığı, açıklaması, en az N kelime **özgün** metni, kendi canonical'ı, sitemap'e girer. Programatik sayfa güvenlik kapıları: sayfalar arası benzersiz içerik ≥ %40 (altında uyarı, %30 altında kırmızı; 2026-11-04 kullanıcı kararıyla yayın engeli kalktı, yayın mağazanın kararı), 50–100'lük partiler halinde yayın, en az %5 insan incelemesi, "tek başına değerli mi" testi (Google ölçekli içerik kötüye kullanımı politikası).
  - **Uygulama notu (F3 T14a, 2026-10-26):**
    - Landing kaydı `content` modülünde (`landing_page`): kategori + tek facet (marka ya da filtrelenebilir seçim özelliğinin bir değeri). Kategori ve facet sonradan değişmez; kategori + facet ve kategori + adres benzersizdir.
    - Yol kategorinin bugünkü yolu + adres (`/kategori/ev-ve-yasam/seramik`). Kategori taşınınca landing'ler de taşınır (eski yol 301); kategori gizlenince sayfa 404, silinince 410.
    - Özgünlük: metnin 5 kelimelik dizilerinin MinHash imzası (`lib/content/originality`); facet ve kategori adları ölçümden önce yer tutucuya çevrilir. Bir sayfa, metni kendisinden önce yayına girmiş canlı sayfalarla ölçülür (metnin sahibi onu ilk yayına alan). Kapı yayına alırken ve canlı metin değişirken çalışır; gece işi hepsini yeniden ölçer.
    - Sitemap (`landings`), IndexNow ve 404 önerileri yalnızca kategorisi görünen landing'leri alır. Ürün listesi kategorinin görünen alt kategorilerini kapsar.
- **Uygulama notu (F3 T14b, 2026-10-26):**
  - Parametreler: `marka` (marka handle'ları), filtrelenebilir seçim özelliklerinin anahtarları (seçenek değerleri), `stok` (tek değeri `var`: yalnız stoktakiler, adr/0056), `fiyat` (`100-500`, uçlardan biri açık olabilir), `sirala` (`yeni`, `fiyat-artan`, `fiyat-azalan`; varsayılan `onerilen` yazılmaz), `sayfa`. Bir anahtarın birden çok değeri virgülle (`renk=kirmizi,mavi`). Bu adlar ve başka adreslerin parametreleri (`variant`, `q`, `utm_*`, `gclid` vb.) filtrelenebilir özelliğin anahtarı olamaz.
  - Kanonik biçim: `marka`, sonra özellik anahtarları ve `stok` alfabetik, her birinin değerleri sıralı ve tekil; sonra `fiyat`, `sirala`, `sayfa`. Diğer parametreler (`utm_source`) geldikleri sırayla sona eklenir ve yönlendirme yaptırmaz. Başka sıra ya da biçim (tekrarlanan anahtar, boş ya da geçersiz değer, `sayfa=1`, varsayılan sıralama) tek 301 ile kanonik biçime gider.
  - Kategoride tek facet (tek anahtar, tek değer, fiyat ve sıralama yok) yayındaki bir landing'e karşılık geliyorsa 301 ile landing'e gider; `sayfa` ve diğer parametreler korunur.
  - Ürünü olmayan filtre kombinasyonu, son sayfadan sonrası (sayfa başına 24 ürün) ve tuzak sorgular (6'dan fazla anahtar, anahtar başına 10'dan, toplam 12'den fazla değer, 10.000'den büyük sayfa) 404. Fiyat bu sayıma girmez (bölgeye bağlı); fiyatla boş kalan sayfada 404'ü storefront verir.
  - Sorguyla biten yönlendirme (eski yol, kural) hedefin liste yanıtıyla birleşir: tek atlama.
  - Filtreli, fiyatlı ya da sıralı liste `noindex,follow`, canonical temiz sayfa. Numaralı sayfanın JSON-LD'si kendi adresini ve "Sayfa N" adını taşır, ilk sayfanın ürün listesini taşımaz. Resolve yanıtında okunan sorgu `listing` alanında (`page_size` dahil; storefront ürünleri buna göre ister).
  - robots.txt şablonundaki `{facet_disallow}` satırı her filtre, `stok`, `fiyat` ve `sirala` için `Disallow: /*?{ad}=` ve `Disallow: /*&{ad}=` satırlarına açılır; `sayfa` ve landing yolları açık kalır. Mağaza denetimi (S-ROBOTS-01) açık kalan filtre adresini bulur.
  - `/store/seo/site` storefront'un kendi sayfalarının robots değerini verir: arama `noindex,follow`; sepet, ödeme, hesap, giriş `noindex,nofollow`.
- **Uygulama notu (tarihli ürün araması, adr/0077 §2, 2026-11-23):**
  - Yeni ayrılmış parametreler: `kategori` (handle, alt kategoriler dahil), `tarih` (`YYYY-MM-DD_YYYY-MM-DD`, bugünden sonra, en çok 62 gün), `ay` (`YYYY-MM[,YYYY-MM]`, en çok 3, önümüzdeki 12 ay), `kisi` (`1..20`; `1` yazılmaz) ve `sirala`'nın yeni değeri `kalkis`. `tarih` ile `ay` birlikteyse `tarih` kalır. Kanonik olmayan biçim tek 301. `tarih`, `ay`, `kisi` yalnız `catalog.booking` açıkken okunur, kapalıyken 301 ile atılır. Bu adlar filtrelenebilir niteliğin anahtarı olamaz; çakışan anahtarlı nitelik süzgeçten çıkar.
  - `/arama`, `q` yokken de geçerli `tarih`/`ay` ya da `kategori` ile sonuç verir; sayfa `noindex,follow` kalır.
  - Uygulama (PR2, 2026-11-23): "bugün" mağaza saat diliminde (`Europe/Istanbul`) okunur ve aralığa dahildir; `tarih` ve `ay` yalnız bu kuralı sağlıyorsa okunur, geçmiş, 62 günü aşan ya da `ay`ın sunduğu 12 ayın dışında başlayan aralık atılır (301), 3'ten çok ay ilk üçe kısalır. Sıralama: `kategori`, `tarih`|`ay`, `kisi`, süzgeçlerden sonra ve `fiyat`tan önce. `kategori` yalnız aramada okunur; liste sayfasında sıradan parametredir. Tarih verilip sıralama seçilmemişse sonuç en yakın kalkışa göre gelir; tarihsiz `sirala=kalkis` daraltmaz, önümüzdeki 12 ayın kalkışlarına göre sıralar, kalkışı olmayanlar sona. Tarihle daraltma en yakın 1000 ürünle sınırlıdır (SQL'de `LIMIT`); her ay ayrı aralıkla okunur; aynı tarih + kişi + gün için eşleşen ürünler süreçte 30 sn tutulur. `/store/card-facts` kendi hız sınırını taşır (`card_facts`, IP başına dakikada 240). `GET /store/listings/products` kanonik olmayan sorguda yanıta `canonical_query` ekler (vitrin 301'i buna göre verir).
  - Çakışan nitelik anahtarı (denetim notu): bu adlar `isReservedParam`'a girdi. Yeni filtrelenebilir seçim niteliği bu anahtarla kaydedilemez (`product_attributes.key_reserved`, mevcut kural). Önceden bu anahtarla kaydedilmiş filtrelenebilir nitelik süzgeçten ve robots satırlarından düşer; değerleri, ürün sayfasındaki görünümü ve arama sözcükleri korunur; süreç başına bir kez `listing.filter_key_reserved` uyarısı loglanır. Mağaza niteliğin anahtarını değiştirmek için yeni nitelik açar.
  - `{facet_disallow}` şu satırları da üretir: `Disallow: /*?tarih=`, `Disallow: /*&tarih=`, `Disallow: /*?ay=`, `Disallow: /*&ay=`, `Disallow: /*?kisi=`, `Disallow: /*&kisi=`; `sirala=kalkis` mevcut `sirala` satırlarıyla zaten kapsanır. `kategori` yalnız `/arama`'da anlamlıdır ve o yol zaten `Disallow: /arama` ile kapalıdır. Doğal dil aramasının "Anladığım" etiketleri ve takvim bağlantıları `nofollow`.
- Sıralama ve fiyat aralığı parametreleri asla indekslenmez. Sayfalama §3.
- Dahili arama sayfası `noindex`; arama terimleri raporu (F11) içerik fırsatı önerir (çok aranan ama ürünü/sayfası olmayan terimler).

## 8. Görseller
- Dosya adı slug'dan üretilir: `{urun-slug}-{sira}.webp`; orijinal ad meta olarak saklanır.
- `alt` zorunlu alan; boşsa öneri: `{ürün adı} {varyant/öne çıkan attribute} - {sıra açıklaması}`; lint eksik alt'ı işaretler.
- Ana görsel ≥ 800×800 (Google Alışveriş uygunluğu), ürün başına ≥ 3 görsel hedefi; WebP + AVIF türevleri, `srcset` boyut seti; LCP görseli lazy değil (F18).
- Zengin metin (içerik sayfası, blog, landing, tema düzenleyicinin zengin metin bölümü) görselleri medya kütüphanesinin ölçtüğü `width`/`height` ile basılır (CLS; 2026-11-06). Kütüphanenin ölçmediği görsel ölçüsüz kalır.
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
5. İç bağlantılar (adr/0042 Ek 2026-11-05): taşınan kayıtların eski yolları taşıma biter bitmez kendi kayıtlarına 301 verir; taşınan yazı, sayfa ve ürün açıklamalarındaki eski site bağlantıları (yol ya da eski/yeni alan adıyla mutlak adres) adres kaydı ve kurallar üzerinden bugünkü yola çevrilir, böylece site içi bağlantı 301 zinciri taşımaz. Başka siteye giden bağlantıya dokunulmaz; 410 ve karşılıksız adres raporlanır. Önceden taşınmış metinler için `content.link_rewrite` işi (Ayarlar > Taşıma, sahip ve yönetici). Hâlâ 301'i olmayan sınıflar (sahibin kararını bekleyenler) aynı ekte listeli.
6. Eski platformun kendi adresleri (adr/0059): WordPress'ten taşınan mağazada kayıt olmayan WordPress adresleri tek 301 ya da 410 alır. Sonlu olanlar taşımada açık kayıt olur (alt kategorinin kısa yolu kategoriye ayrılır; taşınan görselin `/wp-content/uploads/…` dosyası, her boyutuyla, medya varlığının adresine). Açık uçlu olanlar çözümlemede en son sorulan kalıp kurallarıdır: sayfalama (`/x/page/N`, `?paged=N` → listenin `?sayfa=N`'i, yoksa ilk sayfa), tarih ve yazar arşivi → `/blog`, ürün etiketi → `/arama?q=`, `?p=`/`?page_id=`/`?product=`/`?product_cat=` → kaydın bugünkü yolu, beslemeler ve `wp-login.php` gibi WordPress parçaları 410, WooCommerce sepet/ödeme/hesap sayfaları → vitrinin. WordPress'in sorgu parametreleri atılır, ziyaretçininkiler korunur; vitrin vekili sondaki eğik çizgili ya da büyük harfli eski adresi de tek atlamada gönderir, 410'unu da doğrudan verir (önce temiz biçime 301 yok). Ek sayfaları (`/urun/x/ek-adi/`, `/yazi/attachment/ek-adi/`; adr/0059 Ek 2026-11-06) en son sorulur: ebeveyni taşınmış canlı bir ürün, yazı ya da sayfaysa kaydın bugünkü sayfasına tek 301 (ek adı taşınan bir dosyayla eşleşse de görsele değil); kategori altında ya da bilinmeyen ebeveynde 404 kalır, `?attachment_id=` 410. Önceden taşınmış mağaza için `legacy:backfill <wxr> [apply]`.

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
