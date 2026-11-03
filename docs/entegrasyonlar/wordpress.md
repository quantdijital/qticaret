# WordPress + WooCommerce (WXR geçiş kaynağı)

> Karar: ADR-0042 "Ek (2026-11-03): WordPress (WXR) kaynağı". Kod: `apps/backend/src/lib/migration/sources/wordpress/`. Yazma tarafı: `apps/backend/src/workflows/migration/content.ts`, `post-terms.ts`. Testler: `src/lib/migration/sources/wordpress/__tests__/`, `integration-tests/http/migration-wordpress.spec.ts`.

WordPress sitesinin kendi dışa aktarma dosyası (WXR) bir kez okunur: ürün kategorileri, markalar, ürünler ve varyasyonları, görseller, yorumlar, blog yazıları (kategori ve etiketleriyle), içerik sayfaları ve hepsinin eski adresleri. Eklenti, API anahtarı ya da sitede değişiklik gerekmez.

## Mağaza sahibinin yapacakları

1. WordPress yönetiminde **Araçlar > Dışa aktar**, **Tüm içerik**, **Dışa aktarma dosyasını indir**. Dosya `siteadi.WordPress.2026-11-02.xml` gibi bir XML'dir.
   - "Tüm içerik" seçilmeli: ürünler, varyasyonlar ve ortam kütüphanesi (görseller) ayrı seçilirse dosyada birbirlerini bulamazlar.
   - 50 MB'tan büyükse zip'lenip yüklenir (içinde tek `.xml`). Daha büyük sitede içerik türüne göre parça parça dışa aktarılır; aynı siteden gelen her parça aynı kaynaktır, tekrarsızlık korunur.
2. Panelde **Ayarlar > Taşıma**, kaynak **WordPress**, dosyayı seçer.
   - Ürünlerin çoğunda ağırlık ve ölçü yoksa (WooCommerce'te çoğu mağaza girmez) varsayılan paketi verir; vermezse ürünler taslak gelir.
   - Kategori adresleri sitenin kendi bağlantılarından okunur. Raporda yanlış görünürse kategori adres tabanını (ör. `/urun-kategori/`) elle verir.
3. **Kuru çalıştırır**, raporun Notlar sayfasını okur, sonra **uygular** (yeniden doğrulama ister).
4. Eski adresler kartında yasal metinlerin ve sistem sayfalarının eski adreslerine karar verir (ör. `/satis-sozlesmesi/` → `/yasal/mesafeli-satis-sozlesmesi`).

## Eşleme

| WordPress / WooCommerce | Platform |
| --- | --- |
| `product_cat` | Kategori ağacı (üst zinciriyle yol). Açıklama: terimin açıklaması, yoksa Flatsome'un kategori altı bloğu (`cat_meta`), düz metin. Eski adres `{taban}{üst}/{alt}/` |
| `product_brand` (WooCommerce Brands), `pwb-brand`, `yith_product_brand` | Marka, eski adres `{taban}{slug}/` |
| `product` (yayında) | Yayında ürün; gizli (katalog ve aramadan çıkarılmış), taslak, özel, parolalı → taslak. Çöp, gruplanmış ve dış bağlantılı ürün taşınmaz |
| `wp:post_name` | Tanıtıcı (platformun slug kuralıyla); eski adres öğenin `<link>`'i (`/urun/{slug}/`) |
| Ürün içeriği (HTML, Flatsome kısa kodları) | Açıklama, düz paragraflar: başlık satırı, liste maddesi `•`, tablo satırı `Ad: Değer`. Betik, stil, görsel, ürün vitrini kalkar. 20.000 karakter (paragrafta kesilir). İçerik boşsa kısa açıklama |
| `product_cat` sırası | `rank_math_primary_product_cat` (ya da Yoast'ınki) birinci, sonra dosyadaki sıra |
| `rank_math_title`, `rank_math_description`, `rank_math_focus_keyword` (ve Yoast karşılıkları) | SEO başlığı, açıklaması, odak kelimesi (listenin ilki). Değişkenler: bkz. ADR Ek madde 5 |
| `_thumbnail_id`, `_product_image_gallery`, varyasyon görselleri | Ürün görselleri, bu sırayla; alt metin `_wp_attachment_image_alt` |
| `_product_attributes` (`is_variation=1`) | Seçenek (en çok 3); değerler: genel özellikte terim adları, ürünün kendi özelliğinde `|` ile ayrılmış değerler |
| `_product_attributes` (diğerleri) | Taşınmaz; raporda özellik başına ürün ve değer sayısı (özellik şablonu kurulunca yazılabilir) |
| `product_variation` | Varyant: `attribute_*` → seçenek değerleri, `_sku`, fiyat, stok, ağırlık. Kapalı (özel), fiyatsız ve ana ürünü olmayan varyasyon taşınmaz |
| `_sale_price` (+ tarihleri), `_regular_price`, `_price` | Fiyat: geçerli indirim varsa indirimli fiyat, yoksa normal fiyat (KDV dahil, olduğu gibi). Üstü çizili fiyat taşınmaz |
| `_manage_stock`, `_stock`, `_stock_status` | Stok yönetimi açıksa sayı; "stokta yok" 0; diğerleri bilinmez |
| `_weight` (kg), `_length`/`_width`/`_height` (cm) | Gram ve cm; varyasyonda yoksa ürününki |
| `_global_unique_id` (8–14 rakam) | Barkod |
| `product_tag` | Taşınmaz (raporda dağılım) |
| Ürün yorumu (puanlı) | Yorum: onaylı yayında, bekleyen beklemede; yazar adı "Ayşe Y." biçiminde. E-posta ve IP okunmaz. Fotoğraflar taşınmaz |
| `post` | Blog yazısı: içerik belgesi, özet, yazar (görünen ad), ilk yayın tarihi, kapak görseli, SEO alanları, eski adres `/{slug}/` → `/blog/{tanıtıcı}` |
| `category` | Blog kategorisi (yazının birincil kategorisi), açıklaması ve SEO alanlarıyla; eski adres `/category/{yol}/` |
| `post_tag` | Blog etiketi (yazı başına en çok 50); eski adres `/tag/{slug}/`. Kısa kod artığı ya da 120 karakterden uzun ad taşınmaz |
| `page` | İçerik sayfası; yasal metin, sistem sayfası, ön sayfa, yalnızca tema bileşenli ya da vitrinin ayrılmış yolundaki sayfa yalnızca eski adresiyle (karar için) |
| noindex sayfa ya da yazı | Taslak, robots ayarıyla |
| `nav_menu_item`, `shop_coupon` | Taşınmaz; raporda sayısı (ADR Ek madde 11) |
| `attachment` | Kendisi taşınmaz; ürün ve kapak görseli olarak kullanılanlar indirilir |

- **Kaynak kimliği:** `wordpress:<sitenin alan adı>`. Kayıt anahtarları WordPress kimlikleriyle: `product:2208`, `variation:2210`, `post:812`, `page:24`, `product_cat:el-yapimi-caki`, `category:celikler`, `post_tag:n690`, `comment:4410`.
- **Tekrarsızlık:** bir kez taşınan ürün, yazı ve sayfa yeniden çalıştırmada yazılmaz; aynı tanıtıcılı sayfa ya da yazı sitede zaten varsa (profil betiğinin açtığı Hakkımızda gibi) bulunmuş sayılır, eski adresi ona bağlanır.
- **Görseller:** sitenin ortam kütüphanesinden (`/wp-content/uploads/...`) güvenli indirmeyle (iç ağ reddi, 10 MB, tür ve piksel denetimi). Alan adı kısıtı yok, CDN'deki kütüphane de gelir. Yazı gövdesindeki görseller taşınmaz; raporda yazı yazı listelenir.

## Sınırlar

- Dosya 50 MB (zip içinde de). Okuma tek seferde, bellekte; 13,8 MB dosya yaklaşık yarım saniye.
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

  Çıktı: tür başına sayılar, okunan adres tabanları, notların nedenlerine göre sayısı, katalog içe aktarmasının ürün satırları, özellikler. Kişi verisi yazmaz.
