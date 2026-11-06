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

**Yerini Ek 2026-11-06 aldı.** Sahip (2026-11-05): "ürünlerde kısa açıklama yok, önerilmez mi?" → "tamam maddeler şeklinde yap." Kısa açıklama `product_extension.summary` (`text[]`, `Migration20261105230000`) sütununda en çok 5 düz metin madde (maddede ≤ 90 karakter) olarak tutuldu. WooCommerce excerpt'i maddelere bölündü (liste ya da tablo maddeleri; paragraflar cümlelere, sığmazsa ilk cümle; `migration.wordpress_summary_partial`). `summary:backfill` taşınmış 201 ürünü bu maddelerle doldurdu. Panelde satır başına bir alan, vitrinde tikli liste vardı. Yalnız geliştirmede kullanıldı.

## Ek (2026-11-06): Kısa açıklama, yazıldığı gibi

- **Bağlam:** sahip (2026-11-06): "bu kısa açıklamalar madde madde olmasın, normal nasıl ise öyle gösterelim; bu madde madde hoş olmadı." Ardından: "'Kısa açıklama' diye normal açıklama gibi bir alan aç, editör gibi; WordPress'te öyledir." Kısa açıklama mağazanın yazdığı gibi gösterilir: paragraflar, kalın ve italik, satır sonları, bağlantılar; mağaza liste yazdıysa liste. Hiçbir şey maddeye çevrilmez.
- **Saklama:** `product_extension.summary_doc` (`jsonb null`, `Migration20261106093741`). Model ve denetim uzun açıklamanınkiyle aynı (adr/0019 belgesi, `lib/content`), kısa yuvaya göre daraltılmış (`lib/catalog/summary`):
  - Var: paragraf, satır sonu (`hardBreak`), h3 ve h4 başlık, madde ve numaralı liste (iç içe dahil), kalın, italik, bağlantı (mağazanın kendi yolu ya da `https://`).
  - Yok: h2, alıntı, tablo, görsel, ürün ve kategori kartı. Neden: fiyatın üstündeki dar sütunda tablo sıkışır, alıntı kutusu kart gibi durur; görsel uzun açıklamada da yoktur.
  - En çok 1.500 karakter metin (metin düğümlerinin karakterleri; satır sonu ve blok sayılmaz; panelin sayacı da aynısını sayar).
  - Hata anahtarları: `catalog.summary_blocks`, `catalog.summary_link`, `catalog.summary_too_long`; belgenin kendi denetimi `content.body_invalid` ve `content.too_large`.
  - Metni olmayan belge (editörün boş paragrafı) ya da `null` temizler; saklanan değer `null` olur. İsteğe bağlıdır, yayın beklemez.
  - Migration eski `summary` maddelerini tek madde listesine çevirip `summary_doc`'a yazar, sonra `summary` sütununu düşürür. Böylece yazılmış hiçbir şey kaybolmaz.
- **Yazma:** `POST /admin/products/:id/catalog` `summary_doc` alır (`productSummaryDoc`), `setProductCatalogWorkflow` ile yazılır. Denetim kaydında uzun açıklama gibi özetiyle (`summary_doc`: sha256'nın ilk 16 hanesi) görünür; metin kayda girmez.
- **Okuma:**
  - Panel: `GET /admin/products/:id/catalog` → `summary_doc` (yoksa `null`). Saklanan değer okunurken yeniden denetlenir.
  - Store API: `fields=+product_extension.summary_doc` yalnız ürünün kendi yanıtında (sepet satırından değil).
  - Vitrin HTML'i `GET /store/products/:id/description`'dan alır: `{ html, summary_html }`. İkisi de sunucunun `renderDoc`'uyla çizilir.
  - Sözleşme: `ProductPageView.summaryHtml?: string | null` (yazıldığı gibi HTML; yoksa alan yok).
- **Vitrin** (docs/19 §7): ad, alt başlık ve yıldızların altında, fiyatın üstünde; gövde metni boyunda, kart değil. Listeler uzun açıklamanınkiyle aynı stilde. Varken öne çıkan özellik çiplerinin yerini alır; yokken çipler kalır.
  - Atölye: `product/Summary.tsx`. Her genişlikte hep bütün görünür. (İlk sürümde telefonda ~6 satırda "Devamını oku" ile kapanıyordu; sahip 2026-11-06 "ona gerek yok" dedi, kaldırıldı; `ReadMore`'un `limit`/`phoneOnly` seçenekleri de silindi.)
  - Base: uzun açıklamanın `RichText`'i.
- **SEO** (docs/13 §3): belgenin düz metni tek satır olur. Blok, liste maddesi ve satır sonları sırayla gelir; mağazanın açık bıraktığı satırın sonuna nokta eklenir. Kesme kelime sınırındadır (`summaryText`).
  - `{kısa_açıklama}`: önce kısa açıklama (140 karakter, son nokta şablona bırakılır), yoksa alt başlık, yoksa açıklamanın ilk cümleleri.
  - Şablon boş çıkarsa meta açıklama: önce kısa açıklama (155 karakter), yoksa açıklama. OpenGraph ve Twitter aynısını kullanır. `seo_description` yazılmışsa hep o.
  - JSON-LD ve akışlar (Google Merchant dahil): düz metin açıklama boşsa kısa açıklama (kesilmeden).
  - Danışman `P-CONT-09` (bilgi, puanı düşürmez) kısa açıklaması olmayan ürüne ipucudur. Olgu artık metnin karakter sayısıdır; kural ve sürüm (6) aynı kalır.
- **Panel** (docs/06 "Ürün sayfası"): "Kısa açıklama" kendi kartıdır, uzun açıklama kartının hemen altında (WordPress'teki gibi). Uzun açıklamanın editörüdür (`DocumentCard` + `RichEditor`), `short` kipinde:
  - Biçim seçicide Paragraf, Başlık 3, Başlık 4. Kalın, italik, bağlantı, madde ve numaralı liste. Alıntı, tablo, görsel ve kart yok.
  - Bağlantı penceresi yalnız yol ya da https kabul eder. Enter yeni paragraf, Shift+Enter satır sonu.
  - Kısa başlar (`min-h-32`) ve metinle uzar. Altında "120 / 1.500 karakter" sayacı; sınır aşılınca kırmızıya döner.
  - Yer tutucu: "Örn. Ürünü birkaç cümleyle tanıtın: malzeme, ölçü, kullanım."
  - Danışmanın "Alana git"i bu karta gider. Ürün sihirbazında aynı editör, temel bilgilerde açıklamanın altında. "Genel" kartı yine yalnız ad ve adres.
- **Geçiş (WordPress):** excerpt `bodyBlocks` → `summaryFromBlocks` ile yazıldığı gibi `summary_doc` olur (`sources/wordpress/excerpt.ts`, `lib/catalog/summary-fit.ts`). Gövde boşsa excerpt açıklama olmaya da devam eder.
  - Paragraf, liste, kalın, italik ve satır sonu kalır. h2 h3 olur; alıntının içi kalır, çerçevesi gider.
  - Tablo satırları tek paragrafın satırları olur ("Ölçü: 28 cm"). Görsel gider. http bağlantının metni kalır, bağlantısı gider.
  - Bölme ya da kısaltma yok. Yalnız 1.500 karakter sınırında (liste maddesinde ya da kelimede, "…" ile) kesilir. Kesilen ürün raporda `migration.wordpress_summary_cut` ile adlandırılır.
  - Rapor özetinde "Kısa açıklamayla gelen ürünler" sayılır.
  - Açıklamanın özellik okuyucusu kısa açıklamanın belgesini de okur (liste ya da satırlar; "Namlu: 9 cm"). İkisi ayrı okunur, aynı satır bir kez sayılır.
- **Önceden taşınmış ürünler** (`summary:backfill <export.xml> [apply]`): dışa aktarma dosyası komuta verilir. Kurallar (`workflows/migration/summaries.ts`):
  - Mağaza kısa açıklamayı panelde değiştirdiyse (denetim kaydında `POST /admin/products/:id/catalog` ile `summary`/`summary_doc` değişikliği; boşaltmak da sayılır) dokunulmaz.
  - Değiştirmediyse: kısa açıklaması yoksa yazılır. Hâlâ dünkü yapının o excerpt'ten yazdığı madde listesinin aynısıysa yerine excerpt yazıldığı gibi yazılır. Bunu bilmek için 2026-11-05 bölme kuralı yalnız bu komut için dondurulmuş olarak tutulur (`sources/wordpress/legacy-summary.ts`); geçişte kullanılmaz.
  - Başka her şey mağazanındır, kalır.
  - Sayılar: `filled`, `replaced`, `same` (zaten yazıldığı gibi), `kept` (mağazanın), `skipped` (taşınmamış), `empty` (excerpt yok), `failed`, `cut`. Komut önceki `migration.summaries_filled` kayıtlarını (dünkü 201) karşılaştırma için yazar. `kept` ve `cut` ürünlerini adlarıyla listeler.
  - `apply` denetim kaydına `migration.summaries_filled` (`as_written: true`) olarak girer. Tekrar çalıştırmak güvenlidir.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Uzun açıklamanın belgesi, kısa yuvaya daraltılmış** | Tek model, tek denetim, tek oluşturucu; editör aynı; WooCommerce excerpt'i olduğu gibi gelir | Belge düz metinden ağır (sahip biçimi istedi) |
| Düz metin (paragraf ve satır sonu) | Basit | Kalın, bağlantı ve liste kaybolur; "yazıldığı gibi" olmaz |
| HTML sütunu | Excerpt birebir | Her okuyucu temizlemeli; stored XSS |
| `text[]` maddeler (Ek 2026-11-05) | Sınırlar kolay | Sahip istemedi |

- **Açık:** katalog tablosu (dışa/içe aktarma) ve arama dizini kısa açıklamayı taşımaz. Dışa aktarma dosyası elde değilse `summary:backfill` çalışmaz; ürün sayfasında elle yazılır. Dondurulmuş bölme kuralı, `summary:backfill` çalıştıktan sonra silinir.
