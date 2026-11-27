# Bileşen denetimi (2026-11-15)

> Bütün vitrin bölüm türleri `docs/tema/bilesen-standardi.md`'ye göre denetlendi. Kaynak yalnız kod:
> sözleşme `packages/types/src/store/{layout,section-*}.ts`, backend şeması
> `apps/backend/src/lib/storefront/sections/*.ts` ve `layout-fields.ts`, panel
> `apps/panel/src/features/storefront/editor/{section-panel.tsx,forms/*}`, ayar araması kaydı
> `forms/field-registry.ts` + `forms/shelf-registry.ts`, Türkçe adlar `apps/panel/src/locales/tr.json`,
> tema `packages/themes/atolye/src/sections/*`. Shopify sütunu Dawn ve Horizon depolarının bölüm
> şemalarından (`{% schema %}`) okundu (adresler standardın sonunda); ayar adları kaynaktaki gibidir,
> etiketleri çeviri anahtarı olduğundan yazılmadı.

## 0. Bütün türlere dokunan bulgular

| # | Bulgu | Kanıt |
| --- | --- | --- |
| O1 | **Cihaza göre gösterim ortak değil.** Yalnız `marquee`'de `device` var; diğer bölümler telefonda ya da masaüstünde gizlenemez. | `section-marquee.ts` `device`; `layout-fields.ts` `base`'de yok. Yapıldı (2026-11-15): (b) 1 |
| O2 | **Ayar araması içerik alanlarını bilmiyor.** Kayıt yalnız biçim, yer, kayan yazı, görsel bandı, raf/kaydırma, üst bilgi, `look` ve görünürlüğü tutar; giriş slaytının oto geçiş/süre/nokta/ok, Google puanının alıntı sayısı, kategorilerin ürün sayısı, `limit`, `columns` (benzer ürünler) gibi alanlar aranamaz. | `field-registry.ts` `sectionFields`. Yapıldı (2026-11-15): (a) 1 |
| O3 | **İçerik alanlarında teknik terim yok.** `look`, `marquee`, `scroller`, `banner`, `headerBar` alanlarının `term` anahtarı var; `fields.*`, `slider.*`, `googleRating.*`, `categories.*`, `products.*` alanlarının yok. | `tr.json`. Yapıldı (2026-11-15): (a) 2 |
| O4 | **Kapalı grubun adı iki türlü:** çoğu bölümde "Görünüm ayarları", kayan yazı ve kayan rafta "Diğer ayarlar"; kayan yazının açık "Görünüm" grubu kapalı "Görünüm ayarları" ile karışıyor. | `section-panel.tsx`, `look.title`, `marquee.otherTitle`, `panel.appearance`. Yapıldı (2026-11-15): (a) 3 |
| O5 | **Zemin sözlüğü iki takım:** `look.ground` = `page / well / stage / primary` ("Sayfa / Hafif ton / Koyu / Ana renk"); kayan yazı ve katalog üst bilgisi `stage / primary / light` ("Koyu / Ana renk / Açık"). Aynı açık tonun iki adı ve iki kodu var: Atölye'de ikisi de `--color-paper-2`. | `section-look.ts`, `section-marquee.ts`, `HEADER_MENU_GROUNDS`; `look.css` (`well`), `marquee.css` ve `header-catalog.css` (`light`). Yapıldı (2026-11-15): (b) 5 |
| O6 | **Hız/süre adları karışık:** kayan yazının `speed`'i akış hızı (5 basamak); kaydırma takımının `speed`'i sayfanın bekleme süresi ("Geçiş süresi", terim `interval`, 3 basamak); giriş slaytında aynı kavram `interval` saniye sayısı (5–10). | `section-marquee.ts`, `section-scroller.ts`, `sections/hero-slider.ts` |
| O7 | **Aç/kapat iki biçimde saklanıyor:** kayan yazı ve kaydırma takımı `off/on` adımı; giriş slaytı, üst bilgi, kategoriler, Google puanı `boolean`. Etiketler de karışık: "Gizle/Göster", "Kapalı/Açık", anahtar düğmesi. | sözleşmeler |
| O8 | **Sütun sayısı iki dilde:** ızgara `columns` 3/4/5 sayı ("Satırda ürün"); kaydırma `desktop` `three…six` adım ("Görünen kart (masaüstü)"). Telefon sütunu ızgarada seçilemiyor (hep 2). | `layout.ts` `ShelfColumns`, `section-scroller.ts`, `fields.columnsHint` |
| O9 | **Yükseklik iki takım:** görsel bandı `low / medium / high` ("Alçak / Orta / Yüksek"); giriş slaytı `compact / regular` ("Kısa / Standart"); giriş (`hero`) seçilemez. | `section-banner.ts`, `sections/hero-slider.ts` |
| O10 | **Yazı konumu iki takım:** görsel bandı 9 konum `text_position`; giriş slaytı slayt başına `position` 3 konum; giriş seçilemez. | aynı |
| O11 | **Gizli ikili karar:** art arda duran ürün rafları kendiliğinden sekmeli tek rafa birleşir; kapatan ayar yok. | `atolye/src/sections/plan.ts` `blocksOf`. Yapıldı (2026-11-15): (b) 2 |
| O12 | **Görsel odağı (focal point) hiçbir görselde yok;** telefonda kırpma hep ortadan. | `layout-fields.ts` `image` = `url` + `alt` |
| O13 | **Gelişmiş CSS (adr/0049 §8, E8) yazılmadı;** "Diğer" grubunun gelişmiş katmanı boş. | `custom_css` hiçbir pakette yok |
| O14 | **Panelin söylediğini tema yapmıyor:** duyuru şeridinin 2.–5. satırı kaydediliyor ama vitrinde hiç görünmüyor. | `tr.json` `types.announcement_bar`, `frame/Announcement.tsx` (`const [line] = lines`). Metin yapıldı (2026-11-15): (a) 8; dönme yapıldı (2026-11-15): (b) 6 |

İyi olanlar (korunacak): `look` beş alanı ve "varsayılana dön"; tür başına anlamsız `look` alanının
gizlenmesi (`lookFieldsFor`); görünürlük + başlangıç/bitiş tarihi her gövde bölümünde (`base`);
kayan yazı ve kaydırmada durdur düğmesi, üzerine gelince/odakta durma, azaltılmış harekette çalışmama;
ilk bölümün görseli `eager` + `fetchPriority="high"` (`BandPicture.tsx`, `HeroSlider.tsx`);
tr/en anahtarları eşit (834/834).

## 1. Tür başına denetim

Sütunlar: **Var** = bugünkü ayarlar (grup); **Eksik** = standarda göre; **Grup** = yanlış grupta;
**Ad** = sözlükle çelişen; **Shopify** = Dawn'ın eşdeğer bölümünde olup bizde olmayan dikkat çekici ayar.

### 1.1 `announcement_bar` "Duyuru şeridi" (üst bilgi grubu)

| | |
| --- | --- |
| Var | `lines` 1–5 (İçerik); görünürlük/tarih. **Atölye yalnız ilk satırı çizer** ("Nothing moves on its own", `frame/Announcement.tsx`); panel ise türü "sırayla dönen kısa duyurular" diye anlatıyor ve 5 satır aldırıyor (O14) |
| Eksik | Hareketli aile: satırların dönmesi, süre (`interval`), oto dönme aç/kapat (varsayılan kapalı), oklar, durdurma; satır başına bağlantı; zemin; cihaz; kapatma düğmesi. `look` yok (üst bilgi grubu) |
| Grup | — |
| Ad | Kayan yazının `ground`/`closable`/`device` adları burada da kullanılmalı |
| Shopify | Dawn `announcement-bar`: `auto_rotate` (kapalı), `change_slides_speed` 3–10 sn (5), `color_scheme`, `show_line_separator`, sosyal bağlantılar, ülke/dil seçici; en çok 12 duyuru |

**Ek 2026-11-27 (kaydırıcı):** `mode: rotate` panelde "Kaydırıcı (tek tek döner)"; yeni ayarlar `transition` fade/slide (varsayılan fade, bugünkü) ve `arrows` off/on (varsayılan off), yalnız kaydırıcıda; koyu şeritte satır başına bağlantı `line_links` (satırın yerine göre, null = yalnız yazı; açık şeridin notu `link`'te kalır). Hareket azaltılmışsa kendiliğinden dönmez, oklar elle çalışır; oklar açıkken şerit `aria-roledescription="carousel"`, her satır "n / toplam" adlı slayt.

### 1.2 `hero` "Giriş" — `standard`, `category_list`

| | |
| --- | --- |
| Var | Ortak: `eyebrow`, `heading`, `text`, `links` ≤2, `image` (İçerik). `category_list`: `list` kaynağı, `list_limit` 4–12, `show_count`, `tiles` ≤2, `chips` ≤4, `picks` ≤4, `show_price`, `slides` ≤6 (her biri başlık, yazı, `links` ≤2, görsel, görsel bağlantısı `link`; yazısız slayt yalnız görsel) ve 2+ slaytta giriş slaytının takımı `scroller` (adr/0049 Ek 2026-11-15, "Açılışta slayt"). `look`: dış/iç boşluk, zemin, genişlik (hizalama gizli) |
| Eksik | Medya ailesi: yükseklik, yazı konumu, perde gücü, düğme stili, telefon görseli, görsel odağı. Görsel bandındaki `BANNER_SETTINGS` takımı buraya ortak takım olarak taşınmalı |
| Grup | — |
| Ad | `links` (burada) / `link` + `second_link` (görsel bandı) / `link` (slayt): "düğme" kavramı üç yapıda |
| Shopify | Dawn `image-banner`: `image_height` adapt/small/medium/large, `image_overlay_opacity` 0–100 %, `desktop_content_position` 9 konum, `desktop_content_alignment`, `show_text_box`, `image_behavior` (ambient/fixed/zoom-in), telefonda `stack_images_on_mobile` ve `show_text_below` |

### 1.3 `hero_slider` "Giriş slaytı"

| | |
| --- | --- |
| Var | `slides` 2–6 (görsel, telefon görseli, başlık, metin, `link`, `position` sol/orta/sağ, `tone`); "Seçenekler" alt başlığında `height` compact/regular, `autoplay`, `interval` 5–10 sn, `dots`, `arrows` (hepsi İçerik içinde) |
| Eksik | Kaydırma takımının ok biçimi, okların yeri, üzerine gelince oklar, döngü; üzerine gelince durma ayarı (bugün hep durur, ayar değil); perde gücü; 9 konum; düğme stili; ikinci düğme |
| Grup | Oto geçiş/süre/nokta/ok İçerik grubunda; standarda göre açık "Kaydırma" grubunda olmalı |
| Ad | O6 (`interval` sayı), O7 (`boolean`), O9 (`compact/regular`), O10 (`position`). Kaydırma takımına bağlanmalı |
| Shopify | Dawn `slideshow`: `layout` full_bleed/grid, `slide_height` adapt_image/small/medium/large, `slider_visual` dots/counter/numbers, `auto_rotate`, `change_slides_speed` 3–9 sn, `show_text_below`, `accessibility_info`; slayt başına `image_overlay_opacity`, `box_align`, `text_alignment`. Horizon: ok `icons_style` (arrow/chevron/…/none) + `icons_shape` (none/circle/square), `slideshow_controls_style` none/dots/counter |

### 1.4 `banner` "Görsel bant" (eski adı "Görsel slayt")

| | |
| --- | --- |
| Var | `slides` 1–6 (görsel, telefon görseli, başlık, metin, `link`, `second_link`, `tone`); `width` boxed/full, `height` low/medium/high, `text_position` 9, `overlay` none/light/medium/strong, `button_style` solid/outline/text; `look` (genişlik hariç) |
| Eksik | Görsel odağı; yan yana kaç görsel (bugün sayıdan çıkıyor); telefonda alt alta mı kaydırarak mı |
| Grup | **Bütün ayarlar kapalı "Görünüm ayarları"nda.** Yükseklik, yazının yeri ve perde temel ayardır: açık "Diziliş" grubuna çıkmalı; `width` `look.width` ile birleşmeli |
| Ad | **Tür adı yanıltıcı:** "Görsel slayt" kaymaz, yan yana durur; "Giriş slaytı" ile karışır. Öneri: "Görsel bandı" |
| Shopify | Dawn `image-banner` (iki görsel yan yana alabilir): 1.2'deki takım + `stack_images_on_mobile`; perde yüzde, yükseklikte `adapt` (görsele göre) |

### 1.5 `categories` "Kategoriler" — `tiles`, `linked`, `collage`

| | |
| --- | --- |
| Var | `title`, `category_ids` ≤24 (boş: üst kategoriler), `show_count`, `more` (İçerik); `look` tam. Sonradan (adr/0049 Ek 2026-11-15): `linked` (alt kategorili kart: `columns`, `columns_mobile`, `image_position`, `frame`, `links`) ve `collage` (fotoğraflı kolaj: `lead`, `columns`, `columns_mobile`, `height`, `links`) biçimleri |
| Eksik | Liste/ızgara ailesi: sütun sayısı (masaüstü/telefon), adet sınırı, biçim (ızgara/kayan; kaydırma takımı), görsel oranı, kart biçimi (görsel üstte/yanında) |
| Grup | — |
| Ad | `show_count` etiketi `heroCatalog.showCount`'tan ödünç (doğru ama anahtar ailesi dağınık) |
| Shopify | Dawn `collection-list`: `columns_desktop` 1–6 (3), `columns_mobile` 1/2 (1), `swipe_on_mobile`, `image_ratio` adapt/portrait/square, `show_view_all`, `heading_size` |

### 1.6 `products` "Ürün listesi" — `grid`, `carousel`, `featured`, `compact`, `columns`

| | |
| --- | --- |
| Var | İçerik: `title`, `source` (6 tür), `limit` (grid/carousel), `more`, `lists` (columns). Açık "Diziliş": biçim, `columns` 3/4/5 (grid), `rows` 2/3 (compact), `per_list` 3/4 (columns), `card_variant`. Açık "Kaydırma" (carousel): `desktop`, `mobile`, `arrows`, `arrow_style`, `arrow_position`. Kapalı "Diğer ayarlar": `dots`, `autoplay`, `speed`, `loop`, `drag` + `look` |
| Eksik | Telefon sütunu (grid); komşu raflarla sekmeye birleşme ayarı (O11); boş durumda "en yenilerle doldur" seçeneği yalnız çok satanlarda kendiliğinden |
| Grup | Doğru: standardın örnek uygulaması |
| Ad | O8 (`columns` sayı / `desktop` adım); kaydırmanın `speed`'i aslında süre (O6) |
| Shopify | Dawn `featured-collection`: `columns_mobile` 1/2, `swipe_on_mobile`, `enable_desktop_slider`, `view_all_style` link/outline/solid, `image_ratio`, `show_secondary_image`, `quick_add` (bizde kart ayarları tema genelinde). Horizon `product-list`: `layout_type` grid/carousel/editorial, `carousel_on_mobile`, `mobile_columns`, `columns_gap`/`rows_gap` |

### 1.7 `featured_product` "Öne çıkan ürün"

| | |
| --- | --- |
| Var | `product_id`, `title`, `text` (İçerik); `gallery` **collage**/strips (Diziliş, 2026-11-15); `look` tam |
| Eksik | Görselin yeri (sol/sağ), görsel boyu, gösterilecek parçalar (fiyat, puan, özellik tablosu, sepete ekle) aç/kapat |
| Grup | "Diziliş" (fotoğraf düzeni) |
| Ad | "Fotoğraf düzeni <small>gallery</small>": Kolaj / Çapraz şeritler |
| Shopify | Dawn `featured-product`: `media_size` small/medium/large, `media_position` left/right, `media_fit`, `image_zoom` lightbox/hover/none, `hide_variants`, `secondary_background`; parçalar blok (başlık, fiyat, seçenek, satın al, puan, paylaş…) |

### 1.8 `brands` "Markalar"

| | |
| --- | --- |
| Var | `title`, `brand_ids` ≤24 (boş: hepsi) (İçerik); `look` tam |
| Eksik | Liste/ızgara ailesi tamamen: sütun, adet, biçim (ızgara/kayan), logo boyu, gri tonlama, "tümünü gör" bağlantısı |
| Grup | — |
| Ad | — |
| Shopify | Dawn'ın bölüm listesinde karşılığı yok |

### 1.9 `posts` "Blog yazıları" ve `reviews` "Müşteri yorumları"

| | |
| --- | --- |
| Var | `title`, `limit` (posts 1–6, reviews 1–12) (İçerik); `look` tam |
| Eksik | Sütun sayısı, biçim (ızgara/kayan), "tümünü gör" bağlantısı; posts: görsel, tarih, özet aç/kapat; reviews: en düşük yıldız, fotoğraflı yorum şeridi aç/kapat (bugün kendiliğinden) |
| Grup | — |
| Ad | — |
| Shopify | Dawn `featured-blog`: `post_limit` 2–4, `columns_desktop` 1–4, `show_view_all`, `show_image`, `show_date`, `show_author`. Yorum bölümü Dawn'ın bölüm listesinde yok |

### 1.10 `google_rating` "Google puanı" (2026-11-27 kaldırıldı, adr/0058)

| | |
| --- | --- |
| Var | `title`, `excerpts` 0–3 (anahtar + sayı), `profile_link` (İçerik); `look` tam |
| Eksik | Hizalama `look`'ta var; rozet boyu yok (gerek yok sayılabilir) |
| Grup | — |
| Ad | `excerpts` aramada yok (O2) |
| Shopify | Dawn'ın bölüm listesinde karşılığı yok |

### 1.11 `rich_text` "Metin"

| | |
| --- | --- |
| Var | `title`, `body` (biçimli belge) (İçerik); `look` (zeminde "Ana renk" yok: uzun metin) |
| Eksik | Başlık boyu; düğme (metinden ayrı) |
| Grup | — |
| Ad | Başlık ipucu `fields.titleOptional` ("boşsa görünmez"), diğerleri `titleHint` ("boşsa vitrin kendi başlığını kullanır"): bilinçli fark, panelde açıkça yazıyor |
| Shopify | Dawn `rich-text`: `desktop_content_position`, `content_alignment`, `full_width`; bloklar başlık (≤3), üst yazı, metin, düğme (≤2), başlıkta `heading_size` |

### 1.12 `trust_badges` "Güven rozetleri" — `strip`, `lined`

| | |
| --- | --- |
| Var | Biçim; rozetler tema genelinde tek liste (her şeridin formundan düzenlenir); `look` (hizalama gizli) |
| Eksik | Telefonda kaydırma mı alt alta mı; sütun sayısı |
| Grup | — |
| Ad | Kart başlığı "Güven rozetleri", Tezgâh açıklamasında "güvence şeridi": tek ad seçilmeli |
| Shopify | Dawn `multicolumn` eşdeğeri: `columns_desktop` 1–6, `columns_mobile` 1/2, `swipe_on_mobile`, `column_alignment`, `background_style`, `image_width`, `image_ratio` |

### 1.13 `newsletter` "E-bülten" ve `help` "Yardım kutusu" (+ alt bilgi e-bülteni)

| | |
| --- | --- |
| Var | `title`, `text` (İçerik); gövdede `look` tam, alt bilgide yok |
| Eksik | Form ailesi: düğme yazısı, onay metni bağlantısı (KVKK) görünürlüğü, başarı mesajı; help: hangi iletişim yolları gösterilsin |
| Grup | — |
| Ad | — |
| Shopify | Dawn `newsletter`: yalnız `full_width` ve renk şeması; başlık, paragraf ve form blok olarak sıralanır. Dikkat çekici ek ayar yok |

### 1.14 `faq` "Sık sorulan sorular"

| | |
| --- | --- |
| Var | `title`, `items` 1–12 (İçerik); `look` (zeminde "Ana renk" yok) |
| Eksik | İlk soru açık gelsin; aynı anda tek soru açık; simge (artı/ok) |
| Grup | — |
| Ad | — |
| Shopify | Dawn `collapsible-content`: `open_first_collapsible_row`, `layout` none/row/section, yan görsel + `desktop_layout`, satır başına `icon` |

### 1.15 `related_products` "Benzer ürünler" (ürün sayfası)

| | |
| --- | --- |
| Var | `title`, `source` (aynı kategori / koleksiyon / elle), `limit` 1–12, `columns` 3/4/5 (İçerik); `look` tam |
| Eksik | `products`'ın biçimleri (en az `carousel` + kaydırma takımı), `card_variant`, telefon sütunu |
| Grup | `columns` İçerik'te; `products`'ta açık "Diziliş"te: aynı alan iki yerde |
| Ad | — |
| Shopify | Dawn `related-products`: `products_to_show` 2–10, `columns_desktop` 1–6, `columns_mobile` 1/2, `image_ratio`, `show_secondary_image`, `show_vendor`, `show_rating` |

### 1.16 `marquee` "Kayan yazı"

| | |
| --- | --- |
| Var | `items` 1–8 (İçerik); açık "Hareket": `speed` 5, `direction`, `hover_pause`, `pause_button` always/hover; açık "Görünüm": `size`, `ground`, `separator`, `weight`, `uppercase`, `gap`, `outline`; kapalı "Diğer ayarlar": `device`, `closable` + `look` (dış boşluk, genişlik) |
| Eksik | — (hareketli ailenin örnek uygulaması) |
| Grup | `device` standarda göre ortak "Görünürlük" grubuna taşınmalı (O1). Yapıldı (2026-11-15): (b) 1 |
| Ad | O4 ("Görünüm" / "Görünüm ayarları"), O5 (`light`) |
| Shopify | Dawn'da yok. Horizon `marquee`: yalnız yön, zemin rengi, üst/alt boşluk ve ögeler arası boşluk; hız kodda sabit, üzerine gelince durma ayarı yok. Bizimki daha geniş |

### 1.17 `price_bands` "Fiyat bantları"

| | |
| --- | --- |
| Var | `title`, `bands` 2–4 (etiket, satır, üst sınır), `thumbs` 0–4 (İçerik); `look` tam |
| Eksik | Telefonda alt alta mı kaydırarak mı |
| Grup | — |
| Ad | `thumbs` "küçük görsel" aramada yok (O2) |
| Shopify | Dawn'ın bölüm listesinde karşılığı yok |

### 1.18 `header_bar` "Üst bilgi" — `standard`, `centered`, `catalog`

| | |
| --- | --- |
| Var | Biçim; `sticky`, `search_style` (her biçimde İçerik; arama kutu ya da basınca açılan simge: **field**/icon → Kutu/Simge, basınca açılır, adr/0049 Ek 2026-11-15), `menu_images` (her biçimde İçerik; menülerde kategori resimleri: all/**submenus**/off → Her yerde/Alt menülerde/Yok; varsayılan bugünkü çizim, adr/0049 Ek 2026-11-15). `catalog`: İçerik'te `search_placeholder`, `utility_bar`, `phone`, `categories_button` (ardından `menu_images`), `menu_ground`, `highlight_link`; kapalı "Diğer ayarlar"da `search_label`, `account_text`, `cart_total` |
| Eksik | Yapışkanlık basamakları (her zaman / yukarı kaydırınca / hiç); logo boyu; telefonda logo yeri; alt çizgi; menü türü (açılır / mega / çekmece) |
| Grup | — |
| Ad | `sticky` hem tema ayarı `header.sticky` hem bölüm ayarı; `centered` biçimi tema ayarı `header.layout`'tan okunuyor: iki doğruluk kaynağı. O5 (`menu_ground`) |
| Shopify | Dawn `header`: `logo_position` 4 konum, `mobile_logo_position`, `menu_type_desktop` dropdown/mega/drawer, `sticky_header_type` none/on-scroll-up/always/reduce-logo-size (varsayılan on-scroll-up), `show_line_separator`, `menu_color_scheme`, `margin_bottom` |

### 1.19 `footer_bar`, `product_main`, `category_main`

| | |
| --- | --- |
| Var | Biçim (tek seçenek), ana ürün/kategoride `look` (dış boşluk, genişlik); form yok |
| Eksik | Alt bilgi: sütunlar, e-bülten, ödeme işaretleri, sosyal bağlantılar aç/kapat. Ürün: galeri düzeni, görsel boyu, küçük resim yeri, yapışkan bilgi sütunu. Kategori: sayfa başına ürün, sütun (masaüstü/telefon), filtre yeri, sıralama aç/kapat (`by_variant` boş duruyor) |
| Grup | — |
| Ad | — |
| Shopify | `main-collection-product-grid`: `products_per_page` 8–36, `columns_desktop` 1–6, `columns_mobile` 1/2, `enable_filtering`, `filter_type` horizontal/vertical/drawer, `enable_sorting`. `main-product`: `enable_sticky_info`, `media_size`, `gallery_layout` stacked/columns/thumbnail/thumbnail_slider, `mobile_thumbnails`, `media_position`, `media_fit`. `footer`: `newsletter_enable`, `show_social`, `payment_enable`, `show_policy`, ülke/dil seçici, bloklar (bağlantı listesi, marka bilgisi, metin, görsel) |

### 1.20 Çerçevedeki yüzen öğe: WhatsApp düğmesi (bölüm değil)

| | |
| --- | --- |
| Var | Yalnız mağaza bilgilerindeki numara (`whatsapp`; boşsa yok). Çakışma kuralları temada iyi: alt çubuğun üstüne çıkar, çekmece açıkken ve sabit satın alma çubuğu varken gizlenir, aşağı kaydırırken çekilir (`frame/WhatsApp.tsx`, `frame.css`) |
| Eksik | Yüzen aile: taraf (sağ/sol), cihaz, hangi sayfalarda (ör. ürün sayfasında kapalı), numara dururken kapatma anahtarı |
| Grup | Panelde bölüm değil, mağaza bilgisi: tema düzenleyicide bulunamaz |
| Ad | — |
| Shopify | Dawn'ın bölüm listesinde karşılığı yok |

## 2. Öncelikli iş listesi

Kapsamda geçen kısaltmalar: **T** = `packages/types/src/store/…`, **B** = `apps/backend/src/lib/storefront/sections/…`
(+ ayna eşitlik testi), **P** = `apps/panel/src/features/storefront/editor/…`, **İ** = `apps/panel/src/locales/{tr,en}.json`,
**A** = `packages/themes/atolye/src/…`.

### (a) Küçük, hemen yapılabilir (S; migration yok)

> Sekiz maddenin hepsi yapıldı (2026-11-15, `oguzhan/denetim-kucuk-isler`). Sözleşme ve kayıt
> biçimi değişmedi; yalnız panel düzenleyicisi ve çeviri. Kodla uyuşmayan dayanaklar maddenin
> altında yazılı.

1. **İçerik alanlarını ayar aramasına kaydet (O2).** `sectionFields`'a giriş slaytı seçenekleri, `limit`, `columns`, `show_count`, `excerpts`, `profile_link`, `thumbs`, `list_limit`, `show_price` eklenir; formlar kimliği `FIELD_IDS`'ten alır. P `forms/field-registry.ts`, ilgili formlar, `theme-editor-search.spec.tsx`.
   **Yapıldı (2026-11-15).** Kayıt `forms/content-registry.ts`'de (`field-registry.ts` 300 satırı geçmesin diye ayrı,
   `shelf-registry.ts` deseni); kimlikler `FIELD_IDS.content`. Alanlar formun o anki hâlini izler (süre
   yalnız oto geçiş açıkken, alıntı ve görsel sayısı yalnız anahtarı açıkken). `categories.show_count`
   kendi anahtarına (`categories.showCount`) kavuştu (1.5 "Ad").
2. **Eksik teknik terimleri ekle (O3).** `fields.limit/columns/title`, `slider.*`, `googleRating.*`, `categories.*`, `products.*` için `term` anahtarı ve formlarda `<small>`. İ, P `forms/fields.tsx`.
   **Yapıldı (2026-11-15).** Terim anahtarı düz ad yanında `<ad>Term` (`fields.limitTerm`). Terim etiketin dışında
   çizilir (`Field`'in yeni `term` özelliği, `admin-ui`): alanın erişilebilir adı Türkçe etiket kalır.
   Ek olarak `products.days/more`, `categories.more`, `related.source`, `heroCatalog.*`, `priceBands.thumbs*`.
3. **Kapalı grubun adını tekle (O4):** her bölümde "Diğer ayarlar"; kayan yazının açık "Görünüm"ü "Stil" olur. İ `look.title*`, `panel.appearance`; P `section-panel.tsx`.
   **Yapıldı (2026-11-15).** Kodda "Diğer ayarlar" zaten `marquee.otherTitle` olarak vardı; anahtar `look.title`'a
   toplandı, `marquee.otherTitle*` kalktı (üst bilgi kataloğunun kapalı grubu da). Arama sonucundaki grup
   adları da aynı anahtardan; "Diziliş" ve "Kaydırma" `shelf.*`'tan `panel.layout/scroll`'a taşındı.
4. **Görsel bandının temel ayarlarını aç (1.4):** yükseklik, yazının yeri, perde açık "Diziliş"e; düğme stili ve genişlik kapalıda kalır. P `section-panel.tsx`, `forms/banner-settings.tsx`, `field-registry.ts` (grup `layout`).
   **Yapıldı (2026-11-15).** Gruplar `forms/banner-groups.ts`'de; açık grup `forms/layout-group.tsx`. "Diğer ayarlar"
   sayacı yalnız kapalıda kalan iki ayarı sayar. `width`'in `look.width` ile birleşmesi sözleşme işi: (c) 1.
5. **Tür adını düzelt:** "Görsel slayt" → **"Görsel bant"** (sahibin kararı; "Görsel bandı" değil;
   yalnız i18n, tür anahtarı `banner` aynı). İ `types.banner`.
   **Yapıldı (2026-11-15).** İngilizcesi "Image band".
6. **Benzer ürünlerde `columns`'u "Diziliş"e taşı (1.15).** P `related-form.tsx`, `section-panel.tsx`.
   **Yapıldı (2026-11-15).** Açık "Diziliş" grubunda (`forms/layout-group.tsx`), aramada grup `layout`.
7. **Etiket tekliği (O7 görünen yüz):** iki adımlı aç/kapat her yerde anahtar düğmesi, basamak adları "Kapalı / Açık" ("Gizle / Göster" kalkar). İ `scroller.dots.*`; P `scroller-fields.tsx`.
   **Yapıldı (2026-11-15).** Kodda noktalar zaten anahtar düğmesiydi (`scroller-fields.tsx` `isSwitch`); "Gizle / Göster"
   yalnız basamak adında (aramada) kalmıştı: "Kapalı / Açık" oldu, etiket "Noktaları göster". Kayan
   yazının dört anahtarının basamak adı hiç yoktu (arama eksik anahtara bakıyordu): eklendi. Giriş
   slaytının "Kendiliğinden geçsin"i kaydırmadaki adla "Otomatik geçiş" oldu (bir kavram, bir ad).

8. **Duyuru şeridinin metnini gerçeğe uydur (O14):** dönme gelene kadar açıklama ve ipucu "ilk satır
   gösterilir" der ya da satır sınırı 1'e iner (kayıtlı fazla satır okunur, yalnız ilki çizilir). İ
   `types.announcement_bar`, `announcement.hint`; asıl çözüm (b) 6.
   **Yapıldı (2026-11-15).** Kod doğrulandı: Atölye yalnız ilk satırı çizer (`frame/Announcement.tsx`,
   `const [line] = lines`). Açıklama "vitrin ilk duyuruyu gösterir", ipucu "şimdilik yalnız ilk satır;
   diğerleri saklanır" diyor; satır sınırı 5'te kaldı (davranış değişmedi).

### (b) Orta (M; sözleşme + backend + panel + tema, migration yok, okumada varsayılan)

1. **Ortak `device` (O1):** `base`'e `device: all/mobile/desktop` (varsayılan `all`), panelde "Görünürlük" grubunda; kayan yazının `device`'ı buraya taşınır (eski alan okunur). T `layout.ts`, B `layout-fields.ts`, `marquee.ts`, P `schedule-fields.tsx`, `field-registry.ts`, A her bölüm sarmalayıcısı (`Look.tsx`) + CSS.
   **Yapıldı (2026-11-15).** Alan `base` yerine `bodyFields`'ta (duyuru şeridi ve alt bilgi kutusunu tema
   gizleyemiyor) ve üst bilgideki kayan yazıda; sözleşme `section-device.ts`, panel kaydı
   `forms/visibility-registry.ts`. Vitrin `data-show-on` + CSS (64rem); tembel görseller gizli cihazda
   indirilmez, ilk bölümün öncelikli görseli indirilir (adr/0049 Ek 2026-11-15, orta işler).
2. **Raf sekmesi ayarı (O11):** `products`'a `tabs: on/off` (varsayılan `on`, bugünkü davranış). T `section-shelf.ts`, B `products.ts`, P `shelf-groups.tsx`, A `plan.ts`.
   **Yapıldı (2026-11-15):** basamaklar `auto`/`off` (varsayılan `auto`: art arda raflar birleşir); `off` rafı ayrı çizer. Panelde "Diziliş"te anahtar düğmesi, `columns` biçiminde yok; ipucu birleştiği rafın adını söyler (adr/0049 Ek 2026-11-15, orta işler).
3. **Telefon sütunu (O8):** ızgaraya `columns_mobile` 1/2 (varsayılan 2); `related_products` ve `categories`'e de. T `layout.ts`, B `layout-fields.ts`, P `columns-field.tsx`, A `ShelfRack.tsx`, `Aisles.tsx`.
   **Yapıldı (2026-11-15):** `columns_mobile` 1/2 ürün rafı ızgarasında ve benzer ürünlerde (varsayılan 2),
   kategori kartlarının `linked` biçiminde (varsayılan 1). Görsel kutular telefonda yana kaydığı, markalar
   çip olarak aktığı için bu ayarı almadı (adr/0049 Ek 2026-11-15, orta işler).
4. **Giriş slaytını kaydırma takımına bağla (1.3, O6, O7, O9):** `autoplay/dots/arrows` boolean'ları ve `interval` sayısı okumada takım adımlarına eşlenir (`interval` 5→fast, 6–7→medium, 8–10→slow), panel takımın alanlarını gösterir. T `layout.ts`, B `hero-slider.ts`, P `hero-slider-form.tsx`, A `SliderStage.tsx`, `SliderControls.tsx`.
   **Yapıldı (2026-11-15):** slayt takımın altı ayarını alır (`autoplay`, `speed`, `loop`, `arrows`, `arrow_style`, `dots`; varsayılanlar bugünkü çizim: döngü, noktalar ve yuvarlak oklar açık); süre basamakları slaydın kendi 8/6/5 sn'si, basamağa denk gelmeyen eski saniye (7, 9, 10) basamak değişene dek aynen çalar. Panelde açık "Kaydırma" grubu, döngü "Diğer ayarlar"da. Yükseklik (O9) ve yazı konumu (O10) medya takımına ((c) 1) kaldı (adr/0049 Ek 2026-11-15, orta işler).
5. **Zemin sözlüğünü tekle (O5):** `light` ile `well` tek ada iner; okumada eşleme. T `section-look.ts`, `section-marquee.ts`, `section-variants.ts`; B aynaları; İ; A `marquee.css`, `header-catalog.css`.
   **Yapıldı (2026-11-15):** kayan yazı ve menü çubuğu zemini `stage`/`primary`/`well`; kayıtlı `light` okumada ve yazmada `well` olur (göç yok, aynı renk), panelde tek etiket "Hafif ton" (adr/0049 Ek 2026-11-15, orta işler).
6. **Duyuru şeridine hareketli aile (1.1):** oto dönme, süre, oklar, durdurma, satır bağlantısı, kapatma. T `layout.ts`, B `announcement-bar.ts`, P `announcement-form.tsx`, A `frame/Announcement.tsx`.
   **Kısmen yapıldı (2026-11-15):** birden çok duyuru (yalnız ilki / sırayla / yan yana), süre, durdur düğmesi, üzerine gelince dur, azaltılmış harekette durma (adr/0049 Ek 2026-11-15, orta işler). Oklar, satır bağlantısı, kapatma ve zemin açık.
7. **Benzer ürünlere biçim + kart biçimi (1.15).** T `layout.ts`, B `related-products.ts`, P `related-form.tsx`, A ürün sayfası rafı.
   **Yapıldı (2026-11-15):** biçim Izgara / Kayan sıra (kayan sırada ortak kaydırma takımı) ve rafın kart
   biçimi seçimi; telefon sütunu (b) 3'te (adr/0049 Ek 2026-11-15, orta işler).
8. **SSS ayarları (1.14):** ilk soru açık, tek açık. B `faq.ts`, P `faq-form.tsx`, A `Faq.tsx`.
   **Yapıldı (2026-11-15):** `open_first` ve `single_open` off/on (ikisi de kapalı); tek açık yerel
   `<details name>` ile, betiksiz (adr/0049 Ek 2026-11-15, orta işler).

### (c) Büyük (L; ADR eki gerekir)

1. **Medya takımı (1.2, 1.3, 1.4, O9, O10, O12):** `BANNER_SETTINGS`'i ortak `media` takımına çevirmek (yükseklik, yazı konumu 9, perde, düğme stili, odak noktası) ve `hero`, `hero_slider`, `banner`'a bağlamak; odak noktası görsel kaydına girer. T yeni `section-media.ts`, B `banner.ts`, `hero.ts`, `hero-slider.ts`, `layout-fields.ts` `image`; P görsel seçicide odak; A `BandPicture.tsx`, `Hero.tsx`, `HeroSlider.tsx`.
2. **Liste ailesini kaydırma takımıyla genişletmek (1.5, 1.8, 1.9):** `categories`, `brands`, `posts`, `reviews`'a `variant` grid/carousel + `scroller` + sütun. T `section-variants.ts`, B ilgili şemalar, P formlar, A `Aisles.tsx`, `Brands.tsx`, `Guides.tsx`, `Reviews.tsx`.
3. **Ana bölümlerin ayarları (1.19):** kategori ızgarası `by_variant` (sayfa başına, sütunlar, filtre yeri), ürün galerisi, alt bilgi sütunları. adr/0049 §7 ile birlikte.
4. **Üst bilgi yapışkanlık basamakları ve tek doğruluk kaynağı (1.18):** `sticky` → `always/scroll_up/off`, tema ayarı `header.*` bölüme taşınır.
5. **Gelişmiş CSS (O13, adr/0049 §8)** "Diğer ayarlar"ın en altında, yetkili role.
