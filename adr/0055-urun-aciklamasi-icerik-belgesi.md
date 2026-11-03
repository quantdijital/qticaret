# ADR-0055: Ürün açıklaması içerik belgesi olarak

- **Durum:** Kabul edildi (2026-11-03, kullanıcı onayı)
- **Tarih:** 2026-11-03

## Bağlam

- **Şikâyet (kullanıcı, 2026-11-03):** "wordpressden çektiğimiz ürün açıklamalarında başlık paragraf tablo hiyerarşilerine hiç uymamış."
- **Neden:** `product.description` düz metindir.
  - WordPress kaynağı gövdeyi içerik belgesine çeviren dönüştürücüye (`html.ts`) sahipti, ama ürünlerde belgeyi düzleştiriyordu: başlık satırı, `•` maddeler, `Ad: Değer` tablo satırları.
  - Vitrin açıklamayı paragraflara bölüp basıyordu.
- **Mevcut model:** adr/0019 içerik belgesi (`lib/content/doc.ts`). Sayfa ve yazılar onu kullanır; editörü panelde, HTML'i sunucunun kendi oluşturucusundadır. adr/0019 "ürün açıklaması content'e bağlanır" kısmını uygulamadan bırakmıştı (PROGRESS karar 73).

## Karar

- **Saklama:** ürünün uzun açıklaması bir içerik belgesidir. Ürün uzantısında `description_doc` (JSON, boş olabilir) sütununda durur (`catalog-extension`, `Migration20261103170000`).
  - İzin verilenler: başlık (h2–h4), paragraf, liste, alıntı, tablo; kalın, italik, güvenli bağlantı.
  - Sınırlar sayfa ve yazılarla aynı (20.000 düğüm, 12 derinlik, 200.000 karakter).
  - Görsel ve ürün/kategori kartı **yok**: ürünün görselleri galerisidir, kart canlı kayıt okuması ister. Gelirse `catalog.description_blocks` döner.
- **Düz metin:** `product.description` belgenin düz metni olarak kalır.
  - Meta açıklaması, JSON-LD, akışlar, arama, advisor ve katalog tablosu onu okur.
  - Belge her kaydedildiğinde sunucu yazar (`lib/content/plain.ts` `docPlainText`, `lib/catalog/description.ts`).
  - **Türetme kuralı:**
    - Başlık, paragraf, liste, alıntı ve tablo birer bloktur; bloklar boş satırla ayrılır.
    - Liste maddeleri satır satırdır (iç listenin maddeleri de), işaretsiz.
    - Tablonun her satırı bir satırdır, hücreler " · " ile birleşir.
    - Paragraf içi satır sonu korunur; görsel ve kart metin vermez.
    - En çok 20.000 karakter (katalog tablosunun açıklama hücresi kadar). Blok sınırında kesilir; ilk blok sığmıyorsa kelime sınırında.
- **Belgesiz ürün:** bugünkü gibi davranır. Düz metin açıklama, vitrinde paragraflar.
- **Yazma yolu:** `POST /admin/products/:id/catalog` `description_doc` alır (gövde 1 MB'a kadar). Şema `productDescriptionDoc`; hata anahtarları `content.too_large`, `content.body_invalid`, `catalog.description_blocks`. Kayıt `setProductCatalogWorkflow` ile yapılır:
  - Belge uzantıya yazılır.
  - Düz metin değiştiyse açıklama Medusa'nın `updateProductsWorkflow`'u ile yazılır: kanca ve olaylar (arama, sitemap, SEO önbelleği) çalışır. Her adım geri alınabilir.
  - Kilit katalog kaydıyla aynıdır.
  - Metni olmayan belge ikisini de temizler. `null` belgeyi düşürür, metni korur.
  - Denetim kaydına belgenin kendisi değil özeti (sha256'nın ilk 16 hanesi) girer.
- **Düz metin yazan diğer yollar belgeyi düşürür** (son yazan kazanır):
  - Katalog içe aktarmasında açıklama hücresini değiştiren satır. Değişmeyen satır belgeye dokunmaz; dışa aktar, geri yükle döngüsü belgeyi korur.
  - Onaylanan yapay zekâ açıklama taslağı.
  - Medusa'nın kendi ürün ucu (`POST /admin/products/:id`) `description` yazarsa belge kalır ve vitrin belgeyi göstermeye devam eder. Panel bu ucu açıklama için kullanmaz; dış istemciler açıklamayı katalog ucundan yazar.
- **Okuma:**
  - Panel belgeyi `GET /admin/products/:id/catalog`'dan alır.
  - Store API `fields=+product_extension.description_doc`'u yalnızca ürünün kendi yanıtında verir (sepet satırı üzerinden değil).
  - Vitrin HTML'i `GET /store/products/:id/description`'dan alır: `{ html }`. Belgesiz ürün için `null`; yayında olmayan ya da başka kanalın ürünü 404. 60 sn herkese açık önbellek.
  - HTML adr/0019'un oluşturucusundan (`renderDoc`) çıkar. Saklanan belge oluşturmadan önce yeniden denetlenir.
- **Vitrin:**
  - Tema, içerik sayfasının okuma sütununu paylaşır (`RichText`). Belge varsa HTML'i, yoksa ya da uç hata verirse paragrafları basar.
  - JSON-LD açıklaması backend'in düz metninden gelir; vitrin belgeden JSON-LD üretmez.
- **Panel:**
  - Ürün sayfasında "Genel" kartı ad ve adres alanlarını taşır.
  - Açıklama ayrı kartta, sayfa ve yazıların editörüyle düzenlenir: başlık, liste, alıntı, tablo (ekleme, satır/sütun, silme), kalın, italik, bağlantı. Görsel ve kart düğmeleri ile mağaza belirteçleri bu editörde yok.
  - Belgesiz ürün paragraflarla açılır: boş satır yeni paragraf, tek satır sonu satır kırılımı. Hiçbir şey yazılmadan açılıp kapanırsa değişiklik sayılmaz.
  - Ürün oluşturma sihirbazı düz metin kalır.
- **Geçiş kaynakları:**
  - WordPress ürün gövdesi (yoksa kısa açıklaması) belge olur.
  - Shopify `descriptionHtml` aynı dönüştürücüden belge olur. Dönüştürücü HTML girdisini genel okur; yalnızca WordPress kısa kodları WordPress'te okunur.
  - Akış (Google Merchant) ve paket kaynakları düz metin kalır.
  - Yeni ürünün belgesi katalog içe aktarması ürünü yaptıktan sonra aynı katalog kaydıyla yazılır. Yazılamazsa ürün düz metniyle kalır, raporda `migration.product_description_failed`.
  - Rapor ve iş özeti `counts.product.documents` sayar; raporun Özet'inde "Biçimli açıklamayla gelen ürünler".
- **Açıklamaları yenileme:**
  - WordPress çalıştırmasının `refresh: ["descriptions"]` seçeneği yalnızca önceki çalıştırmaların taşıdığı ürünlerin belgesini ve düz metnini dışa aktarmadan yeniden yazar. Panelde "Yalnız açıklamaları yenile", yalnız uygulama; API'de `refresh=descriptions`.
  - Fiyat, stok, durum, başlık, SEO ve diğer her şey olduğu gibi kalır; başka tür taşınmaz.
  - Sayılar: `updated`, `found` (aynı), `skipped` (taşınmamış ya da gövdesi boş), `failed`, `documents`. Yarıda kalan iş seçeneğiyle yeniden başlar.

## Alternatifler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Belge uzantıda, düz metin türetilmiş** | Bütün düz metin okuyucuları (SEO, akış, arama, tablo) değişmeden çalışır; XSS yüzeyi yok | İki alanın tutarlılığı yazma yollarına bağlı (yukarıdaki kurallar) |
| `description`'a HTML yazmak | Tek alan | Her okuyucu HTML'i temizlemeli; stored XSS; Medusa'nın ve akışların düz metin beklentisi bozulur |
| Belgeyi `content` modülünde ürüne bağlı kayıt olarak tutmak (adr/0019'un ilk önerisi) | Sayfalarla aynı tablo | Yeni bağlantı, yayın durumu ve tanıtıcı anlamsız; ürün kaydıyla birlikte geri alma zorlaşır |
| Vitrinde belgeyi React ile çizmek | Ek istek yok | İkinci oluşturucu (adr/0019 sunucuda çizmeyi şart koşar); bağlantı denetimi iki yerde |

## Sonuçlar

- Yeni sütun: `product_extension.description_doc` (`jsonb null`). Mevcut ürünlerde boştur, davranış değişmez. Önceden düz metinle taşınmış ürünler yenileme seçeneğiyle belgeye çevrilir.
- `catalog-set-product-catalog` iş akışı ürün açıklamasını da yazabilir hâle geldi. Tür ve hediye kartı kuralları `workflows/catalog/kind-rules.ts`'e taşındı (dosya sınırı).
- Yeni hata anahtarları:
  - `catalog.description_blocks`
  - `migration.product_description_failed`
  - `migration.product_gone`
  - `migration.description_refresh_empty`
  - `migration.refresh_wordpress_only`
- `migration.wordpress_description_cut` artık belgenin kesildiğini söyler; düz metnin 20.000'de kesilmesi not edilmez, çünkü belge bütündür.
- **Açık:**
  - Advisor'ın `P-CONT-07` kuralı (gövdede `http://` bağlantı) ürünün düz metnine bakar. Belgedeki bağlantı adresi düz metinde olmadığı için belgeli üründe bu bağlantıyı görmez. Belgeyi `renderDoc` ile advisor'a vermek ayrı iş. `P-CONT-04` (gövdede h1) etkilenmez: belgede h1 yoktur.
  - Medusa'nın kendi ürün ucunun `description` yazması belgeyi düşürmez (yukarıda).
  - Ürün oluşturma sihirbazında editör yok.
