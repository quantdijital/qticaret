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

## Ek (2026-11-05): Kısa açıklama, madde madde

- **Bağlam:** sahip (2026-11-05): "ürünlerde kısa açıklama yok, önerilmez mi?" Ana oturum önerdi; sahip: "tamam maddeler şeklinde yap." WooCommerce'in kısa açıklaması (`excerpt:encoded`) yalnız gövde boşken açıklama oluyordu; mylarte'nin "kısa açıklama + madde listesi" (Toplam boy, Namlu, Kabza, Kilit, Garanti; `docs/gecis/mylarte/envanter.md` §4.6) taşınmıyordu.
- **Saklama:** `product_extension.summary` (`text[] null`, `Migration20261105230000`). Yalnız maddeler; serbest paragraf yok.
  - En çok 5 madde, maddede en çok 90 karakter. Kayıtta her madde kırpılır, iç boşluklar teke iner, boş maddeler atılır (`lib/catalog/summary`).
  - Denetim karakteri ve görünmez karakter (`\p{Cf}`) reddedilir. Boş liste ya da `null` temizler, saklanan değer `null` olur.
  - İsteğe bağlıdır; yayın beklemez.
  - **Neden `text[]`:** Medusa'nın dizgi dizisi türü (`model.array()`). Biçim yok, HTML'e dönüşmez, XSS yüzeyi yok. Belge (`description_doc` gibi `jsonb`) madde listesi için fazla. Medusa'nın `subtitle`'ı zaten alt başlık; ona yüklenmez.
- **Yazma:** `POST /admin/products/:id/catalog` `summary` alır (`productSummary`). Hata anahtarları: `catalog.summary_too_many`, `catalog.summary_too_long`, `catalog.summary_invalid`. Kayıt `setProductCatalogWorkflow` ile, uzantının öteki alanları gibi yapılır. Denetim kaydında maddeler " | " ile tek değer (mağazanın metni, kişi verisi yok). `catalog.product_saved` artık SEO danışmanını da yeniden çalıştırır.
- **Okuma:**
  - Panel `GET /admin/products/:id/catalog`'dan alır: `summary: string[]`, yoksa boş liste.
  - Store API `fields=+product_extension.summary`'yi yalnız ürünün kendi yanıtında verir (sepet satırı üzerinden değil).
  - Sözleşme: `ProductPageView.summary?: string[]`.
- **Vitrin:** ad, alt başlık ve yıldızların altında, fiyatın üstünde. Varken öne çıkan özellik çiplerinin yerini alır; yokken çipler kalır (docs/19 §7). Liste kartları değişmez.
- **SEO** (docs/13 §3): maddeler cümle olur ("A. B. C."), hep bütün madde alınır.
  - `{kısa_açıklama}`: önce maddeler (140 karakter), sonra alt başlık, sonra açıklama.
  - Şablon boş çıkarsa meta açıklama: önce maddeler (155 karakter), sonra açıklama. OpenGraph ve Twitter aynısını kullanır.
  - JSON-LD ve akışlar (Google Merchant dahil): düz metin açıklama boşsa maddeler.
  - Danışman `P-CONT-09` (bilgi, puanı düşürmez): kısa açıklaması olmayan ürüne ipucu. Kural sürümü 6.
- **Panel** (docs/06 "Ürün sayfası"): "Genel" kartında "Öne çıkan özellikler", madde başına bir alan; kartla birlikte kaydedilir. Ürün sihirbazında aynı alan.
- **Geçiş (WordPress):** excerpt artık her üründe kısa açıklama olur; gövde boşsa açıklama olmaya da devam eder (`sources/wordpress/excerpt.ts`).
  - Liste ya da etiket/değer tablosu varsa maddeleri alınır, en çok 5. Yanındaki paragraf yalnız giriş sayılır, alınmaz.
  - Yalnız paragraf varsa satırlar (`<br>`) ve cümleler madde olur. Bu ancak en çok 5 kısa madde çıkıyorsa yapılır; çıkmıyorsa yalnız ilk cümle tek madde olur.
  - 90'ı geçen madde kelime sınırında "…" ile kesilir. Kesilen, atlanan ya da tek cümleye inen ürün raporda `migration.wordpress_summary_partial` notuyla adlandırılır.
  - Rapor özetinde "Kısa açıklamayla gelen ürünler" sayılır (`counts.product.summaries`).
  - Maddeler açıklamanın özellik okuyucusuna da liste olarak girer ("Namlu: 9 cm"). Belgeden ayrı okunur; aynı satır iki kez sayılmaz.
  - Shopify, akış ve paket kaynaklarında kısa açıklama yok.
- **Önceden taşınmış ürünler** (`summary:backfill`): çalıştırma kaynak dosyasını iş bitince siler (içinde müşteri verisi olabilir). Bu yüzden dışa aktarma dosyası komuta verilir:
  - `pnpm --filter @qticaret/backend summary:backfill <export.xml>` yalnız sayar.
  - Sona `apply` eklenince yazar.
  - Yalnız bir çalıştırmanın taşıdığı ve maddesi boş ürünlere yazar; mağazanın kendi maddelerine dokunmaz. Tekrar çalıştırmak güvenlidir.
  - Sayılar: `updated`, `found` (zaten var), `skipped` (taşınmamış), `empty` (dışa aktarmada yok), `failed`, `partial`. Uygulama denetim kaydına `migration.summaries_filled` olarak girer.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **`text[]` maddeler** | Medusa türü, düz metin, sınırları kolay | Paragraf yok (sahip maddeleri seçti) |
| `{ text?, bullets? }` `jsonb` | Paragraf da olur | Sahip istemedi; iki biçimin okuyucusu |
| Küçük içerik belgesi | Kalın, bağlantı | Fazla; HTML oluşturucu ve denetimi gerekir |
| Medusa `subtitle` | Alan hazır | Alt başlık olarak kullanılıyor; tek satır |

- **Açık:** katalog tablosu (dışa/içe aktarma) ve arama dizini kısa açıklamayı taşımaz. Taşınan ürünlerde dışa aktarma dosyası elde değilse `summary:backfill` çalışmaz; ürün sayfasında elle yazılır.
