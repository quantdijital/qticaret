# Bileşen standardı

> Vitrine yeni bir bölüm, biçim ya da ayar ekleyen herkes (insan ya da ajan) bu listeye uyar.
> Dayanak: adr/0049 (ve ekleri), `design.md`, sahibin istekleri (2026-11-14/15). Mevcut türlerin bu
> standarda göre durumu: `docs/tema/bilesen-denetimi.md`. Kaynaklar en altta.

## 0. Beş ilke

1. **Temel ayar açıkta.** Mağaza sahibinin bölümü eklerken ilk değiştireceği ayar (kaç kart, hız,
   yükseklik, yazının yeri, okların görünürlüğü) kapalı grupta duramaz. "Kayan yazının hızı bulunamadı"
   ve "durdur düğmesi ayarı unutuldu" bu kuralın iki ihlalidir.
2. **İkili karar yerine ayar.** Bir davranış iki türlü olabiliyorsa (sekmeye birleşsin mi, ilk soru açık
   mı) bunu kodda seçme: aç/kapat ayarı yap, varsayılanı bugünkü davranış olsun.
3. **Geniş düşün, az göster.** Ayar listesi geniş tasarlanır (kaç kart, kaydırma, ok stili ve
   görünürlüğü); panel yalnız o biçimde ve o durumda anlamlı olanı gösterir (`scrollerOffers`,
   `marqueeOffers`, `lookFieldsFor` deseni). Shopify'ın `visible_if`'i aynı işi görür: Horizon'da ok
   şekli yalnız ok stili "yok" değilken, kenarlık ayarları yalnız kenarlık açıkken görünür.
4. **Sayı ve renk yok, adlandırılmış basamak var.** Her ayar kapalı bir basamak listesidir; tema her
   basamağı kendi ölçeğine eşler (`SECTION_LOOK`, `SCROLLER_SETTINGS`). Shopify'ın `range` ve
   `color` ayarlarına karşılık bizde basamak ve renk takımı vardır: tema değişince kayıt anlamını yitirmez.
5. **Bir kavram, bir ad, bir takım.** Aynı kavram her bölümde aynı anahtar, aynı Türkçe etiket ve aynı
   basamak adlarıyla gelir (§3). Bir takım iki bölümde gerekiyorsa ortak takım olur
   (`section-look`, `section-scroller` deseni), kopyalanmaz.

## 1. Ayarların yeri: üç katman ve görünürlük

| Katman | Panelde | İçinde | Açık / kapalı |
| --- | --- | --- | --- |
| **İçerik** | "İçerik" grubu | Yazılar, görseller, bağlantılar, kaynak (hangi ürünler), adet, öğeler (slayt, soru, liste) | Açık |
| **Diziliş ve stil** | Biçim + bölüme göre adlandırılmış açık gruplar: "Diziliş", "Kaydırma", "Hareket", "Stil" | Biçim, sütun/sıra, görünen kart, oklar, hız, yükseklik, yazının yeri, perde, boy, zemin (bölüme özgü) | Açık |
| **Diğer ayarlar** | Tek kapalı grup, adı her bölümde "Diğer ayarlar" (değişmiş ayar sayısıyla) | Seyrek değişen stil (nokta, döngü, sürükleme, ayraç kalınlığı), ortak `look` (dış/iç boşluk, zemin, hizalama, genişlik), ileride gelişmiş CSS en altta | Kapalı |
| **Görünürlük** | "Görünürlük" grubu, en altta | Vitrinde göster, başlangıç/bitiş tarihi, cihaz | Açık |

Kurallar:

- Açık grup sayısı en çok dört (İçerik + iki diziliş/stil grubu + Görünürlük); fazlası "Diğer"e iner.
- Bir ayarın açık mı kapalı mı olacağını tek soru belirler: **"Bölümü ekleyen sahip bunu ilk beş
  dakikada değiştirir mi?"** Evet ise açık. Örnek: rafta görünen kart sayısı ve oklar açık, noktalar ve
  döngü kapalı (adr/0049 Ek 2026-11-15).
- Grup başlığı dışında her alanın yeri `field-registry.ts`'de (`FieldGroupName`) yazılır; panel ve ayar
  araması aynı kayıttan okur. Kapalı gruptaki alan aramayla bulunduğunda grup açılır.
- Biçim değişince ortak alanlar (başlık, kaynak) korunur, biçime özgüler düşer, "Geri al" geri getirir
  (adr/0049 §2, karar 1-B).

**Neden böyle (kıyas):**

- **Elementor** her widget'ı üç sekmeye böler: Content, Style, Advanced; Advanced'te kenar boşluğu,
  iç boşluk, konum, hareket efektleri, cihaza göre gizleme, öznitelikler ve özel CSS durur. Ayrımı biz
  de alıyoruz, ama **sekme değil grup**: sekme, ikinci sekmedeki temel ayarı (hız, kart sayısı) gizler;
  bu tam sahibin yaşadığı "bulunamadı" sorunudur. Biz temel stil ayarını İçerik'in hemen altında açık
  grupta, yalnız seyrek olanı kapalı "Diğer"de tutuyoruz.
- **Shopify** bölüm ayarlarını tek sütunda, `header` başlıklarıyla bölünmüş düz bir liste olarak verir
  (Dawn'da "Text", "Collection layout", "Product card", "Mobile layout", "Padding"); tekrarlanan içerik
  `blocks` ile eklenir, renk `color_scheme` ile tema genelindeki takımlardan seçilir, boşluk her
  bölümün sonunda "Padding" başlığı altında `padding_top`/`padding_bottom` (0–100 px, 4'er) olarak
  gelir. 2–5 seçenekli `select` yan yana düğmeler, fazlası açılır liste olarak çizilir. Bizde başlıklar
  katlanabilir gruptur, tekrarlanan içerik öğe listesidir (slayt, soru, kayan yazı öğesi), renk
  takımının karşılığı `ground` basamaklarıdır, seçenekler küçük çizimli yan yana düğmelerdir.
- Shopify'ın tasarım rehberi ayarları "çoğu satıcıya yetecek en az sayıda" tutmayı, niş ve uç durum
  ayarlarından kaçınmayı söyler; bu bizim "ayarlar boğmasın" kuralımızla aynıdır. Ayrımı biz geniş
  listeyi kapalı "Diğer"e indirerek yaparız, ayarı silerek değil.
- **Divi** de modül ayarını Content / Design / Advanced üçlüsüne böler; üç büyük üreticinin ortak
  noktası "içerik önce, stil sonra, gelişmiş en sonda" sırasıdır. Bizim sıramız aynıdır.

## 2. Her bölümde bulunan ortak ayarlar

Yeni bir gövde bölümü bunları **kendisi yazmaz**, ortak takımdan alır:

| Takım | Alanlar (varsayılan kalın) | Nerede | Not |
| --- | --- | --- | --- |
| `look` | `space_outer` none/small/medium/large · `space_inner` aynı · `ground` page/well/stage/primary · `align` start/center · `width` narrow/boxed/full; hepsi **null** (temanın kendi) | `section-look.ts`, backend `sections/look.ts` (`bodyFields`) | Bölümde anlamsız alan `lookFieldsFor`'da gizlenir; uzun metinde `primary` zemin sunulmaz (3:1 kuralı) |
| Görünürlük | `visible` **true**, `starts_at`, `ends_at` **null** | backend `layout-fields.ts` `base` | Ana bölümlerde (üst/alt bilgi, ürün, kategori) kilitli |
| Cihaz | `device` **all**/mobile/desktop | Bugün yalnız `marquee`; **ortak takıma taşınacak** (denetim O1) | Telefon = temanın dar çerçevesi (1024 px altı) |
| Kaydırma | `scroller` (§4.4) | `section-scroller.ts` | Kayan her bölüm bunu kullanır, kendi ok/nokta alanını yazmaz |

Shopify'da bölüm başına üst/alt boşluk ve renk şeması tekrar tekrar her bölüm şemasına yazılır;
Elementor'da boşluk ve cihaz gizleme (Hide On Desktop / Tablet / Mobile) her widget'ın Advanced
sekmesindedir ve cihaz başına değer büyük ekrandan küçüğe kalıtılır. Bizde bunlar tek takımdır, yeni
bölüm bedavaya alır; cihaz başına ayrı değer yalnız iki yerde verilir (telefon / masaüstü), üç
kırılımlı Elementor modeli alınmaz: sahibin "ayarlar boğmasın" kuralı.

## 3. Ad ve terim sözlüğü

**Etiket biçimi:** Türkçe gündelik ad + yanında küçük teknik terim (`label` + `term` anahtarı):
"Dış boşluk <small>margin</small>". Terimi olmayan alan yazılmaz; arama ikisinde de çalışır.
İpucu (`hint`) yalnız gerektiğinde, tek cümle, ne olacağını söyler (ör. "Telefonda her zaman görünür").

Shopify Theme Store kurallarından aldıklarımız: etiket soru değil, bildirim ya da olumlu cümledir
("Noktaları göster"); göster/gizle ayarı "göster" ile kurulur; çok seçenekli ayarda seçenekler sayıyla
değil anlamla adlandırılır ("Konum 1" değil "Sol orta"); bölümün adı her etikette tekrar edilmez;
varsayılan değer ayarın nasıl kullanılacağını gösterir, deneme metni (lorem ipsum) olmaz.

**Anahtarlar ve basamaklar (bağlayıcı):**

| Kavram | Anahtar | Türkçe | Basamaklar (anahtar → etiket) |
| --- | --- | --- | --- |
| Hareket hızı (akış) | `speed` | Hız <small>speed</small> | slowest/slow/medium/fast/fastest → Çok yavaş … Çok hızlı (5) ya da slow/medium/fast (3) |
| Bekleme süresi (sayfa/slayt) | `interval` (kaydırma takımında tarihsel adı `speed`, denetim O6) | Geçiş süresi <small>interval</small> | slow/medium/fast → Yavaş/Orta/Hızlı |
| Boy (öğe/yazı) | `size` | Boy <small>size</small> | small/medium/large → Küçük/Orta/Büyük |
| Yükseklik (görsel alan) | `height` | Yükseklik <small>height</small> | low/medium/high → Alçak/Orta/Yüksek (+ ileride `adapt` "Görsele göre") |
| Boşluk | `space_*`, `gap` | Dış/İç boşluk, Ögeler arası boşluk | none/small/medium/large → Yok/Dar/Orta/Geniş; `gap` tight/normal/wide → Sıkı/Normal/Geniş |
| Zemin | `ground` | Zemin <small>background</small> | page/well/stage/primary → Sayfa/Hafif ton/Koyu/Ana renk (tek sözlük; `light` → `well`'e iner, denetim O5) |
| Genişlik | `width` | Genişlik <small>width</small> | narrow/boxed/full → Dar/Kutulu/Tam |
| Hizalama | `align` | Hizalama <small>text-align</small> | start/center → Sola/Ortaya |
| Yazının yeri | `text_position` | Yazının yeri <small>position</small> | 9 konum `top_left` … `bottom_right` → Sol üst … Sağ alt |
| Perde | `overlay` | Perde gücü <small>overlay</small> | none/light/medium/strong → Yok/Hafif/Orta/Güçlü |
| Düğme stili | `button_style` | Düğme stili <small>button</small> | solid/outline/text → Dolu/Çerçeveli/Yazı |
| Görünen kart | `desktop`, `mobile` (kayan); `columns`, `columns_mobile` (ızgara) | Görünen kart / Satırda ürün (masaüstü, telefon) <small>per view / columns</small> | Masaüstü 3–6, telefon 1 / 1,5 (`peek`) / 2 |
| Oklar | `arrows`, `arrow_style`, `arrow_position` | Oklar, Ok biçimi, Okların yeri | always/hover/hidden; round/square/plain; head/sides |
| Aç/kapat | — | Etiket olumlu cümle ("Noktaları göster") | `off`/`on` → Kapalı/Açık; anahtar düğmesiyle çizilir |
| Cihaz | `device` | Cihaz <small>device</small> | all/mobile/desktop → Her yerde/Yalnız telefonda/Yalnız masaüstünde |

**Aç/kapat saklama kuralı:** ileride üçüncü seçenek alabilecek ayar (`dots`: kapalı/açık → sayılı)
adlandırılmış adım `off`/`on` olur; kesin evet/hayır olan içerik anahtarı (`show_count`, `phone`)
`boolean` kalabilir. Panelde ikisi de aynı anahtar düğmesiyle, "Kapalı/Açık" anlamında çizilir.

## 4. Aileye göre zorunlu ayar listesi

Yeni bölüm hangi aileye giriyorsa o listenin **her maddesi için** ya ayar yazılır ya da ADR notunda
"neden yok" tek cümleyle söylenir. Birden çok aileye giren bölüm hepsinin listesini taşır.

### 4.1 Metin bölümü (başlık, metin, düğme)
- Başlık (boşsa vitrinin kendi başlığı ya da hiç: hangisi olduğu ipucunda yazar), metin, en çok iki düğme
  (ikincisi bir basamak sade).
- `look.align`, `look.width` (okuma genişliği `narrow`), düğme stili.
- Uzun metinde `primary` zemin sunulmaz; `{belirteç}`ler (`shopText`) desteklenir.

### 4.2 Görsel / medya
- Görsel + açıklama (alt) alanı her görselde (boşsa panel uyarır) + isteğe bağlı telefon görseli.
- Yükseklik (`height`), yazının yeri (`text_position`), perde gücü (`overlay`), yazı tonu (`tone`
  light/dark), düğme stili. Bu takım tek ortak takım olur (bugün `BANNER_SETTINGS`).
- Odak noktası (telefonda kırpma): Shopify'da `image_picker` ayarında ya da Dosyalar sayfasında
  seçilir, tema kırparken o noktayı görünür tutar (`object-position`).
- **Yükleme önceliği ayar değildir:** sayfanın ilk bölümünün ilk görseli `eager` +
  `fetchPriority="high"`, gerisi `lazy` (tema `first` ile karar verir). En-boy oranı ya da yükseklik
  önceden ayrılır (CLS 0).

### 4.3 Liste / ızgara (ürün, kategori, marka, yazı, yorum)
- Kaynak (otomatik / elle seçim), adet (`limit`), "Tümünü gör" bağlantısı.
- Sütun: masaüstü **ve** telefon (Dawn'ın `featured-collection`, `collection-list`, `related-products`
  bölümlerindeki `columns_desktop` 1–6 + `columns_mobile` 1/2 çifti, yanında `swipe_on_mobile`).
- Biçim: en az ızgara ve kayan (kayan = §4.4 takımı). Kart biçimi tema genelinde, bölümde geçersiz kılınır.
- **Boş durum:** kaynak boşsa vitrin bölümü çizmez; panel formu bunu ipucunda söyler (ör. "İndirimde
  ürün yokken bölüm görünmez"). Sütun dolmuyorsa ipucu eksik adedi söyler (`columnsShort`).

### 4.4 Kaydırılan (ortak `scroller` takımı)
`packages/types/src/store/section-scroller.ts`, backend `sections/scroller.ts`, panel
`forms/scroller-fields.tsx` + `scroller-groups.ts`, tema `parts/Scroller.tsx`. Alanlar:
`desktop` 3/**4**/5/6, `mobile` 1/**1,5**/2, `arrows` **always**/hover/hidden, `arrow_style`
**round**/square/plain, `arrow_position` **head**/sides, `dots` **off**/on, `autoplay` **off**/on,
`speed` (süre) slow/**medium**/fast, `loop` **off**/on, `drag` **off**/on.
- Açık "Kaydırma": görünen kart ve oklar. Kapalı "Diğer": nokta, oto geçiş + süre, döngü, sürükleme.
- Kayan her yeni bölüm (görsel bandı, marka, yorum, giriş slaytı) bu takımı alır; kendi `arrows: boolean`'ını
  yazmaz. Elementor'un Image Carousel denetimleri (Slides to Show, Slides to Scroll, Navigation
  oklar/noktalar/ikisi/hiçbiri, Autoplay + Autoplay Speed, Pause on Hover, Pause on Interaction,
  Infinite Loop) ve Horizon'un "Carousel navigation" grubu (ok stili `icons_style`, ok şekli
  `icons_shape`) bu takımın karşılığıdır.

### 4.5 Hareketli (kendiliğinden hareket eden her şey)
- Hız ya da süre (§3), yön, üzerine gelince dur (aç/kapat), **durdur düğmesi** (kaldırılamaz, yalnız
  "her zaman / üzerine gelince"; WCAG 2.2.2), klavye odağında durma, `prefers-reduced-motion`'da hiç
  oynamama. Hepsi açık "Hareket" grubunda.
- Varsayılan: kendiliğinden geçiş **kapalı** (giriş slaytı, kaydırma), sürekli akan şeritte açık.

### 4.6 Sabit / yüzen öğe (WhatsApp düğmesi, alt çubuk, yapışkan üst bilgi)
- Konum (taraf), cihaz, hangi sayfalarda, kapatma.
- Çakışma kuralı yazılı olur: çekmece, sabit satın alma çubuğu, alt çubuk ve yazı alanıyla nasıl
  yer değiştirdiği (bugünkü örnek: `frame/WhatsApp.tsx`). Güvenli alan (`safe-area-inset`) hesaba katılır.
- Yapışkanlık basamakları: her zaman / yukarı kaydırınca / kapalı (Dawn `sticky_header_type`:
  none / on-scroll-up / always / reduce-logo-size, varsayılan on-scroll-up).

### 4.7 Gezinme (üst bilgi, menü)
- Biçim (logo yeri), yapışkanlık, menü çubuğu zemini, arama biçimi, hesap ve sepet gösterimi, telefonda
  ayrı düzen notu. Menü içeriği "Menüler" ekranındadır; bölüm yalnız gösterimi ayarlar.
- Tek doğruluk kaynağı: aynı ayar hem tema ayarında hem bölümde olmaz.

### 4.8 Form (e-bülten, iletişim)
- Başlık, metin, düğme yazısı, onay/KVKK metni bağlantısı, başarı ve hata mesajı (i18n).
- Hız sınırı ve redaksiyon `lib/security`'den (yeniden yazılmaz); alan etiketleri görünür, yalnız
  placeholder değil.

## 5. Yeni bileşenin teknik denetim listesi

1. **Sözleşme:** basamak listesi + varsayılanlar `packages/types/src/store/section-<ad>.ts`'de
   (`*_SETTINGS`, `*_DEFAULTS`, `*StepOf`, `*SettingsOf`); çalışma anında hiçbir şey içe aktarmaz.
2. **Varsayılan = eski kayıt aynen okunur:** her yeni alanın varsayılanı bugünkü çizimdir; alanı
   olmayan kayıt göçsüz okunur, "değişiklik var" yanmaz. Okumada bağışlayıcı (bilinmeyen basamak →
   varsayılan), yazmada katı.
3. **Backend doğrulama:** `apps/backend/src/lib/storefront/sections/<ad>.ts` aynası + eşitlik testi;
   `.strict()`, sınırlar `LAYOUT_LIMITS`/sözleşmede; metin `text`/`shopText`, görsel `image`.
4. **Panel formu:** alanlar §1 gruplarında; anlamsız alan gizli; her alanda "Varsayılana dön" ya da
   varsayılanı gösteren seçim; seçenekler küçük çizimlerle (`*-sketches.tsx`).
5. **Ayar araması kaydı:** her alan `field-registry.ts` (`FIELD_IDS`, grup, `label`, `term`, seçenek
   adları); form kimliği oradan alır. İçerik alanları da dahil.
6. **Biçim çizimi:** biçim varsa `SECTION_VARIANTS`'a ilk sıradaki varsayılanla; tema bilmediği biçimi
   varsayılanla çizer.
7. **i18n tr + en:** `storefront.editor.<takım>.<ayar>.{label,term,hint,<basamak>}`; iki dosyada eşit.
8. **Erişilebilirlik:** başlık hiyerarşisi (`headingId`), düğmelerde `aria-label`, bölge etiketi,
   klavyeyle tam kullanım, 4,5:1 yazı karşıtlığı her basamakta, hareket kuralları (§4.5).
9. **Performans:** CLS 0 (yükseklik/oran önceden), ilk görsel öncelikli, JS yalnız etkileşimde;
   `docs/21` bütçeleri.
10. **Testler:** sözleşme/ayna eşitliği, backend şema (varsayılan, ret), panel formu (grup, gizleme,
    arama), tema çizimi; adr/0049 deseni.
11. **ADR notu:** adr/0049'a tarihli ek: alanlar, varsayılanlar, panel düzeni, §4 listesinde
    bilerek konmayanlar.
12. **Tarayıcı doğrulaması:** panel önizlemesi ve `localhost:8000`'de telefon (390 px) ve masaüstü
    (1440 px); her basamak bir kez; azaltılmış hareket açıkken.

## 6. Ad verme kuralları

- **Bölüm türü (kod):** İngilizce, sektörsüz, ne olduğunu söyler (`price_bands`, `marquee`).
  **Türkçe adı** gündelik ve çizimi anlatır; iki tür birbirine benzer adla anılmaz ("Giriş slaytı" ile
  "Görsel slayt" çakışır: denetim 1.4). Açıklama satırı tek cümle, ne gösterdiğini söyler.
- **Biçim (variant):** İngilizce, çizimi anlatır (`category_list`, `carousel`); maket kodu ya da sektör adı
  değil. Türkçesi kısa ve görsel ("Kayan sıra", "Yan yana listeler").
- **Hazır görünüm (preset):** **özel ad + açıklayıcı alt satır.** Ad kısa ve akılda kalır (Grafit,
  Katalog, Tezgâh); açıklama ne yaptığını ve neye dokunmadığını söyler ("Menülere ve ürünlere dokunmaz").
- **Renk takımı kardeşleri:** `<Görünüm> · <Renk> ve <renk>` ("Tezgâh · Lacivert ve çelik"); kod
  `<görünüm>-<renk>` (`tezgah-lacivert`). Renk adları gündelik Türkçe, marka adı değil.
- **Basamak adları:** §3 sözlüğünden; yeni basamak sözlüğe önce yazılır.

## Kaynaklar

Bu belge ve denetim yazılırken açılıp okunan resmi sayfalar (2026-11-15). Dawn ve Horizon dosyaları
`raw.githubusercontent.com` üzerinden okundu; ayar adı ve değerleri dosyadaki şemadandır. Doğrulanamayan
(belgeye girmeyen): Elementor kırılım piksel değerleri, Shopify'da ayar sayısı ya da sırası için yazılı
üst sınır (yok), Divi'nin eski (4) sürüm sekme içerikleri.

**Shopify belgeleri**

- https://shopify.dev/docs/storefronts/themes/architecture/sections
- https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema
- https://shopify.dev/docs/storefronts/themes/architecture/blocks
- https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks
- https://shopify.dev/docs/storefronts/themes/architecture/settings
- https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings
- https://shopify.dev/docs/storefronts/themes/architecture/settings/sidebar-settings
- https://shopify.dev/docs/storefronts/themes/store/requirements
- https://shopify.dev/docs/storefronts/themes/best-practices/design
- https://shopify.dev/docs/storefronts/themes/best-practices/design/color-system
- https://shopify.dev/docs/api/liquid/objects/focal_point

**Dawn** (`https://raw.githubusercontent.com/Shopify/dawn/main/…`; dizin: https://github.com/Shopify/dawn/tree/main/sections)

- `sections/announcement-bar.liquid`, `header.liquid`, `footer.liquid`
- `sections/image-banner.liquid`, `slideshow.liquid`, `image-with-text.liquid`, `rich-text.liquid`
- `sections/featured-collection.liquid`, `collection-list.liquid`, `related-products.liquid`, `featured-product.liquid`, `featured-blog.liquid`
- `sections/multicolumn.liquid`, `collapsible-content.liquid`, `newsletter.liquid`
- `sections/main-collection-product-grid.liquid`, `main-product.liquid`
- `locales/en.default.schema.json`, `config/settings_schema.json`

**Horizon** (`https://raw.githubusercontent.com/Shopify/horizon/main/…`; depo: https://github.com/Shopify/horizon)

- `sections/product-list.liquid`, `slideshow.liquid`, `section.liquid`, `marquee.liquid`
- `blocks/_slide.liquid`, `blocks/group.liquid`
- `locales/en.default.schema.json`, `config/settings_schema.json`

**Elementor**

- https://elementor.com/help/advanced-tab/
- https://elementor.com/help/widget-settings-deep-dive-finding-and-using-advanced-options/
- https://elementor.com/help/responsive-editing/
- https://elementor.com/help/carousel-widget/
- https://elementor.com/help/image-carousel-widget/
- https://elementor.com/help/loop-carousel/
- https://developers.elementor.com/docs/editor/elementor-tabs
- https://developers.elementor.com/docs/editor-controls/control-section
- https://developers.elementor.com/docs/editor-controls/using-controls
- https://developers.elementor.com/docs/editor-controls/responsive-control

**Divi 5**

- https://help.elegantthemes.com/en/articles/11170855-the-group-module-in-divi-5
- https://help.elegantthemes.com/en/articles/13349301-advanced-styling-using-option-group-presets-in-divi-5
- https://help.elegantthemes.com/en/articles/14332889-composable-settings-in-divi-5
