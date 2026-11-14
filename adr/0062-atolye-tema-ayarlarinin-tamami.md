# ADR-0062: Atölye bütün tema ayarlarını uygular; Grafit kayıtlı varsayılandır

- **Durum:** Kabul edildi (2026-11-14, sahip)
- **Tarih:** 2026-11-14
- **İlgili:** adr/0053 §B (tema ayarları; §B.1 varsayılanlar ve §B.2 zemin tablosu değişir), adr/0057 karar 3 ve Ek 2026-11-09 (değişir), adr/0046 §7 (tema sözleşmesi), adr/0049 (tema düzenleyici), `design.md` (yön "Grafit"), `docs/tema/atolye-tamamlama-plani.md` (Faz 1; sahip kararı 2), `docs/tema/atolye-eksik-denetimi-2026-11-14.md` §1, docs/21 (yazı tipi bütçesi), adr/0063 (hazır görünümler)

## Bağlam

- Panelin "Tema ayarları" formu on üç alan gösteriyor (`apps/backend/src/modules/platform-settings/sections/theme.ts`), Atölye bunlardan dördünü uyguluyor. Kararı veren kod `apps/storefront/src/themes/atolye.ts` `atolyeSettings`: vurguyu `null`'a, zemini `warm`'a, yazı tipini, köşeyi ve düğmeyi `DEFAULT_THEME`'e sabitliyor; `fontPreloads` hep Manrope. Bu, adr/0057 karar 3'ün (sahip, 2026-11-04) uygulamasıdır.
- Sahip (2026-11-14, plan karar 2): "hepsi vitrinde çalışır. Bugünkü Grafit tasarımının kuralları panelde kayıtlı varsayılan olur … kimse bir şey değiştirmezse vitrin aynı kalır. Gerekirse seçenek listelerine Grafit değerleri eklenir."
- Kodda doğrulanan durum (denetim §1 ile birlikte):

  | Ayar | Bugün | Kanıt |
  | --- | --- | --- |
  | `colors.primary` | uygulanıyor | vitrin `--primary` basar, `tokens.css` `--color-signal: var(--primary)`; yedek `styles.css` `--primary: oklch(36% 0.12 350)` |
  | `colors.accent` | atılıyor | `--highlight` `styles.css`'te sinyale bağlı; Atölye'nin hiçbir `.tsx`/`.css` dosyası `highlight` okumuyor |
  | `colors.background` | `warm`'a sabit | bileşenler `--background` değil `paper`, `paper-2`, `paper-3` okuyor; şemadaki `warm` `#f6f4ef` Atölye'nin boyadığı zemin değil (`--color-paper: oklch(98.4% 0.003 250)`) |
  | `typography` | atılıyor | `tokens.css:79-80` iki yüzü de `--font-manrope`'a bağlar |
  | `radius` | atılıyor | `tokens.css:82-85` sabit px (20 / 14 / 10 / 999); `--radius-scale` yalnız `packages/ui/src/styles.css:48-53`'teki sözleşme köşelerini çarpar |
  | `buttons` | atılıyor | `.gf-btn` `--radius-pill` okur (`ui.css:33`); sözleşmenin `--radius-button`'ı (`packages/ui/src/styles.css:55`) Atölye'de kullanılmıyor |
  | `product_card.ratio` | hatalı | `lib/views/theme.ts` `CARD_RATIO["4:5"] = null` hiçbir şey basmaz, Atölye'nin `--card-ratio: 1 / 1`'i (`styles.css:80`) kalır: varsayılan 4:5 kare çizilir |
  | `show_brand`, `header.sticky` | uygulanıyor | `Header.tsx:76` |
  | `show_rating` | ölü | `ProductCard.tsx:122` puanı çizer ama `ProductCardView.rating`'i dolduran yok; `StoreCardFacts` puan taşımıyor |
  | `header.layout` | yok sayılıyor | Atölye'de `layout` okuyan satır yok; yazı markası hep solda (`Header.tsx:95`), varsayılan ise `centered` |

- Sonuç: panel bugün gerçeği göstermiyor. Varsayılanlar ilk temanın görünümü (Fraunces / Inter, sıcak zemin, ortalanmış üst bilgi, 4:5 kart), vitrin ise Manrope, çelik beyazı, solda yazı markası ve kare kart çiziyor.
- **Saklanan değerler:** `saveSection` bölümü bütün olarak yazar (`parseStored` → `mergePatch`). Tema bölümünü bir kez kaydetmiş (ör. yalnız ana rengi değiştirmiş) her mağazanın satırında eski varsayılanlar (`fraunces`, `inter`, `centered`, `4:5`, `warm`) açıkça durur. Ayarlar uygulanmaya başladığı an bu mağazaların vitrini kimse bir şey değiştirmeden değişirdi.

## Karar

1. **Atölye `theme` bölümünün bütün alanlarını uygular.** `atolyeSettings` kalkar; tema girişi ayarları olduğu gibi alır. adr/0057 karar 3'ün Atölye satırı ve adr/0053 §B.1'in varsayılan sütunu bu ADR'la değişir. Kural aynı kalır: ayarlar sabit listelerden seçimdir, serbest CSS yok; varsayılanlarda vitrin hiçbir şey basmaz, temanın kendi değerleri geçerlidir (`themeStyle` `null` döner).

2. **Varsayılanlar bugünkü Grafit görünümüdür** (backend `themeSection` ve vitrin `DEFAULT_THEME`; ikisi eşit kalmalı, testli):

   | Alan | Eski varsayılan | Yeni varsayılan | Not |
   | --- | --- | --- | --- |
   | `colors.primary` | `null` | `null` | `null` = temanın şarap tonu; panel bunu örnek renk olarak gösterir (sahip kararı 1) |
   | `colors.accent` | `null` | `null` | `null` = ana renk (bugünkü `--highlight`) |
   | `colors.background` | `warm` | **`steel`** (yeni değer) | Grafit'in tezgâhı; listede karşılığı yoktu |
   | `typography.heading` | `fraunces` | **`manrope`** | listede var |
   | `typography.body` | `inter` | **`manrope`** | listede var |
   | `radius` | `soft` | `soft` | `soft` = çarpan 1 = Grafit'in 20 / 14 / 10 px'i; yeni değer gerekmez |
   | `buttons` | `pill` | `pill` | Grafit zaten hap |
   | `product_card.ratio` | `4:5` | **`1:1`** | Atölye bugün kare çiziyor |
   | `product_card.show_brand` | `true` | `true` | |
   | `product_card.show_rating` | `false` | `false` | bugün kartta puan yok; açmak mağazanın seçimi |
   | `header.layout` | `centered` | **`left`** | bugünkü yerleşim |
   | `header.sticky` | `true` | `true` | |

3. **Seçenek listeleri.** Tek ekleme: `colors.background`'a `steel`. `THEME_BACKGROUNDS.steel` Atölye'nin `--color-paper`'ının sRGB karşılığıdır (bu ADR için hesaplanan değer `#f8fafc`; uygulamada token'dan üretilir ve backend, vitrin, panel kopyalarının eşitliği testle sabitlenir). `warm`, `neutral`, `cool` bugünkü değerleriyle kalır. Köşe, düğme, yazı tipi ve oran listeleri değişmez.

4. **Saklanan eski satırlar: okuma anında eşleme, göç yok.** Bölüme panelin göstermediği `settings_version` alanı eklenir (varsayılan ve tek geçerli değer `2`). Saklanan satırda bu alan yoksa satır bu ADR'dan önce yazılmıştır ve Atölye'nin yok saydığı alanları hiç görünmemiştir; `parseStored`'dan önce çalışan bir bölüm ön işlemi (bugün `REMOVED_THEMES` için `theme` alanında olan desenin bölüm düzeyine taşınmışı) bunları Grafit'e çeker:
   - korunur: `colors.primary`, `product_card.show_brand`, `header.sticky`, `product_card.ratio` `1:1` ve `3:4`;
   - Grafit'e çekilir: `colors.accent` → `null`, `colors.background` → `steel`, `typography` → `manrope` / `manrope`, `radius` → `soft`, `buttons` → `pill`, `header.layout` → `left`, `product_card.show_rating` → `false`, `product_card.ratio` `4:5` → `1:1` (kare çiziliyordu).

   Satır bir sonraki kayıtta `settings_version: 2` ile yeniden yazılır; ondan sonra her alan mağazanın seçimidir. `defineSection` isteğe bağlı bir `upgrade(stored)` alır; başka bölüm etkilenmez. Mağaza profilleri: depodaki tek profil (`docs/gecis/mylarte/profil/profil.json`) `theme` bölümü yazmıyor; yazan bir profil yeni anlamla okunur.

5. **Zemin tonu.** Zemin yalnız `--background` değil, Atölye'nin yüzey ailesidir. Her ton için tema bir küme tanımlar: `paper`, `paper-2`, `paper-3`, `field`, `chip`, `rule` (Grafit'in açıklık basamaklarıyla: 98,4 / 95,6 / 91,6). Küme tema paketinde veridir; `steel` dışındaki tonda tema girişi bu değişkenleri `:root`'ta basar (`--primary`'nin bugün basıldığı yol). `signal-soft` zaten `paper` ile karışım olduğundan kendiliğinden uyar. Grafit sahneler (`stage*`) tona bağlanmaz.

6. **Karşıtlık (adr/0053 §B.3) gerçek zemine göre.** `primaryReadable` ana rengi beyazla ve seçilen tonun `paper` **ve** `paper-2` değeriyle en az 3:1 ister (bağlantı ve çerçeve kuyuda da durur). Temanın sabit mürekkepleri (`text`, `text-2`, `text-3`, `placeholder`, `edge`) dört tonun her yüzeyinde ölçülür; 4,5:1'i tutmayan ton kümesi düzeltilir, tutturulamayan ton listeden çıkar. Ölçüm birim testidir. Vurgu denetlenmez; üstündeki yazı `readableOn` ile seçilir (bugünkü kod).

7. **Yazı tipleri.**
   - `tokens.css`'te `--font-display` ve `--font-body` sözleşmenin `--font-heading` ve `--font-sans`'ını okur; `styles.css`'teki ters bağ kalkar, yedek Manrope kalır. Vitrinin bastığı adlar değişmez.
   - **Önyükleme:** tema girişi `app/fonts.ts`'teki `fontPreloads(settings)`'i kullanır (gövde, sonra başlık; aynıysa bir kez). Dosya boylarından ölçülen: varsayılan Manrope 26,9 KB; en ağır çift Fraunces + Inter 124 968 bayt. Bütçe ≤ 125 KB (docs/21, `docs/tema/design.md:77`) her çift için birim testiyle sabitlenir; listeye bütçeyi aşan yüz eklenemez.
   - **Başlık ağırlığı:** `--display-weight` bugün sabit 800 ve `font-synthesis: none` (`base.css:26`). `dm-serif` tek ağırlık (400, `app/fonts.css:110`). Ağırlık yüzün tablosuna taşınır (`THEME_FONTS`'a `displayWeight`); 800'den farklıysa basılır. `dm-serif` 400, diğerleri kendi aralığındaki en yakın koyu ağırlık.
   - **₺:** `playfair` ve `dm-serif` dosyalarında ₺ yok (`app/fonts.css:88` ve `:117`), ikisi de yalnız başlık listesinde. Kural: fiyat, toplam ve tutar içeren her satır gövde yüzüyle çizilir (dört gövde yüzünün Türkçe dosyası `U+20BA` taşır); başlık yüzüyle fiyat çizen yer işte bulunup düzeltilir ve testle kilitlenir. Mağazanın kendi başlık metnindeki ₺ yedek yüzle çizilir; panel bu iki yüzün altında bunu söyler (sahip kararı 3).
   - **Kalıntı:** `THEME_OWN_FONT_FILES` (Caslon, Hanken), `public/fonts`'taki altı dosyası ve `app/fonts.css`'teki bildirimleri silinir.

8. **Köşeler ve düğmeler.**
   - `--radius-tile`, `--radius-media`, `--radius-inner` `calc(<px> * var(--radius-scale))` olur; `sharp` 0,2 ve `round` 1,5 çarpanları (`RADIUS_SCALE`) aynen kalır. `--radius-pill` çarpılmaz.
   - Düğme ile çip ayrılır: `.gf-btn` ve düğme gibi bağlantılar sözleşmenin var olan `--radius-button`'ını okur (kaynağı `--button-radius`; yeni token gerekmez). Çip, rozet ve durum hapları `--radius-pill`'de kalır. `ui.css`'teki diğer `--radius-pill` kullanımlarından hangilerinin kontrol olduğu işte ayrılır; arama alanı, form alanları ve adet hapı düğmeyle birlikte değişir (sahip kararı 4).

9. **Kart.** `CARD_RATIO` her değeri yeni varsayılana göre basar: `1:1` → hiçbir şey, `4:5` → `4 / 5`, `3:4` → `3 / 4`. Hata böyle kapanır. **Puan:** `GET /store/card-facts` yanıtına `rating: { average, count } | null` eklenir (kaynak `product-reviews` modülünün ürün puanı; yorumu olmayan üründe `null`); vitrin `show_rating` açıkken `ProductCardView.rating`'i doldurur, kapalıyken alanı hiç istemez. Kartın çizimi hazır.

10. **Üst bilgi.** `left` bugünkü düzendir. `centered`: yazı markası ortada, arama ve hesap/sepet iki yanda; telefonda fark yoktur. Yapışkan kapalıyken sayfalardaki yapışkan sütunların `top-40` boşluğu (12 kullanım) başlık yüksekliğini taşıyan bir değişkene bağlanır. `centered` çizimi `design.md`'ye yazılır; iş ayrı dalda yapılır ve sahip görüp onaylamadan `dev`'e girmez (sahip kararı 6).

11. **Vurgu rengi.** Atölye bilgi rozetlerinde ve vurgu yüzeylerinde `--highlight` / `--highlight-foreground` okur. İndirim kırmızısı (`--color-deal`), stok ve hata renkleri vurguya bağlanmaz. Duyuru şeridi grafit sahne kalır (`Announcement.tsx:31`); şemadaki "duyuru şeridi ana rengi alır" yorumu düzeltilir (sahip kararı 5).

12. **Panel.** Form gerçeği gösterir: ana renk boşken örnek renk temanın şarabı; `ThemeSample` (`theme-fields.tsx`) duyuru satırını grafit, düğmeyi seçilen biçimde, başlık ve gövdeyi seçilen yüzle, kartı seçilen oranla çizer; zemin listesi `steel`'i taşır (`apps/panel/src/theme/storefront.ts`); ipuçlarından "bu temada uygulanmaz" anlamı taşıyanlar kalkar; "Grafit'e dön" bütün alanları varsayılana çeker. Kayıt, adr/0063 işi 2.1 tamamlanana kadar bugünkü gibi hemen yayına girer; sonra tema ayarı "Yayınla" ile yayına girer (sahip kararı 8).

## Alternatifler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Bütün ayarlar uygulanır, Grafit varsayılan, eski satırlar okurken eşlenir (seçilen)** | Panel gerçeği gösterir; dokunulmayan mağaza aynı kalır; göç betiği yok | Bölümde panelin göstermediği bir sürüm alanı; ön işlem kalıcı kod |
| Bugünkü gibi: Atölye dört alanı alır, panel diğerlerini gizler | Grafit kimliği bozulamaz | Sahip kararına aykırı; hazır görünümler (adr/0063) ayar farkı taşıyamaz |
| Varsayılanları değiştirmeden uygulamak | En az kod | Her mağaza Fraunces, ortalanmış başlık ve sıcak zemine döner |
| Saklanan satırları migration ile yeniden yazmak | Sürüm alanı gerekmez | Eşleme SQL'de ikinci kez yazılır; denetim kaydına girmez; ayar bölümlerinde bugüne dek göç kullanılmadı (adr/0057 Ek, adr/0049 Ek 2026-11-06) |
| `cool`'u Grafit'in değerine çekmek (`steel` eklememek) | Liste büyümez | `cool` seçmiş mağazanın zemini değişir; adın anlamı kayar |
| Köşeye `grafit` adlı dördüncü değer | Ad açık | `soft` zaten çarpan 1; iki değer aynı şeyi çizer |
| Ana rengi varsayılanda hex olarak yazmak | Panel alanı dolu açılır | Temanın oklch tonu ikinci yerde kopyalanır; `storefront.primary_color` yedeği (adr/0053 §B.5) ölür |

## Sonuçlar

- **Değişen dosyalar (özet):** backend `sections/theme.ts`, `sections/define.ts` + `stored.ts` (`upgrade`), `workflows/storefront/card-facts.ts`; `@qticaret/types` (`ThemeBackground`, `StoreCardFacts`); vitrin `themes/atolye.ts`, `lib/views/theme.ts`, `app/fonts.ts`, `app/fonts.css`; tema `tokens.css`, `styles.css`, `ui.css`, `frame/Header.tsx`, kart ve rozet parçaları; panel `theme-fields.tsx`, `theme-form.tsx`, `theme/storefront.ts`.
- **Eski davranışı sabitleyen testler (yeniden yazılır):** vitrin `themes/__tests__/choice.spec.ts` ("prints the shop's main colour and the cards' shape, nothing of faces, corners or page colour"), `app/__tests__/fonts.spec.ts`, `lib/views/__tests__/theme.spec.ts`, `lib/__tests__/atolye-frame-theme.spec.ts`, `test/theme-render.ts`; backend `modules/platform-settings/__tests__/theme-section.unit.spec.ts` ("starts as today's look"), `integration-tests/http/theme-settings.spec.ts`; panel `features/storefront/editor/theme-panel.spec.tsx`, `features/storefront/theme-settings.spec.ts`.
- **Yeni testler:** varsayılanda `style` `null` (vitrin baytı baytına aynı); sürümsüz satırın eşlemesi (her alan); her yazı tipi çiftinin önyükleme toplamı; her ton için karşıtlık tablosu; 4:5'in basılması; card-facts puanı (yorumsuz, yayında olmayan ürün).
- **Belgeler:** adr/0057 karar 3 ve adr/0053 §B.1–B.2'ye "adr/0062 ile değişti" notu; docs/19 §10; `design.md`'ye "ayarlarla değişenler" bölümü ve ortalanmış üst bilgi.
- **Riskler:** serif başlık ve keskin köşe Grafit kimliğini zayıflatabilir (denetim); karar sahibindir, panel "Grafit'e dön" ile geri alır. Zemin tonları sayfa sayfa gözle doğrulanmalı (kuyu, çizgi, yarı saydam katmanlar). CSS boyu docs/21 bütçesine göre yeniden ölçülür.
- **Varsayım (doğrulanmadı):** yapışkan kapalıyken `top-40` boşluğu denetimin çıkarımıdır, ekranda görülmedi. `steel`'in hex değeri taslakta elle çevrilmişti; iş 1'de token'dan hesaplanarak doğrulandı (Ek 2026-11-14).

## Sahip kararları (2026-11-14)

Sahip iki ADR'ı birlikte onayladı ("önerilerle ilerle"). Taslaktaki açık sorular aşağıdaki kararlara dönüştü; metindeki "sahip kararı N" bu listeyi gösterir.

1. **Ana renk varsayılanı `null` kalır.** Panel temanın şarap tonunu örnek renk olarak gösterir; "kendi rengini seç" alanı boş açılır. Hex varsayılan yazılmaz.
2. **Sürümsüz eski satırlarda yok sayılan alanlar Grafit'e çekilir** (karar 4'teki eşleme). Bilinçli seçilmiş ama hiç görünmemiş bir vurgu ya da yazı tipi seçimi bu yüzden kaybolur; "kimse dokunmazsa aynı kalır" bunu gerektirir.
3. **₺'si olmayan iki başlık yüzü (`playfair`, `dm-serif`) listede kalır.** Fiyatlar gövde yüzüyle çizilir, panel bu iki yüzün altında uyarır.
4. **Düğme biçimi arama alanını, form alanlarını ve adet hapını da değiştirir.** Çip ve rozetler hap kalır.
5. **Vurgu rengi** bilgi rozetlerinde ("Yeni", öne çıkan), seçili çipte ve vurgu yüzeylerinde görünür. İndirim kırmızısı ve stok renkleri sabittir; duyuru şeridi grafit kalır.
6. **Ortalanmış üst bilgi ayrı dalda yapılır;** sahip vitrinde görüp onayladıktan sonra `dev`'e girer. O güne kadar `header.layout: "centered"` kaydedilebilir ama Atölye `left` çizer.
7. **`steel`'in paneldeki adı** "Çelik beyazı (Grafit)".
8. **Yayın anı (sahip, adr/0063 karar 1 ile birlikte):** tema ayarı "Yayınla" ile yayına girer (taslak → önizleme → yayın). Karar 12'deki "kayıt hemen yayında" davranışı yalnız adr/0063 işi 2.1 tamamlanana kadar geçerlidir.

## Uygulama sırası (Faz 1)

| # | İş | Boyut | Ajan |
| --- | --- | --- | --- |
| 1 | Şema: yeni varsayılanlar, `steel`, `settings_version` + `upgrade`; tipler; vitrin `DEFAULT_THEME`; `atolyeSettings` kalkar; kart oranı düzeltmesi (plan 1.1) | S | T1 |
| 2 | Yazı tipleri: token bağı, önyükleme, başlık ağırlığı, ₺ kuralı, Caslon/Hanken temizliği (1.2) | M | T1 |
| 3 | Köşeler `--radius-scale`'e (1.3) | M | T1 |
| 4 | Düğme `--radius-button`'a, çip ayrımı (1.4) | M | T1 |
| 5 | Zemin tonu kümeleri, karşıtlık ölçümü ve kuralı (1.5) | M-L | T1 |
| 6 | Vurgu rengi tüketicileri (1.6) | S-M | T1 |
| 7 | Üst bilgi `centered`, yapışkan boşluğu (1.7) | L | T2 |
| 8 | Kart puanı: card-facts + vitrin (1.8) | M | T3 |
| 9 | Panel: ipuçları, `ThemeSample`, `steel`, "Grafit'e dön" (1.9) | M | T4 |
| 10 | Testler, CSS ve önyükleme ölçümü, belgeler (1.10) | S | T1–T4 |

1–6 aynı CSS ve token dosyalarına dokunduğu için tek ajanda ve bu sırayla; 7, 8, 9 paralel. 1. iş diğerlerinin önkoşuludur: varsayılanlar ve eşleme yerinde olmadan hiçbir ayar vitrine bağlanmaz.

## Ek (2026-11-14): iş 1 uygulandı (şema, varsayılanlar, eşleme)

- **`steel` nasıl türetildi:** `packages/themes/atolye/src/tokens.css` `--color-paper: oklch(98.4% 0.003 250)`, CSS Color 4 yoluyla (OKLCH → OKLab → doğrusal sRGB → gama, kanal başına 8 bit yuvarlama) sRGB'ye çevrildi: kanallar 248,21 / 249,89 / 251,70 → `#f8fafc`. Renk sRGB gamı içinde, kırpma yok. Vitrinin `lib/views/__tests__/theme.spec.ts` testi token'ı stil dosyasından okuyup aynı dönüşümle `THEME_BACKGROUNDS.steel`'e eşitliyor; backend ve panel testleri dört değeri sabitliyor. Token değişirse vitrin testi düşer.
- **Sürüm alanı:** `settings_version` (tek geçerli değer `2`) bölümün şemasında ve varsayılanında; `defineSection` isteğe bağlı `upgrade(stored)` alır, `parseStored` saklanan satırı şemadan önce ondan geçirir (her okuma: önbellek, `readSection`, kayıttaki "önce" değeri). Alan `GET /store/storefront` yanıtına girmez; yönetici ucunda görünür, panel göndermez.
- **Karşıtlık:** `primaryReadable` beyaza ve seçilen tonun `THEME_BACKGROUNDS` değerine (her tonun `paper`'ı; `steel` artık gerçek zemin) göre ölçer. Karar 6'daki `paper-2` (kuyu) koşulu ton kümeleriyle birlikte iş 5'te gelir: kümeler o işte tanımlanıyor. `steel` dört tonun en açığı olduğundan eski zemininde geçmiş bir ana renk eşlemeden sonra da geçer (testli). İş 5'e not: `paper-2` koşulu eklenince sınırdaki eski renkler okuma anında düşebilir; kural okuma yerine yalnız kayıtta uygulanmalı ya da eşik buna göre seçilmelidir.
- **Kapsam dışı bırakılan:** `atolyeSettings` süzgeci bu işte kaldırılmadı (CSS ve token'lar ayarları okuyana kadar durur; sıradaki iş). Süzgeç artık zemini `steel`'e sabitliyor. Vitrin varsayılanda, eski satırlarda ve satır yokken bayt bayt aynı stili basıyor (`null` ya da yalnız ana renk ve 3:4 oranı).
- **Kart oranı:** `CARD_RATIO` `1:1` için hiçbir şey, `4:5` için `4 / 5` basar. Bu işten sonra bilerek `4:5` kaydeden mağazanın kartı 4:5 çizilir (karar 9).
- **`warm` tonunun sözleşme renkleri:** vitrinin `NEUTRALS` tablosunda `warm` artık varsayılan olmadığı için silinen ilk temanın değerleriyle (`#ece8e0`, `#e2ddd2`, `#d3cdbf`, `#5c574d`) yer alıyor; iş 5'te temanın ton kümeleri bunların yerini alır.

## Ek (2026-11-14): iş 2–7 uygulandı (yazı tipi, köşe, düğme, zemin, vurgu)

`atolyeSettings` süzgeci kalktı; tema girişi ayarları olduğu gibi alır. Varsayılanda, satır yokken ve eşlenmiş eski satırda basılan stil değişmedi (`null` ya da yalnız ana renk ve oran); derlenmiş CSS'te `:root` değişkenlerinin çözülmüş değerleri önceki derlemeyle aynı (158'in 155'i; kalan üçü silinen `signal-soft`, `--font-caslon`, `--font-hanken`). Karar metninden sapmalar ve açık bırakılanlarda seçilenler:

- **Zemin kümeleri (karar 5).** "98,4 / 95,6 / 91,6" mutlak açıklık olarak uygulanmadı: karar 3 ve 6 her tonun `paper`'ını `THEME_BACKGROUNDS` değeri (ör. `warm` `#f6f4ef`, L 96,7) olarak ister. Küme, tonun `paper`'ından Grafit'in OKLCH **basamaklarıyla** türetildi (L −2,8 / −6,8 / +1,0 / +0,2 / −8,9; kroma aynı oranlarla, ton korunur). Veri `packages/themes/atolye/src/tones.ts`; `steel` token'ların kendisidir ve basılmaz. Vitrinin `NEUTRALS` tablosu ve `--background` basımı kalktı: sözleşme adları Atölye'de token'ları izliyor.
- **Karşıtlık ölçümü (karar 6).** "Beş mürekkep her yüzeyde 4,5:1" Grafit'in kendi `steel` kümesinde de tutmuyor (`edge` zeminde 4,08; örnek metin `paper-2`'de 4,46). Ölçüm, mürekkebin çizildiği yere ve WCAG'nin o parça için istediğine göre yazıldı: `text` / `text-2` / `text-3` beş yüzeyde ≥ 4,5:1 (en düşük 5,28, `warm` `paper-3`); örnek metin yalnız çizildiği `field` üstünde ≥ 4,5:1 (en düşük 4,73); `edge` kontrol kenarıdır, ≥ 3:1 (§1.4.11; en düşük 3,15). Dört ton da geçti, listeden çıkan ton yok.
- **`paper-2` kuralı (karar 6, iş 1 notu).** Okumaya eklenmedi: sınırdaki eski bir ana renk okurken düşer ve mağazanın rengi kendiliğinden kaybolurdu. Kural **yalnız kayıtta** ve yalnız ana rengi ya da zemini değiştiren kayıtta sorulur (`defineSection`'a isteğe bağlı `saveIssue(after, before)`; `themeSaveIssue`, `THEME_WELLS`). Eski satır olduğu gibi okunur, başka alanları kaydedilebilir; rengi ya da zemini değiştirdiği anda kuyuda 3:1 istenir. Panelin ön denetimi (`apps/panel/src/theme/storefront.ts` `primaryReadable`) henüz kuyuyu bilmiyor: sınırdaki renkte uyarı sunucudan gelir (iş 9'a not).
- **Başlık ağırlığı (karar 7).** `THEME_FONTS.displayWeight`; yalnız `dm-serif` 400 basar. Bileşenlerdeki 74 `font-extrabold` sınıfı değiştirilmedi: çoğu gövde yüzüyle çizilen tutar ve etikettir; başlıkta olanlar tek ağırlıklı yüzde tarayıcının eşlemesiyle 400 çizilir (`font-synthesis: none`, sahte kalın yok). Ekranda doğrulandı.
- **₺ (karar 7).** Vitrin tutarları "1.250,00 TL" yazar (`formatLira`), ₺ basmaz. Kural yine kilitlendi: başlık yüzü yalnız `h1`–`h3`, raf sekmeleri ve yazı markasında; hiçbir başlığın içinde tutar yok (kaynak taraması, `atolye-price-face.spec.ts`). Düzeltilecek yer çıkmadı.
- **Düğme (karar 8).** `--button-radius` `square` için `0px` basar (birimsiz `0`, `min()` içinde uzunlukla karşılaştırılamaz). Zaten hap olmayan kutu alanlar (metin kutuları, ürün formu alanları) `min(--button-radius, --radius-inner)` alır: varsayılanda bugünkü 10 px, karede 0. Yüzen WhatsApp düğmesi, kaydırıcı okları ve sayfalama da düğme sayıldı. Süzgeç onay kutusunun 6 px köşesi köşe çarpanını izler, 6 px'i geçmez (yuvarlakta radyo düğmesine benzemesin).
- **Vurgu (karar 11, sahip kararı 5).** Atölye'de "Yeni" / öne çıkan rozeti yok; karttaki rozetler indirim ve stoktur, sabit kaldı. Vurgu şuralara bağlandı: not ve vurgu yüzeyleri (`signal-soft` → `highlight-soft`, 11 yer), seçili çip (`.gf-chip`, raf sekmesi, seçenek ve taksit çipleri, fatura türü), etkin süzgeç çipleri ve süzgeç sayacı. Seçili çip bugün grafit olduğu için `--highlight`'ı doğrudan okuyamaz (vurgu yokken `--highlight` ana renktir, çipler şaraba dönerdi): temanın `--color-mark` / `-mark-ink` / `-mark-deep` token'ları varsayılanda grafittir, tema girişi vurgu seçilince basar. Sayfalama, hesap menüsü, ödeme adımı ve onay kutusunun seçili hâli grafit kaldı (gezinme ve form durumu, çip değil).
- **Yapılmayanlar.** Üst bilgi `centered` (iş 7) ve kart puanı (iş 8) bu işin dışında. Tonlar sayfa sayfa gözle gezilmedi (risk notu geçerli): ana sayfa ve `/magaza` bir örnek ayarla tarayıcıda denendi.
- **Ölçüm.** Tema stil dosyası (Tailwind derlemesi, küçültülmüş): 122 078 → 121 028 bayt ham, 22 061 → 22 091 bayt gzip (+30 B; silinen altı `@font-face` bildirimi yeni token ve sınıfları karşıladı). Önyükleme: varsayılan 26 932 bayt; 20 çiftin en ağırı Fraunces + Inter 124 968 bayt (bütçe 125 000).
