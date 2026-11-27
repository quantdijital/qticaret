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
| **Diziliş ve stil** | Biçim + bölüme göre adlandırılmış açık gruplar: "Diziliş", "Kaydırma", "Hareket", "Stil"; her gövde bölümünde ortak "Boşluk" (üst/alt boşluk, `look.space_outer`/`space_below`) | Biçim, sütun/sıra, görünen kart, oklar, hız, yükseklik, yazının yeri, perde, boy, zemin (bölüme özgü) | Açık |
| **Diğer ayarlar** | Tek kapalı grup, adı her bölümde "Diğer ayarlar" (değişmiş ayar sayısıyla) | Seyrek değişen stil (nokta, döngü, sürükleme, ayraç kalınlığı), ortak `look`un kalanı (iç boşluk, zemin, hizalama, genişlik), ileride gelişmiş CSS en altta | Kapalı |
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
| `look` | `space_outer` (üst) none/small/medium/large · `space_below` (alt) aynı · `space_inner` aynı · `ground` page/well/stage/primary · `align` start/center · `width` narrow/boxed/full; hepsi **null** (temanın kendi) | `section-look.ts`, backend `sections/look.ts` (`bodyFields`) | Bölümde anlamsız alan `lookFieldsFor`'da gizlenir; uzun metinde `primary` zemin sunulmaz (3:1 kuralı) |
| Görünürlük | `visible` **true**, `starts_at`, `ends_at` **null** | backend `layout-fields.ts` `base` | Ana bölümlerde (üst/alt bilgi, ürün, kategori) kilitli |
| Cihaz | `device` **all**/mobile/desktop | `section-device.ts`, backend `layout-fields.ts` (`bodyFields`), panel `visibility-registry.ts`; her gövde bölümü + üst bilgideki kayan yazı (denetim O1, yapıldı) | Telefon = temanın dar çerçevesi (1024 px altı) |
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
| Boşluk | `space_*`, `gap` | Üst/Alt/İç boşluk, Ögeler arası boşluk | none/small/medium/large → Yok/Dar/Orta/Geniş; `gap` tight/normal/wide → Sıkı/Normal/Geniş |
| Zemin | `ground` | Zemin <small>background</small> | page/well/stage/primary → Sayfa/Hafif ton/Koyu/Ana renk (tek sözlük; `light` → `well`'e iner, denetim O5) |
| Genişlik | `width` | Genişlik <small>width</small> | narrow/boxed/full → Dar/Kutulu/Tam |
| Hizalama | `align` | Hizalama <small>text-align</small> | start/center → Sola/Ortaya |
| Yazının yeri | `text_position` | Yazının yeri <small>position</small> | 9 konum `top_left` … `bottom_right` → Sol üst … Sağ alt |
| Perde | `overlay` | Perde gücü <small>overlay</small> | none/light/medium/strong → Yok/Hafif/Orta/Güçlü |
| Düğme stili | `button_style` | Düğme stili <small>button</small> | solid/outline/text → Dolu/Çerçeveli/Yazı |
| Görünen kart | `desktop`, `mobile` (kayan); `columns`, `columns_mobile` (ızgara) | Görünen kart / Satırda ürün (masaüstü, telefon) <small>per view / columns</small> | Masaüstü 3–6, telefon 1 / 1,5 (`peek`) / 2 |
| Oklar | `arrows`, `arrow_style`, `arrow_position` | Oklar, Ok biçimi, Okların yeri | always/hover/hidden; round/square/plain; head/sides |
| Slayt denetimleri (açılış slaytları) | `play_button`, `dot_style`, `controls_place`, `arrow_size`, `controls_tone` | Durdur düğmesi, Nokta biçimi, Noktaların yeri, Ok boyutu, Zemin rengi | on/off; dots/lines/count/progress → Nokta/Çizgi/Sayı (1/4)/İlerleme; center/start/end → Ortada/Solda/Sağda; small/medium/large; dark/light/brand → Koyu/Açık/Mağaza rengi (adr/0049 Ek 2026-11-19) |
| Aç/kapat | — | Etiket olumlu cümle ("Noktaları göster") | `off`/`on` → Kapalı/Açık; anahtar düğmesiyle çizilir |
| Cihaz | `device` | Cihaz <small>device</small> | all/mobile/desktop → Her yerde/Yalnız telefonda/Yalnız masaüstünde |
| Fotoğraf düzeni (öne çıkan ürün) | `gallery` | Fotoğraf düzeni <small>gallery</small> | collage/strips → Kolaj/Çapraz şeritler |
| Yoğunluk (tema, stil takımı S6) | `density` | Yoğunluk <small>density</small> | airy/balanced/compact → Ferah/Dengeli/Sıkı (başlık → içerik, ızgara sütun ve satırı, alt bilgiye boşluk; adr/0067 Ek 2026-11-16) |
| Bölüm aralığı (tema) | `section_spacing` | Bölüm aralığı <small>section spacing</small> | tight/compact/normal/roomy → Çok sık/Sık/Normal/Ferah (çarpan 0,35/0,55/1/1,2) |
| Köşeler (tema) | `radius` | Köşeler <small>border-radius</small> | sharp/crisp/gentle/soft/round → Keskin/Belirgin/Ölçülü/Yumuşak/Yuvarlak (çarpan 0,2/0,6/0,8/1/1,5) |

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
- Ek 2026-11-16 (ürün rafı `strips` "Çapraz şeritler", adr/0049): kart yerine şerit; kendi sayısı
  `strips_count` 2–**5**–8 (`limit` değil), `strips_height` **low**/medium/high + ortak şerit görünümü
  (`strips_slant`, `strips_line`, `strips_overlap`, `strips_dim`; galeri ve öne çıkan ürünle aynı).
  Kart eylemi (sepete ekle, hızlı bakış, favori) bilerek yok: şeridin tamamı ürün sayfasına gider.
  Dar ekranda fazlası yatay kaydırılır (§4.4 Ek), ürün gizlenmez.
- Ek 2026-11-16 (ürün rafı `ranked` "Sıralı liste", adr/0049): kaynağın sırasıyla tek sıralı liste,
  her ürün büyük sıra rakamının yanında; kendi sayısı `ranked_count` 3–**5**–10 (`limit` değil),
  düzen `ranked_layout` **lead** (birinci büyük) / row (tek sıra). Kart biçimi seçilmez (kartın
  parçalarıyla çizilir); hızlı bakış ve sepete ekle simge olarak kalır. Rakam yalnız göz için,
  ekran okuyucu sırayı başlıktaki gizli "1."den duyar.
- Ek 2026-11-16 (ürün rafı `stage_list` "Sahne ve liste", adr/0049): bir ürün sahnede büyük, yanında
  satır listesi; kendi sayısı `stage_count` 3–**4**–6 (sahnedeki dahil), `stage_side` **start**/end,
  `stage_ground` **stage**/well, `stage_follow` **on**/off (1024 px'ten fareyle durulan ya da
  klavyeyle odaklanılan satır sahneye geçer; dokunuşta değişmez). Kart seçimi yok; tek eylem sahnede.
  Aynı ürün iki yerde görünüyorsa biri okunur: sahnedeki kopya `aria-hidden` (eylemi hariç), satır
  `aria-current`.
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
- Ek 2026-11-16 (şerit galeri, `strip_gallery`): masaüstünde sığan, yalnız dar ekranda taşan dizi
  karusel değildir, takımı almaz: 1024 px altında yalnız doğal yatay kaydırma + yakalama (oksuz,
  noktasız; Dawn'ın `swipe_on_mobile` karşılığı), her öğe ekranın sabit payını gösterir (telefonda
  %43, tablette %30), hiçbir öğe gizlenmez. Ortak parça `parts/Strips.tsx` `phone="scroll"` (adr/0049 Ek).

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
- Ek 2026-11-17 (e-bülten biçimleri, adr/0049): `standard` (varsayılan, aynen) / `split` "Yan yana bant" /
  `image_card` "Görselli kart" / `strip` "İnce şerit" / `in_footer` "Alt bilgi sütununda" (yalnız alt
  bilgi kutusunda; sayfada sunulmaz, backend reddeder). Alanlar: `description` (≤240, her biçimde ortak;
  `standard` çizmez), `note` (≤80) + `show_note` **on**/off (`split`, `image_card`), `image` (`image_card`;
  kütüphane kaydı, SVG yok; görselsiz `split` gibi çizilir). `text` açıklama değil **onay (İYS) cümlesidir**:
  panelde "Onay metni"; yeni formda da açıklama ile onay ayrı alan olur. Yeni biçimlerde alan + düğme tek
  parça, etiket görsel olarak gizli ama erişilebilir; KVKK bağlantısı hep görünür.

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
   `docs/21` bütçeleri. **Boşluk belirteçten:** bölüm başlığının altı `gap-(--head-gap)` / `-m` / `-s`, ızgaranın satırı
   `gap-y-(--gap-rows)` / `-s`, sütunu `--gap-columns`, alt bilgiye `--footer-gap`; elle `gap-6
   lg:gap-10` yazılmaz, yoksa mağazanın yoğunluk ayarı (`density`) o bölüme ulaşmaz.
10. **Testler:** sözleşme/ayna eşitliği, backend şema (varsayılan, ret), panel formu (grup, gizleme,
    arama), tema çizimi; adr/0049 deseni.
11. **ADR notu:** adr/0049'a tarihli ek: alanlar, varsayılanlar, panel düzeni, §4 listesinde
    bilerek konmayanlar.
12. **Tarayıcı doğrulaması:** panel önizlemesi ve `localhost:8000`'de telefon (390 px) ve masaüstü
    (1440 px); her basamak bir kez; azaltılmış hareket açıkken.
13. **Gömülü oynatıcı:** tema oynatıcı adresini yalnız `heroVideoPlayerSrc` (`@qticaret/types/hero-video`)
    ile videonun kimliğinden kurar; ham `video_url` hiçbir zaman `src`/`href` olmaz. Çerçeve yalnız
    ziyaretçi bastıktan sonra eklenir; yeni bir oynatıcı CSP `frame-src`'e yalnız kendi yoluyla girer.

## 6. Ad verme kuralları

- **Bölüm türü (kod):** İngilizce, sektörsüz, ne olduğunu söyler (`price_bands`, `marquee`).
  **Türkçe adı** gündelik ve çizimi anlatır; iki tür birbirine benzer adla anılmaz ("Giriş slaytı" ile
  "Görsel slayt" çakışıyordu; tür "Görsel bant" oldu: denetim 1.4). Açıklama satırı tek cümle, ne
  gösterdiğini söyler.
- **Biçim (variant):** İngilizce, çizimi anlatır (`category_list`, `carousel`); maket kodu ya da sektör adı
  değil. Türkçesi kısa ve görsel ("Kayan sıra", "Yan yana listeler").
- **Hazır görünüm (preset):** **özel ad + açıklayıcı alt satır.** Ad kısa ve akılda kalır (Katalog,
  Tezgâh); açıklama ne yaptığını ve neye dokunmadığını söyler ("Menülere ve ürünlere dokunmaz").
- **Renk takımı kardeşleri:** `<Görünüm> · <Renk> ve <renk>` ("Tezgâh · Lacivert ve çelik"); kod
  `<görünüm>-<renk>` (`tezgah-lacivert`). Renk adları gündelik Türkçe, marka adı değil.
- **Basamak adları:** §3 sözlüğünden; yeni basamak sözlüğe önce yazılır.

## 7. Yayımlanmış biçim sözleşmedir

Sahip kararı, 2026-11-15. Sebep: iki geliştirici aynı bileşene farklı tasarım yönleriyle girdiğinde birinin çizimi ötekinin hazır görünümünü habersiz değiştirmesin; ileride de mağaza sahibinin seçtiği görünüm o istemeden değişmesin.

**Kural.** `dev`'e girmiş bir bölüm biçiminin çizimi yerinde yeniden tasarlanmaz. Yeni tasarım iki yoldan biriyle gelir:

| Fark | Yol | Örnek |
| --- | --- | --- |
| Küçük, her mağazanın işine yarar | Ayar; varsayılanı bugünkü görünümü korur | Yardımcı şerit aç/kapat, arama genişliği, menü öğesi kutulu/çizgili, gölge var/yok |
| Düzenin iskeleti değişiyor | Yeni biçim; eskisi olduğu gibi kalır | Kategori listesi solda yerine üstte; kategorilerde alt kategorili kartın yanına fotoğraflı kolaj (`categories.variant: collage`) |

**Hazır görünüm yalnız veridir.** Bir görünüm `layout.json` dosyasıdır: hangi bölüm, hangi biçim, hangi ayar değeri. İçine kod ya da gizli CSS girmez. Bir görünüm ayarlarla kurulamıyorsa eksik olan ayardır; ayar eklenir. Emsal: Divi'nin hazır tasarımları da modül ayarlarının kayıtlı değerleridir; Shopify tema ön ayarları da ayar değerleridir.

**Yerinde değiştirilebilenler.** Hata düzeltmesi, erişilebilirlik, performans, görünümü değiştirmeyen iç düzenleme, bütün biçimlerin paylaştığı ortak parçalarda herkese gelen iyileştirme (ör. açılır menülerin tek tarife geçmesi). Ölçüt: bu biçimi seçmiş bir mağaza sahibi farkı görür ve itiraz edebilir mi? Evetse seçenek olur.

**Sınır.** §0'ın üçüncü ilkesi (geniş düşün, az göster) burada da geçerlidir: bölüm başına bir avuç anlamlı ayar. Divi'nin ayar sayısına gidilmez; iskelet farkı biçimle çözülür.

**Eskiyen biçim.** Silinmez. Seçim listesinden gizlenebilir; onu kullanan kayıtlı görünümler çizilmeye devam eder. Silmek ayrı ve bilinçli bir karardır.

**PR'da.** Bir biçimin ya da ortak parçanın görünümüne dokunan PR, gövdesinde hangi hazır görünümlerin (`packages/sector-packs/packs/*/presets/*`) etkilendiğini ve görünümlerinin değişip değişmediğini yazar. Bu beyanı görünüm kilidi doğrular (`apps/storefront/src/lib/__tests__/preset-lock.spec.tsx` ve `preset-lock-pages.spec.tsx`, vitrin testleriyle `pnpm verify:changed` içinde koşar): her hazır görünüm kendiliğinden bulunur, sabit bir mağaza fikstürüyle çizilir; çerçevesi, ana sayfası (bölüm bölüm), ürün sayfası ve kategori (liste) sayfası HTML olarak, tema stil dosyaları özetleriyle depoda saklanır (`apps/storefront/src/lib/__tests__/preset-lock/`). İçerik sayfaları `preset-lock-content.spec.tsx` ile kilitlidir (adr/0073): düzensiz sayfa, iletişim ve bölümlü sayfa `fixture-content-pages/` altında; bir hazır görünümün kendi sayfa düzeni (`layout.json` `pages`) o görünümün klasöründe (Katalog'un Hakkımızda'sı `cutlery-katalog/about.html`). Kilitli değil: sepet çekmecesi, arama paneli, hızlı bakış gibi istemcide açılan yüzeyler; hesap, sepet ve ödeme sayfaları. Bir görünümün HTML'i ya da tema stili değişince test, hangi görünümün hangi dosyasının değiştiğini söyleyerek kırılır. Kırılınca: fark bilerek değilse tasarım ayar ya da yeni biçim olarak yeniden yapılır; bilerekse etkilenen görünümlere tarayıcıda bakılır, `pnpm lock:presets` ile örnekler yeniden yazılır ve PR gövdesine etkilenen görünümler ile farkları yazılır. Yeni hazır görünüm eklenince örneği de `pnpm lock:presets` ile üretilir; örneksiz görünüm testi kırar. Kaldırılan görünümün örnekleri de aynı komutla silinir; artık olmayan görünümün örneği testi kırar (Grafit hazır görünümü kaldırıldı, sahip, 2026-11-17; adr/0063 Ek 2026-11-17). Kilit ekran görüntüsü karşılaştırması değildir: stil değişikliğini dosya düzeyinde yakalar, hangi görünümü nasıl etkilediğine tarayıcıda bakılır.

**Üst şerit ayrı bir bölümdür** (sahip kararı, 2026-11-27; adr/0066 Ek 2026-11-27). Üst bilginin üstünde çizilen her şey üst bilgi grubunun kendi bölümlerindendir: üst şerit (`announcement_bar`; biçimleri `graphite` "Koyu şerit": satırlar, düğme, üst bağlantılar, telefon; `light` "Açık şerit": not, üst bağlantılar, "Hesabım") ve kayan yazı. Üst bilgi biçimleri (Klasik katalog dahil) yalnız kendi satırlarını çizer; biçim seçmek şerit getirmez, şerit yoksa üstte hiçbir şey çizilmez. Düzenleyicide "Üst şerit" grubu bir yerde, biçim seçicisiyle; grup başlığındaki göz hepsini gizler. Önceden kaydedilmiş görünümler bir kez okunurken yeni şekle çevrilir (`apps/backend/src/lib/storefront/top-strip-legacy.ts`; üst bilgide `top_strip: "separate"` işareti): eski çizim neyse şerit o biçim ve parçalarla yazılır; katalog başlığının `utility_bar`, `strip_note`, `strip_note_link`, `account_text` alanları anlamını korur, yalnız orada okunur, panelde artık sunulmaz. Kaybolan tek görünüm: Klasik katalog şeridi açıkken yanında duyuru şeridi de olan tasarım (iki şerit); duyuru şeridi kalır ve üst bağlantıları alır.

**Ürün sayfasında tek güvence kutusu çizilmez** (sahip kararı, 2026-11-27; adr/0066 Ek 2026-11-27). "Kargo ve teslimat" kartı olan üründe alım formunun altındaki güvence kutuları (`packages/themes/atolye/src/product/Assurances.tsx`; kargo, saat, iade simgeli olmayan rozetler) yalnız en az iki kutu varken çizilir; tek kutu orada çizilmez, ana sayfa şeridinde, alt bilgide ve sepette görünür. Telefonda (`sm` altı) kutular tek sütunda alçak satırlardır: solda simge, başlık ve açıklama birer satır (sığmazsa üç nokta). `sm`'den itibaren ikişer dizilir, başlık ve açıklama en çok iki satır; tek sayıda kutuda son kutu satırı kaplar. Kartı olmayan ürünün "Teslimat ve iade" kutusu aynıdır. Etkilenen hazır görünümler (ürün sayfası): `cutlery-katalog`, `cutlery-tezgah`, `cutlery-tezgah-lacivert`, `cutlery-tezgah-turuncu`, `travel-patika`, `travel-rota`, `travel-vadi`.

**Çözülmüş stil denetimi** (adr/0067 §3). Kilit HTML sınıflarını ve CSS dosyalarının ham özetini tuttuğu için, görünüşü değiştirmeyen bir taşıma da (bir kararı belirtece ya da başka sınıfa taşımak) kilidi kırar. "Görünüş gerçekten aynı" kanıtı çözülmüş stil denetimidir: çalışan vitrinin sayfalarını tarayıcıda (Playwright, Chromium) 390 ve 1440 px'te açar, hareketi durdurur ve görünür her öğenin hesaplanmış görünüş özelliklerini (zemin, kenar, köşe, gölge, renk, yazı, iç ve dış boşluk, boyut, görünürlük) sınıf adına dayanmayan yapısal bir anahtarla yazar; ardından iki yakalamayı karşılaştırır. Sayfalar: ana sayfa, ilk kategori ve ürün, sepet, arama; durumlar: menü öğesinin üstüne gelme, açılır menü, "Kategoriler" düğmesi, telefon menüsü, sepet çekmecesi, arama önerileri, ürün kartının üstüne gelme (sayfanın çizmediği durum "atlandı" olur). Sunucu ister ve dakikalar sürer; `pnpm verify:changed` içinde koşmaz. **Ne zaman:** temanın çizimine dokunan (bileşen sınıfı, tema CSS'i, belirteç) ve "görünüş değişmedi" diyen her PR birleşmeden önce. **Nasıl:** vitrin `dev`'in koduyla açıkken `pnpm style:capture -- --out apps/storefront/e2e/.resolved-style/once`; dal koduyla açıkken `pnpm style:capture -- --out apps/storefront/e2e/.resolved-style/sonra`; sonra `pnpm style:diff -- apps/storefront/e2e/.resolved-style/once apps/storefront/e2e/.resolved-style/sonra`. Bir hazır görünüm için taslağa uygulayıp önizleme adresiyle ölçülür: `STYLE_PREFIX=/onizleme/<jeton> pnpm style:capture -- --out …` (jeton çıktıya ve loga yazılmaz; ortam değişkeni komut satırında görünmesin diye). Rapor sayfa, genişlik, durum, öğe (yapısal yol ve kısa metni), özellik ve eski → yeni değeri yazar; eklenen ve silinen öğeleri ayrı listeler; 0,5 px'e kadar alt piksel farkını yok sayar (`--tolerance 0` ile tam). **PR'a:** raporun son satırı ("çözülmüş stil N/N aynı") ve ölçülen görünümler; fark varsa raporun ilgili bölümü ve neden bilerek olduğu. Kapsamaz: tarayıcının çizdiği resim ve yazı tipi pikselleri, öğelerin konumu (yalnız boyutu), `svg` içi çizim ve bir ayar değişince çizilen başka yapı.

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
