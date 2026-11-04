# Design: My L'arte vitrini, ikinci tema (TASLAK)

> **Durum: onaylandı (2026-11-04, sahip: "önerine uyarım … başla yolda revize veririm"); kilitli kopya depo kökünde `design.md`.** Hallmark `design-md.md` biçimi. Sahip onaylayınca §System–§Exports depo köküne `design.md` olarak kopyalanır ve sonraki her Hallmark koşusu önce onu okur; §Deal ve §Picks kopyalanmaz.
> Dayanak: `docs/tema/denetim-2026-11-04.md`. Önerilen tema **Loom**; sahip başka temayı seçerse §Tokens ve §Type o temanın değerleriyle yeniden yazılır, bileşen ve sektör kuralları aynen kalır.
> Platform kuralı: tema sektörden bağımsızdır. Bıçağa özgü her şey veri (özellik şablonu, bölüm, ek seçenek, bayrak) olarak gelir; tema yalnız genel bileşen çizer. Yeni tema `packages/themes/<slug>`, sözleşme `@qticaret/ui` (adr/0046 §7); base tema yerinde kalır.

## System
- Genre: editorial
- Shape of the first page: Bento Grid (draw 30e00e), hero Index; sepet, ödeme, giriş ve hesap uygulama ekranı
- Theme: Loom (deal 3/3, seed `mobile-first-e-commerce-shop-handmade-62be·8d7a0280·2026-11-04·r0`), colourway `ecru`; vurgu Loom çividi yerine markanın `#076599`'u
- Axes: light/roman-serif/cool · posture: committed (vurgu yalnız birincil düğme, duyuru şeridi, odak, seçili durum)

## Tokens
Rol adları Hallmark'ınki; `packages/ui`'nin `@theme inline` adlarıyla (`--color-accent`, `--color-muted`, `--color-ink`, `--color-sale`, `--color-success`) çakışmasın diye beşi yeniden adlandırıldı (`export-formats.md` § shadcn): ink → `text`, muted → `text-3`, accent → `signal`, sale → `discount`, success → `ok`.

```css
:root {
  --color-paper: oklch(95.5% 0.014 85);  --color-paper-2: oklch(92% 0.022 84);  --color-paper-3: oklch(85% 0.032 80);  --color-field: oklch(98.5% 0.006 85);
  --color-text: oklch(21% 0.012 60);  --color-text-2: oklch(31% 0.012 60);  --color-text-3: oklch(46% 0.014 62);
  --color-rule: oklch(83% 0.022 84);  --color-rule-ink: var(--color-text);  --color-edge: var(--color-text-3);
  --color-signal: oklch(48.6% 0.113 242.1);  --color-signal-2: oklch(41% 0.105 242);  --color-signal-ink: oklch(98.5% 0.006 85);  --color-focus: var(--color-signal);
  --color-discount: oklch(47% 0.16 27);  --color-discount-ink: oklch(98.5% 0.006 85);  --color-ok: oklch(44% 0.10 150);  --color-warn: oklch(47% 0.10 65);  --color-error: oklch(47% 0.17 27);
  --color-band: var(--color-text);  --color-band-text: var(--color-paper);  --color-band-text-2: oklch(78% 0.016 80);  --color-band-focus: var(--color-paper);
  --color-whatsapp: oklch(48% 0.12 152);  --color-whatsapp-ink: oklch(98.5% 0.006 85);  --color-scrim: oklch(21% 0.012 60 / 0.45);
  --font-display: "Libre Caslon Display", Georgia, ui-serif, serif;  --font-body: "Hanken Grotesk", Arial, ui-sans-serif, system-ui, sans-serif;  --font-outlier: var(--font-body);
  --radius-card: 0;  --radius-pill: 0;  --rule-hair: 1px;  --rule-ink: 2px;  --shadow-card: none;  --shadow-overlay: 0 8px 20px oklch(21% 0.012 60 / 0.18);
  --tracking-display: -0.01em;  --display-weight: 400;
}
@media (prefers-color-scheme: dark) { :root {
  --color-paper: oklch(17% 0.010 60);  --color-paper-2: oklch(21% 0.010 60);  --color-paper-3: oklch(26% 0.012 60);  --color-field: oklch(21% 0.010 60);
  --color-text: oklch(94% 0.012 85);  --color-text-2: oklch(86% 0.012 85);  --color-text-3: oklch(72% 0.014 80);
  --color-rule: oklch(32% 0.010 60);  --color-edge: oklch(62% 0.014 80);
  --color-signal: oklch(72% 0.10 238);  --color-signal-2: oklch(78% 0.09 238);  --color-signal-ink: oklch(17% 0.010 60);
  --color-discount: oklch(72% 0.13 27);  --color-discount-ink: oklch(17% 0.010 60);  --color-ok: oklch(76% 0.11 150);  --color-warn: oklch(80% 0.11 75);  --color-error: oklch(72% 0.14 27);
  --color-band: oklch(26% 0.012 60);  --color-band-text: oklch(94% 0.012 85);  --color-band-text-2: oklch(76% 0.014 80);  --color-band-focus: oklch(72% 0.10 238);
  --color-whatsapp: oklch(70% 0.14 152);  --color-whatsapp-ink: oklch(17% 0.010 60);
} }
```
Aralık, tip ölçeği, yumuşatmalar ve süreler scaffold'unkidir (`theme.mjs scaffold loom`), `tokens.css`'e yazılır.

**Kontrast (WCAG 2.2, ölçüldü; metin 4,5:1, büyük metin, simge, halka, alan kenarı 3:1):**

| Çift | Açık | Koyu | Kullanım |
| --- | --- | --- | --- |
| text / paper · paper-2 · paper-3 · field | 15,57 · 14,00 · 11,21 · 17,00 | 16,05 · 14,88 · 13,06 · 14,88 | gövde, kuyular, alanlar |
| text-2 / paper · paper-2 | 11,57 · 10,41 | 12,50 · 11,59 | ikincil metin |
| text-3 / paper · paper-2 · paper-3 · field | 6,27 · 5,64 · **4,52** · 6,85 | 7,71 · 7,15 · 6,27 · 7,15 | etiket, meta, eski fiyat, yer tutucu |
| signal / paper · paper-2 · field | 5,52 · 4,97 · 6,03 | 7,84 · 7,27 · 7,27 | bağlantı metni |
| signal-ink / signal · signal-2 | 6,03 · 8,31 | 7,84 · 9,70 | birincil düğme, duyuru şeridi |
| discount / paper · field; discount-ink / discount | 6,50 · 7,10; 7,10 | 7,30 · 6,77; 7,30 | indirimli fiyat, indirim rozeti |
| ok · warn · error / paper | 6,50 · 6,15 · 6,54 | 9,31 · 10,11 · 7,27 | stokta, az kaldı, hata |
| band-text · band-text-2 / band | 15,57 · 8,86 | 13,06 · 7,25 | alt bilgi |
| focus / paper · paper-2 · paper-3 | 5,52 · 4,97 · 3,98 | 7,84 · 7,27 · 6,38 | odak halkası |
| band-focus / band; signal-ink / signal (şeritte halka) | 15,57; 6,03 | 6,38; 7,84 | koyu bant ve duyuru şeridinde halka |
| edge / field · paper | 6,85 · 6,27 | 4,87 · 5,25 | alan kenarı |
| whatsapp-ink / whatsapp; whatsapp / paper | 5,91; 5,42 | 7,59; 7,59 | sabit düğme |

Yasaklar (ölçümden): `signal` metni `paper-3` üstünde (3,98) ve açık modda koyu bantta (2,81) kullanılmaz; orada bağlantı `band-text` + alt çizgi. `text-3` `paper-3` üstünde yalnız 14 px ve üstü. Duyuru şeridindeki odak halkası `signal-ink`'tir (bugünkü 1,00:1 hatası, denetim §3.2). Sahip mürdüm `#7a1a48`'i seçerse: paper üstünde 8,90, field-ink onun üstünde 9,72 (geçer); ama Loom'un "ecru yanında sıcak vurgu yok" kuralına yakın düşer, §Deal'de yeniden bakılır.

## Type
İki aile, üç ağırlık (Caslon 400; Hanken 400, 500). Mono yok (Loom'un DM Mono'su performans bütçesi için alındı, §Variants). Büyük harf dönüşümü ve harf aralığı açma yok; etiketler cümle düzeninde (`lang="tr"` zaten var).

| Rol | Yüz | 360 px | 1440 px | Satır | Not |
| --- | --- | --- | --- | --- | --- |
| display: ana sayfa h1 | Caslon 400 | 40 | 72 | 1,04 | `clamp(2.5rem, 3.2vw + 1.75rem, 4.5rem)`, ≤ 7 kelime |
| page: kategori, ürün, içerik h1 | Caslon 400 | 32 | 48 | 1,08 | `clamp(2rem, 1.6vw + 1.5rem, 3rem)` |
| section: bölüm h2 | Caslon 400 | 32 | 52 | 1,08 | `clamp(2rem, 2.2vw + 1.25rem, 3.25rem)` |
| price-hero: ürün fiyatı | Caslon 400 | 32 | 40 | 1,1 | Caslon hiçbir yerde 32 px altına inmez |
| title: h3, panel başı (filtre, özet, adım) | Hanken 500 | 20 | 24 | 1,25 | |
| lead | Hanken 400 | 18 | 20 | 1,45 | |
| body | Hanken 400 | 16 | 16 | 1,55 | ölçü 45–75ch |
| card-title | Hanken 500 | 15 | 16 | 1,35 | 2 satır |
| price: kart, sepet, özet | Hanken 500 tabular | 16 | 17 | 1,3 | `1.299,90 TL` (biçim storefront'ta) |
| label, meta, tablo başı, alt bilgi bağlantısı | Hanken 500/400 | 14 | 14 | 1,4 | |
| caption, küçük yazı | Hanken 400 | 13 | 13 | 1,45 | 12 px altı yok |

**Türkçe ve barındırma:** iki yüz de OFL; Google Fonts ikisi için `latin-ext` listeliyor (Ğ ğ İ ı Ş ş Ö ö Ü ü Ç ç). Glif denetimi inşadan önce fontTools ile yapılır (docs/21 yöntemi: `latin` + Türkçe alt küme, içerik özetli ad, `public/fonts`, `FONT_FILES`); Caslon Display'de bir harf eksikse yüz değiştirilmeden önce sahibe sorulur. ₺ gerekmez (para `TL` ile yazılır). Yedek yüzler ölçü ayarlı (Georgia, Arial), `font-display: swap`. Önyükleme bütçesi ≤ 125 KB (bugün 122 KB).

## Spacing, radii, borders, shadows
- **Aralık:** 2 · 4 · 8 · 12 · 16 · 24 · 40 · 64 · 96 · 144 px (`--space-3xs` … `--space-4xl`); ham `padding`/`gap` yok.
- **Kenar boşluğu:** 16 px (< 640), 24 px (< 960), 64 px; kap 1440 px, 1920'de yalnız boşluk büyür. Bölüm aralığı telefonda 56/72/96, masaüstünde 120/144/176.
- **Köşe:** her yerde 0 (kart, görsel, alan, düğme, rozet, çekmece). Panelin köşe ve düğme ayarı bu temada uygulanmaz (§Variants, sahip sorusu S8).
- **Çizgi:** `--rule-hair` 1 px `--color-rule` satır ve bölmelerde (alanın tek sınırı olamaz); `--rule-ink` 2 px `--color-text` nav altında, tablo başı altında, listenin ilk satırı üstünde. Alan kenarı 1 px `--color-edge`.
- **Gölge:** yüzeylerde yok; derinlik kâğıt basamağıyla. Yalnız üst katmanlar (çekmece, alt sayfa, mega menü, bildirim) `--shadow-overlay`, kenarlıksız; arkada `--color-scrim`.

## Breakpoints, touch, motion
| Ad | min | Değişen |
| --- | --- | --- |
| base | 360 | 2'li ürün ızgarası, 2'li kategori kartı, alt gezinme, filtre alt sayfada, üründe yapışkan sepete ekle |
| xs | 390 | yalnız boşluk; düzen aynı |
| md | 768 | 3'lü ızgara, kategori bentosu 3 sütun |
| lg | 1024 | masaüstü üst bilgi ve mega menü, filtre yan panel (280 px), ürün sayfası 7/5 iki sütun ve yapışkan satın alma kutusu, alt gezinme kalkar |
| xl | 1280 | 4'lü ızgara (filtre yanında 3) |
| 2xl | 1440 | kap; ızgara sütun eklemez |

- **Dokunma:** her etkileşimli öğe ≥ 44×44 (alt bilgi bağlantısı, kırıntı, çip, adet, sil, arama gönder dahil); komşu hedefler arası ≥ 8 px. Metin içi bağlantı istisna (WCAG 2.5.8), satır yüksekliği 1,55.
- **Sabit çerçeve bütçesi (telefon):** yapışkan üst bilgi ≤ 112 px + alt çubuk 56 px + güvenli alan; 360×780'de ≤ %22. Duyuru şeridi yapışkan değildir ve satırı yoksa çizilmez.
- **Hareket:** yalnız durum; `transform` ve `opacity`; 120 ms (mikro), 220 ms (çekmece, alt sayfa), `--ease-out`. Kendiliğinden kayan içerik yok. `prefers-reduced-motion: reduce` altında her şey anında biter, çekmece kaymadan açılır.

## Controls
- Primary: `--color-signal` dolgu, `--color-signal-ink` yazı, köşe 0, yükseklik 48 px, Hanken 500 16 px, yatay 24 px; üzerine gelince `--color-signal-2`; basınca 1 px aşağı.
- Secondary: aynı ölçüde 1 px `--color-text` çerçeve, saydam; metin bağlantısı 2 px alt çizgi, üzerine gelince `--color-signal`.
- Alan: 48 px, `--color-field` dolgu, 1 px `--color-edge`, köşe 0; odakta `outline` (kenar kalınlığı değişmez).
- Sayfa başına tek birincil düğme biçimi; iki dolgulu düğme yan yana gelmez. Düğme metnine ok eklenmez.

## Motion
- Character: still; tek gösterim yok; azaltılmış harekette her şey anında biter.

## Components
Ortak sekiz durum: **varsayılan** · **üzerine gelme** (yalnız `@media (hover: hover)`, kapta tek sinyal: alt çizgi kalınlaşır ya da dolgu bir basamak koyulaşır; görsel büyümez) · **odak** (`:focus-visible`, 2 px `--color-focus`, 2 px boşluk, anında; vurgu ve koyu bant üstünde `signal-ink`/`band-focus`; kenara dayalı şeritte içe) · **basılı** (1 px aşağı) · **devre dışı** (yerel `disabled` + `aria-disabled` + opaklık 0,55 + `not-allowed`) · **yükleniyor** (`aria-busy`, etiket yerinde kalır, genişlik sabit, çift gönderim yok) · **boş** (burada ne olacağı + tek eylem) · **hata** (`--color-error` + simge, renk tek başına değil; alanda `aria-invalid` + `aria-describedby`, form düzeyinde `role="alert"`). Aşağıda yalnız farklar. Dosya: base temadaki karşılığı; ⚑ sözleşme eki gerekir (denetim §7).

- **Duyuru şeridi** (`storefront.announcements`; `layout/AnnouncementBar.tsx`): vurgu bandı, 14 px, en az 36 px; telefonda ilk satır, masaüstünde satırlar solda, üst bağlantılar ve telefon sağda. Boş: hiç çizilmez. Kendiliğinden dönmez; satırlar arasında nokta yok, ayrı `li`.
- **Yapışkan üst bilgi** (`ShopView`; `layout/SiteHeader.tsx`, `SearchForm.tsx`): telefonda 56 px satır (menü 44, ad/logo, sepet 44 sayaçlı) + 48 px arama satırı (alan 44, gönder 44) + 2 px ink çizgi = 106 px. Masaüstü: logo solda, geniş arama ortada, hesap ve sepet sağda; altında mega menü tetikleri (44 px). Sepet sayacı kare, `signal` dolgu, `aria-live="polite"`. Arama boş gönderilirse `/arama` ipucu sayfası (bugünkü `SearchHelp`).
- **Mega menü** (`categories`; `layout/CategoryNav.tsx`): tıklamayla ve 150 ms gecikmeli üzerine gelmeyle açılır, Esc kapatır, içerik HTML'de (`forceMount`). Kap genişliğinde panel, üstte 2 px ink çizgi; alt kategoriler 44 px satır sütunlarda; "Tümünü gör: {kategori}" (oksuz). Kategori görseli varsa bir kare kart ⚑; yoksa hiçbir kutu çizilmez (bugünkü boş gri kutu gider).
- **Mobil çekmece** (`layout/MobileMenu.tsx`): soldan tam yükseklik, 360'ta tam genişlik; üst kategoriler 56 px satır, açılır alt liste (akordeon), sonra üst bağlantılar, telefon, WhatsApp. Odak tuzağı, perde, Esc.
- **USP şeridi** (`trustBadges`; `components/TrustStrip.tsx`): hero'nun hemen altında; telefonda 2×2, masaüstünde 4'lü; simge 20 px metin renginde (renkli halka yok), başlık 14/500, satır 13. Etkileşimsiz: üzerine gelme yok. Boş: çizilmez. Para `1.500,00 TL` biçiminde (bugünkü `₺1.500` belirteç çıktısı düzeltilir).
- **Kategori kartı** (⚑ `image`): fotoğraf 1:1 (telefonda 2 sütun), masaüstünde bento; ad fotoğrafın altında Hanken 500 18 (fotoğraf üstüne yazı yok); kartın tamamı tek bağlantı. Üzerine gelme: ad altı çizilir. Görselsiz: `paper-2` üstünde yalnız ad.
- **Ürün kartı** (`ProductCardView`; `components/ProductCard.tsx`): görsel kuyusu `paper-2`, mağazanın oranı; ürün görseline asla filtre uygulanmaz ve tükendiğinde griye çevrilmez (sap rengi seçeneğin kendisi). Sol üstte rozet: indirim (`discount`), "Tükendi", "Az kaldı" ⚑ (adet değil kova). Marka 13 px `text-3` cümle düzeni; ad 2 satır; puan görünüm modelinde varsa ⚑; fiyat, indirimde eski fiyat üstü çizili `text-3` + yeni fiyat `discount`. Hızlı ekle ⚑: yalnız tek varyantlı ve stoktaki üründe, kartın altında tam genişlik 44 px ikincil düğme; çok varyantlıda "Seçenekleri gör" bağlantısı. Yükleniyor: düğme `aria-busy`; hata: düğmenin altında satır içi ileti + ürüne bağlantı; başarı: mini sepet açılır (bildirim yok).
- **Filtre ve sıralama** (`ListingPageView.filters`, `stock`, `sort`; `components/Filters.tsx`): telefonda "Filtrele (N)" ve "Sırala" 44 px iki düğme; filtre formu HTML'de, betik onu alt sayfaya çevirir (betiksiz bugünkü `<details>` çalışır); gruplar akordeon, seçenek satırı 44 px, sayılar tabular; altta "Uygula" birincil. Masaüstünde 280 px yan panel, grup başında 2 px ink çizgi. Seçili filtreler kaldırılabilir 44 px çipler + "Tümünü temizle". Sayısı 0 olan seçenek devre dışı. Boş: "Bu filtrelerle ürün yok." + "Filtreleri temizle". Hata: fiyatta en az > en çok ise alan hatası.
- **Galeri** (`images`; `components/ProductGallery.tsx`): telefonda yakalamalı yatay şerit 1:1, altında "3 / 9" durum metni (`role="status"`, süs değil); masaüstünde büyük görsel + 72 px kare küçük resimler. Dokununca tam ekran görüntüleyici: yerel iki parmak yakınlaştırma (`touch-action: pinch-zoom`, `user-scalable=no` asla), en büyük türev, Esc ve 44 px kapat. Ölçek görseli ⚑ (`ImageView` rolü): altında "Elde, ölçü için" açıklaması. Yükleniyor: sabit oranlı `paper-2` kutu (CLS yok). Boş: adın ilk harfi.
- **Teknik özellikler tablosu** (`specs` ⚑ `group`; `components/ProductDetails.tsx`): gerçek `<table>`, başlık "Teknik özellikler" (title düzeyi); her grup bir `<tbody>`, grup başı 14/500 `text-3` ve üstünde 2 px ink çizgi; satır: etiket solda Hanken 400 15 `text-2`, değer sağda Hanken 500 16 tabular, birim değerle birlikte ("15 cm", "58 HRC"). Grup gelmezse tek düz grup. `highlight` olanlar başlığın altında kısa liste. Boş: tablo yok.
- **Varyant seçici** (`options`, `variants`; `components/OptionPicker.tsx`, `Swatch.tsx`): gerçek radyo; 44 px kare çipler; renk değeri 44 px kare örnek + görünür ad ("Sap rengi: Kiremit"); seçili: 2 px `text` çerçeve + onay simgesi; tükenen değer çapraz çizgi + "(tükendi)" ve devre dışı.
- **Adet seçici** (`components/QuantityField.tsx`): − [n] + üçü de 44×44, `inputmode="numeric"`; sınırda düğme devre dışı; stok veya ek sınırı aşılınca alan hatası.
- **Mobil yapışkan sepete ekle çubuğu** (yalnız tema): < 1024'te ürün sayfasında satır içi "Sepete ekle" görünümden çıkınca belirir (betiksiz gösterilmez, satır içi düğme yeter). 64 px + güvenli alan, `paper`, üstte 2 px ink çizgi; solda fiyat (16/500) ve seçili varyant, sağda 48 px birincil. Ürün sayfasında alt gezinme ve WhatsApp düğmesi gizlenir; tek sabit alt öğe budur. Tükendi: "Gelince haber ver" (stok bildirimi formuna kaydırır).
- **Mini sepet çekmecesi** (`MiniCartView`; `layout/CartDrawer.tsx`, `cart/FreeShippingBar.tsx`): sağdan, masaüstünde 420 px, telefonda tam genişlik; başlık "Sepetim (N)" + 44 px kapat; ücretsiz kargo: "Ücretsiz kargo için 1.325,70 TL daha ekleyin" + 8 px çubuk (`signal` / `paper-3`, %5 adımlı sınıflar, satır içi `style` yok); eşik aşılınca `ok` renginde "Kargo ücretsiz". Satırlar salt okunur; ara toplam; "Ödemeye geç" birincil + "Sepete git" bağlantısı. Boş: "Sepetiniz boş." + "Alışverişe devam et".
- **Yorum kartı ve puan dağılımı** (`ReviewsView`; `components/ProductCommunity.tsx`, `ReviewsPage.tsx`): özet: ortalama Caslon 40 + yıldızlar (ekran okuyucuya "5 üzerinden 4,9") + "N değerlendirme"; dağılım 5→1 satır, 8 px çubuk, sayı tabular ⚑. Kart: yıldız, başlık 16/500, metin 6 satır + "Devamını oku" (44 px), ad, tarih, "Doğrulanmış alıcı" metni (nokta değil), fotoğraf ⚑. Yorum yoksa ana sayfa bölümü çizilmez; üründe "Henüz değerlendirme yok." + yazma/giriş bağlantısı. Yorum uydurulmaz: `[YORUM]` yalnız tasarım örneğinde.
- **Taksit tablosu** (`installments`; `components/InstallmentTable.tsx`): `<details>` özeti 44 px; açılınca sorulur: yükleniyor "Taksitler getiriliyor…"; tablo kart ailesi başına (Taksit · Aylık · Toplam, sağa yaslı tabular); hata "Taksit bilgisi şu an alınamadı." + "Yeniden dene"; boş "Bu ürün için taksit seçeneği yok."
- **Akordeon**: `<details>`/`<summary>` (içerik HTML'de), özet 48 px, artı/eksi simgesi, aralarda 1 px çizgi.
- **Kırıntı** (`breadcrumbs`; `components/Breadcrumbs.tsx`): masaüstünde tam yol, 14 px `text-3`; telefonda yalnız üst seviye "‹ El Yapımı Çakı" 44 px geri bağlantısı; son öğe bağlantı değil.
- **Sayfalama / daha fazla** (`pagination`; `components/Pages.tsx`): numaralı `?sayfa=N` bağlantıları 44 px kare (SEO, betiksiz); altında "Daha fazla ürün göster" bir sonraki sayfanın bağlantısıdır, betik varsa ekler (sonsuz kaydırma yok) ve "58 üründen 24'ü" der. Hata: "Ürünler yüklenemedi." + bağlantı.
- **Bildirim (toast)**: yalnız hata ve görünmeyen etki için (Hallmark 16): "Sepete eklendi" yok (çekmece açılır). Alt gezinmenin üstünde, bilgi `role="status"`, hata `role="alert"`, 5 sn, üzerine gelince ve odakta durur, 44 px kapat.
- **Form alanları ve doğrulama** (`checkout/fields.tsx`, `AddressForm.tsx`): etiket üstte (14/500), yer tutucu etiket değildir; yardım metni için `min-height: 1lh` ayrılır; isteğe bağlı alanlar "(isteğe bağlı)" yazar. Hata sunucu yanıtıyla aynı anahtardan; kenar 1 px kalır, rengi `error` olur. İl/ilçe/mahalle seçimleri yüklenirken "Yükleniyor…" ve devre dışı. Onay kutusu ve radyo 24 px kutu, 44 px satır.
- **Sabit WhatsApp düğmesi** (`whatsappHref`; `layout/WhatsAppButton.tsx`): 56×56 kare, `--color-whatsapp` (bugünkü `#1f9d55` literali gider), 24 px işaret, ad "WhatsApp'tan yazın"; sağ 16 px, alt gezinmenin 16 px üstü. `/odeme*`, `/sepet`, ürün sayfası ve açık çekmece/alt sayfada gizli (bugün ödeme ve sepet alanlarını örtüyor). Numara yoksa çizilmez.
- **Alt gezinme** (`bottomNav`; `layout/BottomNav.tsx`): 56 px + güvenli alan, 5 öğe, etiket 12 px; bulunulan öğe 2 px ink üst çizgi + 500 + `aria-current`. Cam bulanıklığı yok, düz `paper`.
- **Çerez bandı** (`cookieBanner`; `layout/CookieBanner.tsx`): telefonda ekranın ≤ %35'i; "Tümünü kabul et" ve "Yalnızca zorunlu" aynı biçimde; sunucuda çizilir.
- **Alt bilgi** (`ShopView`; `layout/SiteFooter.tsx`): mast: koyu bant, büyük ad/logo (Caslon 48–72) bağlantıların üstünde; sütunlar alt bilgi menülerinden, başlıklar 14/500 cümle düzeni; telefonda 2 sütun, bağlantılar 44 px; iletişim (telefon, e-posta, adres, saatler), sosyal (yazıyla), e-bülten kutusu (açıksa, İYS çift onay metniyle). Alt şerit: kimlik satırları her biri kendi satırında (nokta yok), ETBİS karekodu yuvası ⚑, izinli ödeme işaretleri ⚑, yasal bağlantılar, "© 2026 My L'arte". Doğrulanmamış "256-bit SSL" cümlesi kalkar.

## Sector rules (generic)
- **Teknik özellikler** şablondan gelir; tema yalnız `SpecView` gruplarını çizer. İlk müşterinin şablonu (panelde veri, kod değil): *Namlu*: Çelik türü (seçim; eski sitedeki terimler: 4116, N690, M390, Elmax, Damascus, CK…), Sertlik (sayı, HRC), Namlu uzunluğu (cm), Namlu kalınlığı (mm) · *Ölçü ve ağırlık*: Toplam uzunluk (cm), Ağırlık (g) · *Sap ve kılıf*: Sap malzemesi (seçim), Kılıf (seçim) · *Üretim*: Menşei / üretici (metin). Filtre: çelik türü, sap malzemesi, namlu uzunluğu; SEO öne çıkan: çelik türü, namlu uzunluğu. Bugün bu değerler açıklama HTML'inde; taşımada özniteliğe çevrilir.
- **Bakım ve kullanım notu**: `paper-2` kuyu, üstte 2 px ink çizgi, başlık "Bakım ve kullanım", gövde sahibin metni (kategori `rich_text` bölümü ya da ürün içerik belgesi; görünüm ⚑ `variant: notice`). Yan renk şeridi yok. Metin yoksa çizilmez.
- **Yasal uyarı yuvası**: 14 px `text-2`, üstte 1 px çizgi; metin sahibinden `[YASAL METİN]` ⚑, kısıtlı üründe sepete ekle altında ve ödemede yaş kutusunun üstünde. Biz yazmayız; metin yoksa çizilmez.
- **Yaş / yasal beyan kutusu** (var: `checkout/PaymentForm.tsx`; `AGE_VERIFICATION` + kısıtlı ürün): ödeme adımında "Siparişi onayla"dan önce doğum tarihi + 44 px onay satırı, zorunlu; hata `checkout.age_required`.
- **Hediye paketi ve gravür** (adr/0052 ek seçenekleri; gravür bugün yazı eki olarak çalışıyor): seçim eki "İstemiyorum / Hediye paketi +X TL", yazı eki karakter sayacıyla ("12/50"), izinli karakter kuralı yazılı, "+35,00 TL" görünüm modelinden, cayma dışı uyarısı satın almadan önce. Mağaza tanımlamadıkça pasif.

## Variants
- Loom'dan sapmalar: vurgu marka mavisi; DM Mono yok (iki aile, yazı tipi bütçesi); değerler Caslon değil Hanken (Caslon 32 px altına inmez); ürün görsellerine Loom'un fotoğraf işlemi (`natural sat=-12 con=-4`) uygulanmaz, yalnız editoryal fotoğraflara; koyu mod Loom'un `indigo` renk yolu değil, sıcak koyu kâğıt (mavi vurguyla çakışmasın diye); semantik indirim kırmızısı yalnız fiyat ve rozette (Loom'un "sıcak vurgu yok" kuralı süs için).

## Exports
`tokens.css` tema paketinde. Sözleşme adlarına bağlantı (temanın `styles.css`'i):
```css
:root {
  --background: var(--color-paper); --foreground: var(--color-text);
  --card: var(--color-paper-2); --card-foreground: var(--color-text);
  --popover: var(--color-field); --popover-foreground: var(--color-text);
  --primary: var(--color-signal); --primary-foreground: var(--color-signal-ink);
  --secondary: var(--color-paper-3); --secondary-foreground: var(--color-text-2);
  --muted: var(--color-paper-2); --muted-foreground: var(--color-text-3);
  --accent: var(--color-paper-2); --accent-foreground: var(--color-text);
  --destructive: var(--color-error); --border: var(--color-rule); --input: var(--color-edge); --ring: var(--color-focus);
  --sale: var(--color-discount); --sale-foreground: var(--color-discount-ink); --success: var(--color-ok);
  --announcement: var(--color-signal); --announcement-foreground: var(--color-signal-ink);
  --highlight: var(--color-signal); --highlight-foreground: var(--color-signal-ink);
  --ink: var(--color-band); --ink-foreground: var(--color-band-text); --ink-muted: var(--color-band-text-2);
  --radius: 0px; --radius-scale: 0; --button-radius: 0px;
}
```
Mağazanın `--primary` ezmesi (adr/0053 §B) `--color-signal`'e akar; koyu mod ezmesi yok (S9).

## Deal: üç tema (sahip seçer)
`node ~/.claude/skills/hallmark/scripts/theme.mjs deal --genre editorial --prompt "A mobile-first e-commerce shop for handmade knives, pocket knives and swords, plus sheaths, sharpening and care accessories: trust in the first second, categories up front, product photography of blades, a technical specifications table on every product, Turkish copy, prices in TL, nobody gets lost."`

| # | Tema | Resim | Malzeme | Bu iş için |
| --- | --- | --- | --- | --- |
| 1 | **Almanac** | `/Users/deniz/.claude/skills/hallmark/references/themes/almanac.jpg` | soğuk arduvaz kâğıt, mavi-siyah mürekkep, Hanken Grotesk başlık, Newsreader metin, mono rakamlar, iki çizgi kalınlığı, kare köşe, tek macenta | Tablo ve teknik özellik için birebir; ama koyu ürün fotoğrafları arduvazda ağırlaşır, "muted" fotoğraf işlemi sap renklerini soldurur, mağazadan çok başvuru kitabı gibi okunur. İkinci tercih. |
| 2 | **Riso** | `/Users/deniz/.claude/skills/hallmark/references/themes/riso.jpg` | parlak kâğıt, mavi ve floresan pembe iki mürekkep, gren, bir kelime kaymış, Cabinet Grotesk 800 + Literata | "El yapımı" kelimesine uyuyor; floresan pembe, kasıtlı baskı kayması ve duotone fotoğraf (ürün rengini bozar) bıçak mağazasında ilk saniyede güveni zayıflatır. Önerilmez. |
| 3 | **Loom** | `/Users/deniz/.claude/skills/hallmark/references/themes/loom.jpg` | ecru kâğıt ve kum basamakları, sıcak koyu mürekkep, Libre Caslon Display başlık ve fiyat, Hanken Grotesk metin, ince çizgiler ve tek mürekkep çizgisi, kare köşe, tek koyu vurgu | **Öneri.** Kataloğun koyu ağaç ve deri zeminli fotoğrafları ecru üstünde çerçeveli nesne gibi durur; Range'indeki "cetvelli satırlarla özellik" brief'in teknik tablosunun kendisi; tek koyu vurgu marka mavisine (`#076599`) kayar; kare ve çizgili düzen ciddiyet ve güven verir. |

Not: dağıtım tohumu oturum klasöründeki tuzla üretildi; depodan yeniden dağıtılırsa başka el gelir. Seçilen tema inşada `theme: Loom (by request)` diye damgalanır.

## Picks
**Hallmark · v2.0.0**

- **Redesign** · full · ikinci tema paketi `packages/themes/<slug>` (base yerinde kalır) · 9 rota denetlendi
- **Before** · Floor 87 FAIL · Reflex 61 · WARN 34 · beyaz yuvarlak kartlar, izli büyük harf etiketler ve oklu düğmeler hazır şablon gibi; arama, sepet, ödeme akışı ve sözleşme sağlam, kalıyor
- **Keeps** · sözleşmenin her görünüm modeli, eylemi, bağlantısı, form alanı adı ve test kancası · marka: "My L'arte", birincil `#076599` (S1), logo (S2)
- **Files** · create: `packages/themes/atolye/src/*` (`styles.css`, `tokens.css`, `base.css`, `controls.css`, çerçeve, ana sayfa), `apps/storefront/src/themes/*` (adr/0057 seçim) · edit: `apps/storefront` `theme.ts`, `next.config.ts`, `app/layout.tsx`, `app/fonts.*`, `tr.json` (4 anahtar) · delete: yok (`app/globals.css` → `src/themes/base.css`)
- **Theme** · Loom, dealt 3/3 (ecru, sıcak mürekkep, Caslon + Hanken, kare, tek vurgu) · vurgu mağazanın tema ayarındaki birincil renk (dev'de mürdüm `#7a1a48`; yedek `#076599`), koyu kâğıtta aynı ton açılarak
- **Shape** · Index-First (Bento Grid'den, draw 30e00e; bento kategori görseli gelince döner) · genre editorial · job: buy, eylem ürünün yakın planından sonra teklif; telefonda yapışkan sepete ekle (ürün sayfası fazı)
- **Chrome** · nav: edge-aligned yerine arama öncelikli çubuk + mega menü (197 ürün, 48 kategori; brief görünür arama istiyor) · footer: mast, altında kimlik ve ETBİS satırı
- **Hero** · Stage: başlık, satır ve iki eylem; yanında mağazanın kendi ürün fotoğrafı (kare, 12'de 6 sütun); 1024 altında ilk altı kategori cetvelli satırlar (telefonda ilk ekranda) · ilk taslak Index/kategori bentosuydu: görselsiz kum kutular boş resim gibi okundu (hero-review: fix), bento kategori görselini bekliyor
- **Signature** · namlunun fotoğrafı ve hemen altında şablondan gelen cetvelli teknik satırlar: mağazanın kendi vaadi "Her modelde çelik, ölçü ve sap detayı yazılı"
- **Sections** · çizilen (mağazanın dev düzeni): Hero (Stage) · Kategoriler (kum bandında cetvelli dizin) · Raf (Yeni ürünler; yan yana ürün bölümleri sekme olur) · Yardım bandı · Rehberler (blog) · Footer (USP satırı + mast) · mağaza yerleştirince çizilir: USP şeridi (`trust_badges`), Yorumlar, SSS, e-bülten, afiş, markalar, zengin metin · veri yok, çizilmedi: Yakın plan (gruplu `SpecView`'lu öne çıkan ürün bölümü gerekir), puan dağılımı, müşteri fotoğrafları, kartta hızlı ekle · bu sefer yok: Split, Statement
- **Material** · real: ad, adres (Pamukkale/Denizli), telefon, WhatsApp, e-posta, saatler, 1.500 TL ücretsiz kargo eşiği, hafta içi 16:00'a kadar aynı gün kargo, 197 ürün, 48 kategori, 13 marka, 54 yazı, 28 yorum · pictures: kataloğun kendi ürün fotoğrafları (koyu ağaç kabuğu, deri, ahşap zemin) · absent: logo dosyası, kategori kapakları, elde/ölçekli ve atölye fotoğrafları, müşteri fotoğrafları, Instagram, ETBİS/MERSİS, ödeme işareti izni, satış rakamı `[RAKAM]`, garanti ifadesinin doğrusu
- **Sweep** · sloplint --render `/` (390–1920): Floor 0 FAIL · Reflex 0 açık (1 waived: 83, mağazanın kendi kataloğu %38) · WARN 0 (dismissed: 58 çerez bildirimi ve alt bilgi pencereleri, 42 mast, 54 SectionHead) · hero-review: fix · 5 bulgu · 3 çözüldü 1 kısmi 1 açık (başlık mağaza verisi) · finish-review: subagent · fix · 6 bulgu · 2 çözüldü (rafta ve rehberlerde madde başlığı boyu ve mürekkep çizgisi; dolgulu düğme + metin bağlantısı çifti, yardım cetvelli satırlar) 1 kısmi (koyu modda vurgu daha az açılıyor, L %66) 1 açık (raf dört sütunda bir pencerede ~110 kelime: kapı 58 Floor, üç sütun kaldı) · 2 mağaza verisi (bir blog kapağı, varsayılan bölüm başlıkları)
