# ADR-0075: Kategori, marka ve koleksiyon açıklaması zengin metin, sayfanın altında

- **Durum:** Kabul edildi (sahip kararı 2026-11-20; ayrıntılar otonom, sahip görüp revize eder)
- **Tarih:** 2026-11-20
- **İlgili:** adr/0019 (içerik belgesi), adr/0049 (tema düzenleyici; kategori sayfası grubu), adr/0053 (tema ayarları), adr/0055 (ürün açıklaması içerik belgesi), adr/0062 (Grafit varsayılanları), adr/0063 §3 (tema ayarları tasarımda), adr/0066 (yayımlanmış biçim sözleşmedir), adr/0067 (stil takımı), docs/13 (SEO), docs/14 (advisor), `docs/tema/bilesen-standardi.md` §7
- **Dayanak:** sahip (2026-11-20): kategori, marka ve koleksiyon açıklamaları ürün açıklaması gibi zengin metin olsun; başka yerden yapıştırınca başlık ve paragraflar korunsun; metin liste sayfasının **altına** insin (ürünlerden sonra, yalnız 1. sayfada), üstte yer kaplamasın (SEO); görünüşünü mağaza geneli bir tema ayarı yönetsin (yazı boyu Küçük/Normal/Büyük, hizalama, genişlik, "Devamını oku" ile katlama açık/kapalı); yazı ailesi temadan gelir. Marka ve koleksiyon için de aynısı.

## Bağlam

### Kodda bugün olan (2026-11-20 `dev`, okundu)

- **Üçü de düz metin.** Kategori: Medusa'nın `product_category.description` sütunu (Medusa'nın kendi formu ve `POST /admin/product-categories/:id`). Marka: `brands` modülü `brand.description` (`modules/brands/models/brand.ts`; `POST /admin/brands`, `/admin/brands/:id`, `saveBrandWorkflow`, düz metin sınırı 5000). Koleksiyon: `catalog-extension` modülü `collection_extension.description` (`POST /admin/collections/:id/details`, `setCollectionDetailsWorkflow`).
- **Ürünün deseni hazır (adr/0055).** `product_extension.description_doc` (JSON); `lib/catalog/description.ts` (`productDescriptionDoc` içerik belgesini `contentDoc` ile denetler, görsel ve ürün/kategori kartını reddeder; `descriptionChanges()` belgeyi yazar, düz metnini `product.description`'a aynalar; `DESCRIPTION_TEXT_MAX` 20 000). Vitrin `GET /store/products/:id/description` ile sunucuda `renderDoc` (`lib/content/render.ts`) çıktısını okur, bir dakika önbellekli. Panel belgesi olmayan ürünü düz metninin paragraflarıyla açar (`docOfDescription`), göçü kayıtta yapar.
- **Kategoride uzantı satırı var.** `catalog-extension` kategori için kimlikle (`category_id`) bağlı satırlar tutar: `category_image`, `category_restriction`. Modül bağlantısı (link) yok; okuyan kategoriyi kendisi denetler.
- **Vitrin.** `apps/storefront/src/screens/listing.tsx` `headingOf` açıklamayı `paragraphsOf(...)` ile paragraflara böler; sözleşme `ListingPageView.description: string[]` (`packages/ui/src/listing-views.ts`); Atölye `ListingPage.tsx` metni başlığın altında, ürünlerin **üstünde** çizer. Kategori, marka, koleksiyon verisi: `/store/product-categories` (Medusa), `/store/brands/:id`, `/store/collections/:id/details`.
- **Tema ayarları.** `platform-settings` `theme` bölümü (`sections/theme.ts`) mağaza geneli görünüş seçimlerini tutar; adr/0063 §3'ten beri tasarımın taslağıyla yazılır, önizlenir, yayınlanır (`lib/storefront/layout-theme.ts`). Sözleşme kopyası `packages/types` `StoreThemeSettings`. Kategori sayfası grubu (`layout.category`, adr/0049 Ek 2026-11-03) bölüm listesidir; ayar tutmaz.
- **Okuyucular düz metni okur.** Meta açıklama yedeği (`workflows/seo/payload.ts`), arama dizini, yapay zekâ ve advisor (`workflows/seo/advisor/facts.ts`) `description`'ı okur.

## Karar

### 1. Saklama

| Varlık | Belge | Düz metin (ayna) |
|---|---|---|
| Kategori | **Yeni** `catalog-extension` `category_extension` tablosu: `id` (`cext_`), `category_id` (silinmemişlerde tekil), `description_doc` JSONB null | Medusa `product_category.description` |
| Marka | `brand.description_doc` JSONB null | `brand.description` |
| Koleksiyon | `collection_extension.description_doc` JSONB null | `collection_extension.description` |

- Kategoride Medusa çekirdeğine sütun eklenmez (altın kural 2). `category_image` gibi kimlikle bağlı ayrı satır: resim satırı yalnız resim varken vardır, onu genişletmek anlamı karıştırırdı. Ad genel (`category_extension`): kategoriye sonra gelecek alanlar buraya girer.
- Belge null: kayıt yalnız düz metne sahiptir (bugünkü bütün kayıtlar).
- Migration'lar: `brands/Migration20261120090000` (sütun), `catalog-extension/Migration20261120090100` (tablo + koleksiyon sütunu). Anlık görüntü dosyaları aynı değişikliği taşır.

### 2. Doğrulama ve ayna

- **İzin listesi ürün açıklamasınınki** (adr/0055): başlık H2–H4, paragraf, madde ve sıralı liste, alıntı, tablo; kalın, italik, güvenli bağlantı. Görsel, ürün kartı, kategori kartı yok. H1 yok: sayfanın tek H1'i varlığın adıdır. Sınırlar `contentDoc`'unki (`DOC_LIMITS`). Ret anahtarı ayrı: `catalog.listing_description_blocks` (ürününki "ürünün görsellerine ekleyin" der).
- Ortak kod `lib/catalog/listing-description.ts`: `listingDescriptionDoc` (şema; `description.ts`'teki `descriptionDocSchema(anahtar)` fabrikasından), `listingDescriptionChanges()`, `listingDescriptionHtml()`, `storedListingDoc()`.
- **Kayıt kuralı ürünle aynı:** metni olan belge saklanır, düz metni `description`'a yazılır (`docPlainText`, en çok 20 000 karakter); metni olmayan belge ikisini de temizler (marka ve koleksiyonda `null`, kategoride Medusa'nın boşu `""`); `null` belgeyi düşürür, düz metni bırakır. Yalnız değişen yazılır.
- **Düz metin yolu kalır** (içe aktarma, betik, eski panel): markada `description`, koleksiyonda `description` hâlâ kabul edilir; düz metin yazılınca belge düşer, ikisi farklı şey söylemez. Aynı istekte ikisi birden gelirse 400 `catalog.description_one_of`. Kategori ucu yalnız belge alır; Medusa'nın kendi kategori formu düz metni yazmaya devam edebilir (bkz. §9).
- **İnce rota, iş akışında mantık.** Marka `saveBrandWorkflow` (`workflows/brands/rules.ts` `describedAs`), koleksiyon `setCollectionDetailsWorkflow`, kategori yeni `setCategoryDescriptionWorkflow` (`workflows/catalog/category-description.ts`): kategori başına kilit, belge satırı (oluştur/güncelle; telafisi eski hâline döndürür), düz metin değiştiyse Medusa'nın `updateProductCategoriesWorkflow`'u `runAsStep` ile (kancaları ve `product-category.updated` olayı koşar: arama, advisor, çözüm önbelleği yeniden okur). İstek gövdesi sınırı bu üç yazma ucunda 1 MB (ürün kataloğu ucuyla aynı gerekçe).
- **Denetim kaydı.** `POST /admin/category-descriptions/:category_id` yeni kaynak (düz metin ve belge özetle, metnin kendisi loga girmez); marka ve koleksiyon anlık görüntülerine `description_doc` özeti eklendi. Yetki: yazma `operations` rolüne kapalı (kategori resmi gibi), plan koruması `"/admin/category-descriptions*"` katalog alanında.

### 3. Eski düz metinden belgeye geçiş: panelde, okurken

Göç betiği **yok**. Panel belgesi olmayan kaydı (`description_doc: null`) düz metninin paragraflarıyla açar (ürünün `docOfDescription` deseni); mağaza kaydedince belge oluşur. Gerekçe:

- Ürünlerde aynı yol çalışıyor; panel kodu ve davranışı tek.
- Düz metinden belgeye çeviri bilgi eklemez (başlık, liste yok); toplu yazmak yalnız veri ve risk (Medusa kategorisini toplu güncellemek olay ve kanca fırtınası) üretir.
- Vitrin belgesiz kayıtta `description_html: null` alır ve düz metni bugünkü gibi paragraflarla, artık altta çizer: görünen içerik değişmez.

### 4. Uçlar (sözleşme)

**Yönetici (panel yalnız `description_doc` gönderir):**

- Kategori: `GET /admin/category-descriptions/:category_id` → `{ description: { category_id, description: string, description_doc: ContentDoc | null } }`; `POST` aynı yol, gövde `{ description_doc: ContentDoc | null }` (katı; başka alan 400) → aynı yanıt. Bilinmeyen kategori 404.
- Marka: `POST /admin/brands` ve `POST /admin/brands/:id` gövdesinde `description_doc?: ContentDoc | null`; `GET /admin/brands`, `GET /admin/brands/:id` ve yazma yanıtlarında `brand.description_doc: ContentDoc | null` (+ `description` ayna).
- Koleksiyon: `POST /admin/collections/:id/details` gövdesinde `description_doc?: ContentDoc | null`; yanıt ve `GET /admin/collection-board`, `/admin/collection-board/:id` içinde `collection.description_doc: ContentDoc | null`.

**Vitrin (sunucuda `renderDoc`, `Cache-Control: public, max-age=60, stale-while-revalidate=300`):**

- Kategori: **yeni** `GET /store/category-descriptions/:id` → `{ category_id: string, description_html: string | null }`. Gizli ya da iç kategori 404 (sayfası da yoktur). Medusa'nın `/store/product-categories` yolu değişmez (çekirdek).
- Marka: `GET /store/brands/:id` → `brand.description_html: string | null` eklendi (liste ucu `GET /store/brands` eklemez).
- Koleksiyon: `GET /store/collections/:id/details` → `details.description_html: string | null` eklendi.
- `description_html` null: düz metin yalnız (`description`); vitrin onu paragraflarla çizer. Türler: `packages/types` `StoreCollectionDetails.description_html?`, `StoreCategoryDescription`.

### 5. Yerleşim: ürünlerin altında, yalnız 1. sayfada

- Açıklama başlığın altından kalkar; **ürün ızgarasından (ve sayfalamadan) sonra**, kategori grubunun `bottom` bölümlerinden önce çizilir. Başlıkta yalnız iz, H1 ve (koleksiyonda) görsel kalır.
- Yalnız 1. sayfada (`?sayfa=2` ve sonrası, filtreli sonuçlar da sayfa 1 ise çizer; arama sonucu sayfasında yok). Kopya içerik sinyali vermez, okuyana tekrar göstermez.
- Landing sayfaları (`landing.html`) bu ADR'nin dışındadır; yerleri değişmez.

### 6. Görünüş ayarı: tema ayarlarında `listing_text`

```ts
// packages/types/src/store/listing-text.ts
listing_text: {
  size: "sm" | "md" | "lg"        // Küçük / Normal / Büyük; varsayılan "md"
  align: "start" | "center"       // varsayılan "start"
  width: "narrow" | "wide"        // okuma ölçüsü / içerik genişliği; varsayılan "narrow"
  collapse: boolean               // "Devamını oku"; varsayılan true
}
```

- **Yeri tema ayarları** (`StoreThemeSettings.listing_text`, backend `theme` bölümü, `theme-listing-text.ts`), kategori düzeni değil: istek "mağaza geneli tema ayarı"; üç sayfa türüne birden uyar (kategori grubu yalnız kategoriyi kapsar); yazı ailesi zaten tema ayarında (`typography.body`). Tasarımın taslağıyla düzenlenir, önizlenir, yayınlanır (adr/0063 §3); panelde Tema → ayarlar altında bir grup.
- Ayar yalnız seçimlerden oluşur; CSS, piksel, yazı tipi alınmaz (şema katı).
- **Geriye uyum:** grubu olmayan saklı tema, hazır görünüm ve **grubu göndermeyen panel kaydı** varsayılanları okur (`withListingTextDefaults`; tasarım kaydı `layoutTheme` bunu kayıttan önce uygular, böylece eski panel 400 almaz). Ayar bölümü yaması (`POST /admin/platform-settings/theme`) grubu kısmi alır.
- Sözleşme `listingTextOf()` eksik ya da bilinmeyen değeri varsayılana çevirir (eski backend).
- **Kilit (adr/0066).** Varsayılanlar bugün yeni olan çizimi tanımlar; mevcut bir biçimin görünüşünü değiştirmez. Hazır görünüm kilitlerinde değişen tek şey açıklamanın yeridir (sahip kararı); vitrin dilimi `pnpm lock:presets` ile bilerek yeniden yazar ve PR'da etkilenen görünümleri listeler.

### 7. SEO (CLAUDE.md kural 11)

- Sayfada **tek H1** (varlığın adı); belge H1 içeremez, başlıkları H2–H4.
- Metin katlanmışken de **DOM'da** durur: "Devamını oku" yalnız görsel yüksekliği sınırlar (CSS, `aria-expanded`), metni JS ile sonradan eklemez, `display:none` kullanmaz. Kısa metinde düğme çizilmez.
- Alta taşımak ilk ekranda ürünleri öne alır (LCP, kullanıcı niyeti); metin sayfada kalır, sıralamayı etkilemez.
- Meta açıklama yedeği, JSON-LD, advisor ve arama düz metin aynasını okur; davranışları değişmez. Belgedeki iç bağlantılar mağaza yolları ya da https adresleridir (`isSafeHref`).
- Slug ve 301 etkisi yok (adres alanlarına dokunulmaz).

### 8. Güvenlik

- HTML istemciden alınmaz; belge şemayla denetlenir, HTML sunucuda izin listesiyle üretilir, her metin ve adres kaçışlanır (adr/0019). Saklı belge okunurken yeniden denetlenir; bozuk belge `null` döner.
- Yazma uçları yönetici oturumu ister (kategori uçları `requireUserActor`); denetim kaydı belgenin özetini tutar, metni değil.

### 9. Bilinen sınırlar

- Medusa'nın kendi kategori ucu (`POST /admin/product-categories/:id`) `description` yazarsa belge eski kalabilir; vitrin belgeyi gösterir. Panel kategori formunda açıklamayı yalnız yeni uçtan yazar; Medusa Admin'e ekran yazılmaz.
- Kategori silinince `category_extension` satırı yetim kalır (resim satırı gibi); okunmaz, zararsız.
- Bir sayfanın adresi değişince ürün açıklamalarındaki bağlantılar yeniden yazılır (`workflows/content/rewrite-links`); liste açıklamaları bu işe henüz katılmaz (eski yol 301 verir). Sonraki iş.

## Dilimler

| Dilim | Kapsam | Sahip |
|---|---|---|
| **S1 backend + sözleşme** | Modeller ve migration'lar; `lib/catalog/listing-description.ts`; üç yazma iş akışı; yönetici ve vitrin uçları; denetim, yetki, plan koruması; `listing_text` tema ayarı (backend şeması + `packages/types`); birim ve HTTP testleri; bu ADR | backend (bu PR) |
| **S2 panel** | Kategori, marka, koleksiyon düzenleme pencerelerinde açıklama için ürününkiyle aynı belge editörü (`DocumentCard`, görsel ve kart kapalı); belgesiz kayıtta düz metnin paragrafları; yalnız `description_doc` gönderir; Tema ayarlarına "Liste açıklaması" grubu (boyut, hizalama, genişlik, katlama) ve i18n anahtarları `storefront.editor.theme.listingText.*` | panel |
| **S3 vitrin + tema** | `listing.tsx`: açıklamayı başlıktan alıp ızgaradan sonra, yalnız 1. sayfada; kaynak `description_html` (kategori yeni uçtan, marka ve koleksiyon mevcut yanıtlardan), yoksa düz metin paragrafları; `packages/ui` sözleşmesine alt metin alanı ve `listingTextOf(theme.listing_text)`; Atölye'de çizim (gövde yazı ailesi, boyut/hizalama/genişlik, CSS ile "Devamını oku"); kilit yeniden yazımı | vitrin |

## Karar listesi (K)

- **K1.** Belge üç varlıkta da `description_doc`; düz metin aynası mevcut `description` alanında kalır.
- **K2.** Kategori belgesi Medusa'ya değil `catalog-extension` `category_extension` satırına (kimlikle), marka kendi modülüne, koleksiyon `collection_extension`'a.
- **K3.** İzin listesi ürün açıklamasınınki; görsel ve kart yok; ret anahtarı `catalog.listing_description_blocks`.
- **K4.** Kayıt ve ayna kuralı adr/0055 ile aynı; düz metin yazılırsa belge düşer; ikisi birden 400.
- **K5.** Eski metnin göçü panelde okurken; betik yok.
- **K6.** Vitrin HTML'i sunucuda üretilir; kategori için yeni `GET /store/category-descriptions/:id`, marka ve koleksiyon mevcut yanıtlarına `description_html`.
- **K7.** Açıklama ürünlerden sonra, yalnız 1. sayfada.
- **K8.** Görünüş tek tema ayarı `listing_text` (`size`, `align`, `width`, `collapse`; varsayılan `md`, `start`, `narrow`, `true`); yazı ailesi temanın gövde yazısı.
- **K9.** Katlı metin DOM'da kalır; tek H1.

## Alternatifler

- **Göç betiğiyle toplu belge.** Reddedildi: bilgi eklemez, Medusa kategorilerinde toplu olay üretir; ürünlerde de yapılmadı.
- **Görünüş ayarı kategori düzeninde (`layout.category`).** Reddedildi: grup bölüm listesidir, ayar taşımaz; marka ve koleksiyonu kapsamaz; sahip "tema ayarı" dedi.
- **Ayrı vitrin ucu her varlık için (`/store/brands/:id/description`).** Reddedildi: marka ve koleksiyon sayfası zaten kendi yanıtını okuyor; tek alan eklemek bir istek tasarrufu sağlar. Kategori Medusa'nın ucunda olduğundan ayrı uç zorunlu.
- **İstemcide HTML üretmek.** Reddedildi: adr/0019 sunucuda üretim; istemci kodu ve güvenlik yüzeyi büyür.

## Sonuçlar

- **Olumlu.** Yapıştırılan metnin başlık ve paragrafları korunur; açıklama ilk ekranı kaplamaz; mağaza görünüşünü tek yerden seçer. Düz metin okuyucuları değişmez.
- **Olumsuz.** Bir tablo, iki sütun, bir uç daha; vitrin kategori sayfası için bir istek daha (bir dakika önbellekli).
- **Kilit.** Açıklamanın yeri değiştiği için liste sayfası kilitleri S3'te bilerek yeniden yazılır.
