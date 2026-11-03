# WordPress + WooCommerce (WXR geçiş kaynağı)

> Karar: ADR-0042 "Ek (2026-11-03): WordPress (WXR) kaynağı". Kod: `apps/backend/src/lib/migration/sources/wordpress/`. Yazma tarafı: `apps/backend/src/workflows/migration/categories.ts` (kategori SEO alanları), `products.ts` + `attributes.ts` + `attribute-report.ts` (açıklayıcı özellikler), `content.ts`, `post-terms.ts`. Testler: `src/lib/migration/sources/wordpress/__tests__/`, `integration-tests/http/migration-wordpress.spec.ts`.

WordPress sitesinin kendi dışa aktarma dosyası (WXR) bir kez okunur: ürün kategorileri, markalar, ürünler ve varyasyonları, görseller, yorumlar, blog yazıları (kategori ve etiketleriyle), içerik sayfaları ve hepsinin eski adresleri. Eklenti, API anahtarı ya da sitede değişiklik gerekmez.

## Mağaza sahibinin yapacakları

1. WordPress yönetiminde **Araçlar > Dışa aktar**, **Tüm içerik**, **Dışa aktarma dosyasını indir**. Dosya `siteadi.WordPress.2026-11-02.xml` gibi bir XML'dir.
   - "Tüm içerik" seçilmeli: ürün, varyasyonları, görselleri (ortam kütüphanesi) ve kategori tanımları aynı dosyada olmalı; okuyucu bunları dosyanın içinde birbirine bağlar. Tür tür dışa aktarmada (yalnızca Ürünler, yalnızca Yazılar) bu bağlar kopar: varyasyonlar ana ürünsüz, görseller kütüphanesiz, kategoriler tanımsız kalır.
   - Sınır **XML'in kendisi için 50 MB**: düz yüklenirse dosya, zip'lenip yüklenirse zip'in içindeki `.xml` (zip okuyucusunun girdi sınırı da 50 MB). Zip yalnızca yüklemeyi küçültür, sınırı büyütmez.
   - XML'i 50 MB'ı aşan site şimdilik bu yoldan taşınamaz. Aynı siteden ikinci bir dosya tekrarsızlığı bozmaz (kaynak kimliği ve WordPress kimlikleri aynı, bir kez yazılan yeniden yazılmaz), ama parçalara bölmek yukarıdaki bağları kopardığı için önerilmez. Açık iş: büyük dosya için akışlı okuma ya da WooCommerce REST "Bağlan" yolu.
2. Panelde **Ayarlar > Taşıma**, kaynak **WordPress**, dosyayı seçer.
   - Ürünlerde ağırlık ve ölçü çoğu zaman yoktur (WooCommerce'te çoğu mağaza girmez). Ürünler yine de kaynaktaki durumlarıyla (yayında ya da taslak) gelir; kargo ücreti mağazanın varsayılan paketine göre hesaplanır (Ayarlar > Kargo, ADR-0054). Taşımada verilen paket isteğe bağlıdır: ölçüsüz ürünlere kendi ölçüsü olarak yazılır.
   - Kategori adresleri sitenin kendi bağlantılarından okunur. Raporda yanlış görünürse kategori adres tabanını (ör. `/urun-kategori/`) elle verir.
3. **Kuru çalıştırır**, raporun Notlar sayfasını okur, sonra **uygular** (yeniden doğrulama ister).
4. Eski adresler kartında yasal metinlerin ve sistem sayfalarının eski adreslerine karar verir (ör. `/satis-sozlesmesi/` → `/yasal/mesafeli-satis-sozlesmesi`).

## Eşleme

| WordPress / WooCommerce | Platform |
| --- | --- |
| `product_cat` | Kategori ağacı (üst zinciriyle yol). Açıklama: terimin açıklaması, yoksa Flatsome'un kategori altı bloğu (`cat_meta`), düz metin. Eski adres `{taban}{üst}/{alt}/`. SEO: terimin Rank Math alanları (`rank_math_title`, `rank_math_description`, `rank_math_focus_keyword`) varsa yeni kategoriye yazılır; yoksa hiçbir şey yazılmaz ve kategori panelde SEO alanı boş açılmış bir kategori gibi mağazanın şablonlarını alır (başlık mağazanın kategori başlık şablonundan, Ayarlar > SEO, varsayılanı `{kategori} Modelleri ve Fiyatları \| {mağaza}`; açıklama kategorinin kendi metninden, yoksa "… kategorisindeki ürünler" cümlesinden). Mağazada zaten olan kategoriye dokunulmaz. Raporun Özet sayfasında yeni kategorilerin kaçının kendi alanıyla, kaçının varsayılanla geldiği yazar |
| `product_brand` (WooCommerce Brands), `pwb-brand`, `yith_product_brand` | Marka, eski adres `{taban}{slug}/` |
| `product` (yayında) | Yayında ürün; gizli (katalog ve aramadan çıkarılmış), taslak, özel, parolalı → taslak. Çöp, gruplanmış ve dış bağlantılı ürün taşınmaz |
| `wp:post_name` | Tanıtıcı (platformun slug kuralıyla); eski adres öğenin `<link>`'i (`/urun/{slug}/`) |
| Ürün içeriği (HTML, Flatsome kısa kodları) | Açıklama, düz paragraflar: başlık satırı, liste maddesi `•`, tablo satırı `Ad: Değer`. Betik, stil, görsel, ürün vitrini kalkar. 20.000 karakter (paragrafta kesilir). İçerik boşsa kısa açıklama |
| `product_cat` sırası | `rank_math_primary_product_cat` (ya da Yoast'ınki) birinci, sonra dosyadaki sıra |
| `rank_math_title`, `rank_math_description`, `rank_math_focus_keyword` (ve Yoast karşılıkları) | SEO başlığı, açıklaması, odak kelimesi (listenin ilki). Değişkenler: bkz. ADR Ek madde 5 |
| `_thumbnail_id`, `_product_image_gallery`, varyasyon görselleri | Ürün görselleri, bu sırayla; alt metin `_wp_attachment_image_alt` |
| `_product_attributes` (`is_variation=1`) | Seçenek (en çok 3); değerler: genel özellikte terim adları, ürünün kendi özelliğinde `|` ile ayrılmış değerler |
| `_product_attributes` (diğerleri, açıklayıcı) | Mağazanın özellik şablonunda eşleşen alan varsa ürüne yazılır (aşağıda "Açıklayıcı özellikler"); yoksa raporda özellik başına değer listesiyle |
| `product_variation` | Varyant: `attribute_*` → seçenek değerleri, `_sku`, fiyat, stok, ağırlık. Kapalı (özel), fiyatsız ve ana ürünü olmayan varyasyon taşınmaz |
| `_sale_price` (+ tarihleri), `_regular_price`, `_price` | Fiyat: geçerli indirim varsa indirimli fiyat, yoksa normal fiyat (KDV dahil, olduğu gibi). Üstü çizili fiyat taşınmaz |
| `_manage_stock`, `_stock`, `_stock_status` | Stok yönetimi açıksa sayı; "stokta yok" 0; diğerleri bilinmez |
| `_weight` (kg), `_length`/`_width`/`_height` (cm) | Gram ve cm; varyasyonda yoksa ürününki |
| `_global_unique_id` (8–14 rakam) | Barkod |
| `product_tag` | Taşınmaz (raporda dağılım) |
| Ürün yorumu (puanlı) | Yorum: onaylı yayında, bekleyen beklemede; yazar adı "Ayşe Y." biçiminde. E-posta ve IP okunmaz. Fotoğraflar taşınmaz |
| `post` | Blog yazısı: içerik belgesi, özet, yazar (görünen ad), ilk yayın tarihi, kapak görseli, SEO alanları, eski adres `/{slug}/` → `/blog/{tanıtıcı}` |
| `category` | Blog kategorisi (yazının birincil kategorisi), açıklaması ve SEO alanlarıyla (Rank Math terim alanları; yoksa mağazanın şablonları, ürün kategorisindeki gibi); eski adres `/category/{yol}/` |
| `post_tag` | Blog etiketi (yazı başına en çok 50); eski adres `/tag/{slug}/`. Kısa kod artığı ya da 120 karakterden uzun ad taşınmaz |
| `page` | İçerik sayfası; yasal metin, sistem sayfası, ön sayfa, yalnızca tema bileşenli ya da vitrinin ayrılmış yolundaki sayfa yalnızca eski adresiyle (karar için) |
| noindex sayfa ya da yazı | Taslak, robots ayarıyla |
| `nav_menu_item`, `shop_coupon` | Taşınmaz; raporda sayısı (ADR Ek madde 11) |
| `attachment` | Kendisi taşınmaz; ürün ve kapak görseli olarak kullanılanlar indirilir |

- **Kaynak kimliği:** `wordpress:<sitenin alan adı>`. Kayıt anahtarları WordPress kimlikleriyle: `product:2208`, `variation:2210`, `post:812`, `page:24`, `product_cat:mutfak`, `category:rehberler`, `post_tag:bakim`, `comment:4410`.
- **Tekrarsızlık:** bir kez taşınan ürün, yazı ve sayfa yeniden çalıştırmada yazılmaz; aynı tanıtıcılı sayfa ya da yazı sitede zaten varsa (profil betiğinin açtığı Hakkımızda gibi) bulunmuş sayılır, eski adresi ona bağlanır.
- **SEO eklentisi:** terim SEO alanlarını Rank Math terimin kendi meta'sında tutar, dosyada gelir. Yoast terimlerinkini bir seçenekte (`wpseo_taxonomy_meta`) tutar, dışa aktarmaya girmez: Yoast'lı sitede kategoriler mağazanın şablonlarını alır. Terimin robots ayarı taşınmaz (listeleme sayfalarının robots kuralı platformundur).
- **Görseller:** sitenin ortam kütüphanesinden (`/wp-content/uploads/...`) güvenli indirmeyle (iç ağ reddi, 10 MB, tür ve piksel denetimi). Alan adı kısıtı yok, CDN'deki kütüphane de gelir. Yazı gövdesindeki görseller taşınmaz; raporda yazı yazı listelenir.

## Açıklayıcı özellikler

Varyasyon için kullanılmayan özellikler (`pa_renk` gibi genel ya da ürünün kendi `malzeme`'si) şablona yazılır; yeni akış yok, katalog içe aktarmasının kendi sütunları (`Özellik şablonu`, `Özellik: <anahtar>`) kullanılır, denetimi ve yazımı (`upsertProductAttributesWorkflow`) onundur.

- **Eşleme kuralı:** özelliğin kısa adı `pa_` atılarak, yüzde kodlaması çözülerek ve slug kuralıyla alınır (`pa_sap-rengi` → `sap-rengi`). Şablon alanının **anahtarı** (`sap_rengi` → `sap-rengi`) ya da **etiketinin slug'ı** ("Sap Rengi" → `sap-rengi`) buna eşitse eşleşir; önce anahtar. Yalnızca ürün kapsamlı alanlar; varyant alanı seçenektir.
- **Değer:** çoklu seçimde değerler `|` ile, metinde virgülle birleşir; tek seçim, sayı ve evet/hayır tek değer ister. Seçim değeri alanın seçeneklerinden biri olmalı (değeriyle ya da etiketiyle, içe aktarmadaki gibi); seçenek açılmaz. Aynı alanı iki özellik (genel ve ürünün kendisi) karşılıyorsa değerleri birlikte verilir.
- **Şablon:** ürün tek şablon alır: değerlerinden en çoğunu alan ve zorunlu alanlarının hepsini dolduran (eşitlikte tanıtıcı sırası). Zorunlu alanı boş kalacak şablon verilmez; ürün şablonsuz gelir, raporda yazar. Yazılamayan değer ürünü engellemez.
- **Rapor:** Özet'te "Ürün özellikleri" satırı (ürün başına özellik: yazılacak, var olan, atlanacak). Notlar'da: şablonda alanı olmayan özellik, değerleri ve her değerin ürün sayısıyla (en çok 50, en çok kullanılan önce; şablon bundan kurulup taşıma yeniden çalıştırılır); alanın almadığı değerler; yalnızca başka şablonda olan alan; zorunlu alanı boş kalan ürün.
- **Yeniden çalıştırma:** önceki çalıştırmanın taşıdığı ürüne dokunulmaz (değerleri mağazanındır); şablon sonradan kurulursa yalnızca henüz taşınmamış ürünler değer alır.
- **Panel özeti:** işin `result_summary.wordpress` bloğu: `attributes` (kısa ada göre birleşik, `key`, `name`, `products`, `values`; en çok kullanılan önce) ve `not_moved` (`coupons`, `menu_items`, `product_tags`, `blog_comments`, yoksa 0).

## Sınırlar

- XML 50 MB (zip içinde de; zip sınırı büyütmez). Okuma tek seferde, bellekte; 13,8 MB dosya yaklaşık yarım saniye. Daha büyüğü şimdilik taşınamaz (yukarıda, adım 1).
- Katalog içe aktarmasının sınırları geçerli: ürün başına 100 varyant, 3 seçenek, seçenek değeri 100 karakter.
- İçerik belgesinin sınırları: 180.000 karakter ve 4.000 blok; aşan gövde bir blok sınırında kesilir, raporda yazar.
- Yazı başlığı 200, özet 500, yazar adı 120 karakterde kesilir.

## WXR'de olmayanlar

Dışa aktarma dosyası şunları taşımaz; ileride WooCommerce REST API ile "Bağlan" yolu (salt okunur anahtar) bunları alacak:

- Müşteriler (WordPress kullanıcıları ve WooCommerce müşteri adresleri), geçmiş siparişler.
- Kupon kullanımları ve kimlerin kullandığı.
- Mağaza ayarları: ağırlık ve ölçü birimi, para birimi, vergi, kargo bölgeleri.
- Genel özelliklerin etiketleri (`pa_sap-rengi` → "Sap Rengi"): seçenek adı kısa adından üretilir, panelde düzeltilir.
- Menülerin tema konumları.

Şimdilik müşteriler için **Müşteri listesi** kaynağı (WooCommerce > Müşteriler > Dışa aktar, CSV) kullanılır.

## Geliştirme ve test

- Sentetik WXR: `src/lib/migration/sources/wordpress/__tests__/wxr.ts` (değişken ürün, basit, gizli, taslak, çöp, gruplanmış ürün; yazı, sayfalar, yorumlar, serileştirilmiş özellikler, kısa kod dolu açıklama). Gerçek dışa aktarmalar depoya girmez (`docs/gecis/*/kaynak/` git'te yok sayılır).
- HTTP testinde görseller yerel bir sunucudan, sahte sağlayıcı adresi (`SHOPIFY_BASE_URL`, yalnızca geliştirme ve test) üzerinden indirilir.
- Bir dosyanın kuru çalıştırması (yalnızca geliştirme; hiçbir şey uygulanmaz):

  ```sh
  NODE_ENV=development pnpm --filter @qticaret/backend medusa exec ./src/scripts/wordpress-check.ts <dosya.xml> [kategori-tabanı]
  ```

  Çıktı: tür başına sayılar (kategori ve blog kategorisinde `seo_own`/`seo_default`, `attribute` satırı), okunan adres tabanları, kaynağın notlarının nedenlerine göre sayısı, katalog içe aktarmasının ürün satırları, özellikler. Kişi verisi yazmaz.
