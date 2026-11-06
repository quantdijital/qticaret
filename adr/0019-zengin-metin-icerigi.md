# ADR-0019: Zengin metin içeriği (içerik sayfaları, blog, açıklamalar)

- **Durum:** Kabul edildi (2026-10-25, kullanıcı onayı; uygulama F3.16)
- **Tarih:** 2026-10-25

## Bağlam

- **İhtiyaç:** F3.16 içerik sayfaları, blog yazıları ve facet landing metinleri için zengin metin editörü ister. Ürün açıklamaları da biçimli metin taşır.
- **Mevcut:** Admin `@medusajs/ui` kullanır; zengin metin bileşeni yoktur. Medusa ürün açıklamasını düz metin alanında tutar.
- **Riskler:**
  - Zengin metin storefront'ta HTML olarak basılır (stored XSS).
  - JSON-LD ve `description` meta'sı düz metin ister.
  - Advisor (doc 14 §3.8) yapıyı okur: başlık seviyeleri, paragraf uzunluğu, tablo.

## Karar (öneri)

- **Saklama biçimi: belge JSON'u (ProseMirror şeması), HTML değil.**
  - İzinli düğümler: paragraf, başlık (h2–h4), liste, alıntı, tablo, görsel (yalnızca kendi medya kütüphanemizden), bağlantı (http/https ve site içi).
  - Kısa kodlar: ürün ve kategori kartı.
  - Şema dışı düğüm ve işaret kaydedilirken reddedilir (Zod).
- **Editör:** Tiptap 3 (MIT, ProseMirror tabanlı); yalnızca admin paketinde.
- **Çıktı:** Sunucu belgeyi kendi oluşturucumuzla HTML'e çevirir; allowlist dışında etiket ya da öznitelik üretmez. Ayrıca düz metin özeti üretir (meta, JSON-LD, advisor).
  - `sanitize-html` gibi bir temizleyiciye gerek kalmaz: girdi HTML değildir.
- **Ürün açıklaması:** Medusa'nın düz metin alanı korunur. Zengin içerik `content` modülüne bağlanır (ürünle link).

## Alternatifler

| Seçenek                           | Artı                                                | Eksi                                             |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| **Belge JSON + kendi oluşturucu** | XSS yüzeyi yok; yapı advisor'a hazır; tema bağımsız | Editör ve oluşturucu bakım ister                 |
| HTML + sanitize-html              | Basit; her editörle çalışır                         | Temizleyici atlatma riski; yapı analizi zor      |
| Markdown                          | Taşınabilir, basit                                  | Tablo ve kısa kod sınırlı; kullanıcı dostu değil |

## Sonuçlar

- Tiptap paketleri yeni bağımlılıktır (yalnızca admin paketi; exact sürüm, ≥14 gün).
- Geçiş araçları (F14) HTML'i belge JSON'una çeviren bir dönüştürücü ister; çevrilemeyen öğeler rapora düşer.

## Uygulama notu (F3 T13, 2026-10-26)

- **Kod:**
  - Belge, oluşturucu ve okuyucu `src/lib/content` altında (`doc.ts`, `render.ts`, `stats.ts`). Modül `src/modules/content` (`content_entry`, `kind`: page/post).
  - Editör yönetici panelinde (`apps/panel/src/features/content/editor`), Medusa Admin'de değil (adr/0022). Tiptap 3.31.4.
- **İzin listesi:**
  - Kararla aynı: paragraf, h2–h4, liste, alıntı, tablo, görsel, bağlantı, ürün ve kategori kartı. İşaretler yalnızca kalın, italik ve bağlantı.
  - Alıntı ve liste maddesi yalnızca paragraf ve liste; tablo hücresi yalnızca paragraf taşıyor. Editör de aynı şemaya daraltıldı.
- **Sınırlar:** belge şemadan önce yığınla ölçülüyor (20.000 düğüm, 12 derinlik, 200.000 karakter). Birleşimler `type` ayrımlı, böylece doğrulama düğüm sayısıyla doğrusal.
- **Bağlantı:** http(s) ya da site içi yol. `javascript:`, `data:`, `//`, ters eğik çizgi, kontrol ve görünmez biçim karakterleri, `kullanıcı@` içeren adresler reddediliyor.
- **Görsel:** yalnızca medya kütüphanesine yüklenmiş (dosyası olan) kayıtlar. Kayıt görseli "bağlı" işaretliyor, gece süpürmesi silmiyor.
- **Kartlar:** belgede yalnızca id. HTML'e çevrilirken canlı kaydın güncel adı ve url-registry'deki yolu basılıyor; yayında olmayan kart çıkmıyor.
- **Ürün açıklaması:** Kararın "ürün açıklaması content'e bağlanır" kısmı uygulanmadı (PROGRESS karar 73).

## Ek (2026-11-03): blog kategorileri ve etiketleri; kampanya listesi

### Blog kategorileri ve etiketleri

- **Bağlam:** `content_entry` (page|post) sınıflandırmasızdı. İlk müşterinin blogunda 12 kategori ve ~290 etiket var.
- **Model (`content` modülü):**
  - `content_term`: `kind` (category|tag), `name`, `handle` (tür başına tekil), `description` (düz metin, boş olabilir), `rank` (mağazanın sırası; sonra ada göre, Türkçe sıralama).
  - `content_entry_term`: yazı ↔ terim, çift başına bir satır. Kısmi tekil indeks (`term_kind = 'category'`) bir yazıya ikinci kategoriyi veritabanında da engeller.
  - SEO alanları adr/0015 deseniyle: `content_term ↔ seo_meta` bağlantısı, `seo_meta.entity_type` değerlerine `post_category` ve `post_tag` eklendi. Ayrı panel yok; `PUT /admin/seo/post_category/:id` çalışır.
  - Migration'lar: `content` `Migration20261102203606`, `seoMeta` `Migration20261102203620`.
- **Kurallar (workflow, `workflows/content/term-rules.ts`):**
  - Yalnızca yazı (post) terim alır; sayfa için `content.terms_post_only`.
  - En fazla bir kategori; yeni kategori eskisinin yerine geçer. En fazla 50 etiket (`content.tags_too_many`).
  - Yanlış türdeki ya da olmayan terim `content.term_unknown`. Gönderilmeyen alan değerini korur; `null` ve `[]` temizler.
  - Handle addan `toSlug` ile; tür içinde alınmışsa `content.term_handle_taken`.
- **Adresler (docs/13 §2.2):** kategori arşivi `/blog/kategori/<handle>`, etiket arşivi `/blog/etiket/<handle>`. URL stilinden bağımsızdır.
  - `url-registry` türleri `post_category` ve `post_tag`.
  - `/blog/kategori` ve `/blog/etiket` ayrılmış yollar (`RESERVED_PATHS`): bu handle'la yazı açılamaz.
  - Handle değişince eski yol, arşivde canlı yazı varsa 301 için ayrılır; yoksa serbest kalır.
- **Silme hiç engellenmez:** kategorinin yazıları kategorisiz kalır, etiket yazılardan çıkar. SEO alanları da silinir. Arşiv canlı yazı göstermişse yolu 410 verir; göstermemişse serbest kalır ve terim yeniden açılabilir.
- **SEO (`/store/seo/resolve`):**
  - `entity_type` değeri `post_category` ya da `post_tag`.
  - Başlık `post` şablonuyla, `{başlık}` = terim adı.
  - Açıklama terimin kendi metni; yoksa "<ad> yazıları: …" (en yeni 5 canlı yazının başlıkları).
  - Breadcrumb: Blog → terim. `listing` yok (yazıları vitrin listeler).
  - Canlı yazısı olmayan arşiv `noindex,follow`.
- **Sitemap:** `sitemap-blog-N.xml`, yalnızca en az bir canlı yazısı olan, noindex ya da başka canonical işaretli olmayan arşivler. SEO denetiminin beklenen sayısına da eklendi.
- **Store API:** `GET /store/content?kind=post&category=<handle>&tag=<handle>` süzer; ikisi birlikte verilirse kesişim döner. `GET /store/content/terms?kind=` canlı yazısı olan terimleri sayılarıyla döner. Yazı listesi ve okuma `category` ve `tags` taşır.
- **KVKK / dışa aktarma:** kişisel veri yok; envanter ve dışa aktarma değişmez.
- **WordPress kaynağı (F14, kapsam dışı, eşleme notu):**
  - `category` taksonomisi → `kind: category`. WP'de yazı birden çok, iç içe kategori alabilir: Yoast birincil kategorisi (yoksa ilki) kategori olur, diğerleri rapora düşer.
  - `post_tag` → `kind: tag`.
  - Terim slug'ı → `handle` (`toSlug` ile). Eski `/category/<slug>/` ve `/tag/<slug>/` adresleri yeni arşivlere 301 ile eşlenir.
  - Terim açıklaması → `description`. Yoast terim metası (`wpseo_title`, `wpseo_desc`, `wpseo_noindex`) → `seo_meta`.

### Kampanya listesi (`/kampanyalar`)

- **Listeleme motoru:** `GET /store/listings/products` yeni `type=sale&id=sale` alır. Filtreleri, sıralaması ve 30 saniyelik önbelleği öbür listelerle aynı.
- **Ürün tabanı (`workflows/pricing/sale-products.ts`):**
  - Yalnızca aktif fiyat listelerinin fiyatladığı varyantlar taranır; katalog taranmaz.
  - Varyant indirimli sayılırsa: müşteri grubu olmayan herkese açık bağlamda TRY `calculated_amount < original_amount` olmalı. Override listesi ikisini eşitler, bu yüzden sayılmaz.
  - Ayrıca 30 gün kuralı (ADR-0023) varyantı `on_sale` göstermeli. Vitrinin üstü çizili fiyatıyla aynı kural uygulanır: fiyatı artırıp geri indirmek kampanya sayılmaz.
  - Sepette uygulanan promosyonlar (adr/0024) fiyat hesabına girmez, listede de yok.
- **Fiyatlar:** taban herkese açık bağlamda hesaplanır. Satırların fiyatları (sıralama ve fiyat aralığı) alışverişçinin bölgesinden gelir.
- **SEO:**
  - `/store/seo/resolve?path=/kampanyalar` kayıt defterinden önce `entity` döner: `entity_type: "sale"`, `entity_id: "sale"`.
  - Başlık sabit "Kampanyalı ürünler | {mağaza}". JSON-LD `CollectionPage` + `ItemList`. Liste sorgusu (filtre, sıra, sayfa) öbür listelerdeki gibi işlenir.
  - İndirimde ürün yoksa `noindex,follow` olur ve sitemap'e girmez. En az bir ürün varsa `sitemap-site` dosyasına girer.
  - `kampanyalar` kök segmenti ayrılmış.
- **Açık:**
  - Fiyat listesinin başlaması ya da bitmesi resolve önbelleğini düşürmez (en çok 30 sn bayat kalır). Sitemap'i de kirli işaretlemez; değişiklik günlük tam yenilemede girer.
  - Vitrin menü eşlemesi (`workflows/storefront/menu-hrefs.ts`) `/kampanyalar`'ı henüz tanımıyor.

## Ek (2026-11-04): içerik yayımında yalnız başlık istenir

Kullanıcı kararı (2026-11-04): sert engel yalnız sağlayıcı ya da yasa reddettiğinde, müşteri bozuk çıktı göreceğinde ya da para veya güvenlik söz konusu olduğunda kalır. Gerisi ya bildiklerimizden kendiliğinden doldurulur ya da geçer (en çok sessiz bir ipucu).

- **Adres (handle):** Sayfa ve yazıda istenen tek şey başlıktır.
  - Elle yazılan adres, başlık gibi slug'a çevrilir (`Kargo Bilgisi` → `kargo-bilgisi`). Artık `catalog.handle_invalid` ile reddedilmez. Harf içermiyorsa başlığın slug'ı kullanılır.
  - Adres yazılmamışsa ya da silinmişse başlıktan üretilir. Başka bir kayıt kullanıyorsa ilk boş `-2`, `-3`… alınır (en çok 50). Başka kayıt: aynı türden başka girdi, mağazanın kendi yolu (`/blog`) ya da URL kayıt defterinde başka bir kaydın yolu (silinmiş sayfanın 410'u).
  - Elle yazılıp dolu çıkan adres kişinin seçimidir: `seo.path_taken` kalır.
  - Bu kurallar `handleOf`'u kullanan filtre sayfalarında ve blog terimlerinde de geçerli. Ek sonek yalnız sayfa ve yazıda var.
- **Belirteç:** Bilinmeyen `{belirteç}` vitrinde olduğu gibi görüneceği için red kalır. `content.token_unknown` artık hepsini sayar (`values.tokens`).
- **Filtre sayfası özgünlüğü:** Özgünlük %30'un altındaysa yayın artık reddedilmez (`content.landing_not_original` kaldırıldı). Özgünlük yine ölçülür ve saklanır. Panel %30 altını kırmızı gösterir, advisor %40 altında uyarır (L-UNIQ-01). Yayına alıp almamak mağazanın kararı.
- **Değişmeyenler:**
  - Yayımla/yayından kaldır geri alınabilir olduğu için onay penceresi zaten yoktu. Onay yalnız silmede (geri alınamaz) var.
  - Ürünlerin `seo.publish_gate` bayrağı mağazanın kendi seçimi olarak duruyor.
  - Görsel yalnız mağazanın ortam kütüphanesinden gelebilir (güvenlik). Uzunluk sınırları veriyi aklı başında tutmak için duruyor.
- **SEO alanları:** Hepsi isteğe bağlı; aynı başlık ya da açıklama yalnız uyarı. Panel girişleri sunucunun sınırında (başlık 150, açıklama 320, anahtar kelime 100) yazmayı durdurur. Böylece kayıt uzunluk yüzünden hiç reddedilmez.

## Ek (2026-11-05): özgünlüğü düşük filtre sayfası arama dışında

Kullanıcı kararı (2026-11-05): "her şeye bu kadar engel atıp durma". Yayın engeli kalktı (Ek 2026-11-04); mağaza engellenmeden korunur.

- **Kendiliğinden noindex:** Özgünlüğü %30'un altındaki canlı filtre sayfası `noindex,follow` sunulur (ürün bağlantıları izlenir). Sayfanın kendi robots seçimi zaten `noindex,nofollow` ise o kalır. %30 ve üstünde robots değeri sayfanın kendi seçimidir. Kural `lib/content/originality.ts` `landingRobots`'ta, `/store/seo/resolve` sayfanın SEO yükünde uygular (`workflows/seo/payload-content.ts`).
- **Site haritası:** Bu sayfalar öbür noindex sayfalar gibi site haritasına ve SEO denetiminin beklenen sayısına girmez (`workflows/seo/sitemap-build.ts`, `originality >= 30` süzgeci). Danışmanın yinelenen başlık/açıklama karşılaştırmasında da listelenmiş sayılmaz.
- **Eşiği geçince:** Kayıtta özgünlük yeniden ölçülür ve önbellek düşer. Gecelik yeniden ölçümde bir sayfa %30 çizgisini geçerse resolve önbelleği düşer ve site haritası yenilenmek üzere işaretlenir.
- **Panel ve danışman:** L-UNIQ-01 uyarmaya devam eder (docs/14). Sayfanın durumu kartı canlı ve %30 altındaki sayfada tek satırla söyler: sayfa yayında, daha özgün olana kadar arama motorlarına kapalı.

## Ek (2026-11-06): blog yazarları

Yazının serbest metin yazarı (`author_name`) yerine mağazanın yönettiği yazar kaydı (`content_author`, `content_entry.author_id`) ve yazar sayfası `/blog/yazar/{handle}`: adr/0060. `author_name` okunur yedek olarak kalır; eski yazılar `authors:backfill [apply]` ile bağlanır.
