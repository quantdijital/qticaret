# ADR-0067: Stil takımı: tema düzeyinde kimlik basamakları ve taşıma sırası

- **Durum:** Kabul (sahip, 2026-11-15; karar Oğuzhan tarafında verildi, Deniz devretti)
- **Tarih:** 2026-11-15
- **İlgili:** adr/0066 (tema katmanları; bu ADR onun yol haritası 2 ve 3'üdür), adr/0062 (tema ayarları; "varsayılanda vitrin hiçbir şey basmaz" deseni), adr/0049 (bölüm biçimleri ve ayarları), adr/0063 (hazır görünümler), `docs/tema/bilesen-standardi.md` (§0 ilkeler, §3 sözlük, §7 görünüm kilidi)
- **Dayanak:** adr/0066 §1: kimlik bileşenin içine sabit yazılmaz, stil takımından okunur. Döküm (2026-11-15, salt okunur inceleme): bugün tema düzeyinde 12 görünüş ayarı var; bileşenlerin içinde 14 kimlik kavramı gömülü (yaklaşık 300 satır, 120'yi aşkın dosya; grep sayımı, yaklaşık). En çok tekrar edenler: fotoğraf kuyusu (~27 yer), yüzen yüzey gölgesi (24), `surface_style`'ın kapsamadığı kutular (~17), menü öğesi stili (~14), çip ve sekme stili (~10).

## Karar

### 1. Yeni basamaklar

Hepsi tema ayarıdır (adr/0062), adlandırılmış basamaktır (serbest sayı ya da renk yok), varsayılanı bugünkü çizimdir ve varsayılanda vitrin hiçbir şey basmaz. Bütün hazır görünümler ilk gün varsayılanı taşır; hiçbir görünümün çizimi değişmez (adr/0066 K3b, K6).

| # | Anahtar | Etiket <small>terim</small> | Basamaklar | Varsayılan | Kapsadığı |
| --- | --- | --- | --- | --- | --- |
| S1 | `menu_style` | Menü stili <small>menu items</small> | `filled` Dolu · `underline` Alt çizgili · `plain` Sade | `filled` | Masaüstü menü öğelerinin üzerine gelme ve açık durumu, çubuk simgeleri; üç üst bilgi biçimi, açılır liste, liste menüsü |
| S2 | `shadow` | Gölge <small>shadow</small> | `float` Açılır katmanlarda · `none` Yok | `float` | Yüzen yüzeyler: açılır menü, çekmece, diyalog, yapışkan üst bilgi, yüzen düğmeler |
| S3 | `chip_style` | Çip stili <small>chips</small> | `filled` Dolu · `lined` Çizgili | `filled` | Çipler, sekmeler, seçenek düğmeleri, sayfalama (seçili olmayan) |
| S4 | `media_ground` | Fotoğraf zemini <small>image background</small> | `well` Hafif ton · `page` Sayfa | `well` | Ürün ve kategori fotoğrafının arkasındaki kuyu, liste küçük resimleri |
| S5 | `surface_style` (genişletme) | Kutu stili <small>surface style</small> | `filled` Dolu · `lined` Çizgili (değişmez) | `filled` | Bugün ayarın kapsamadığı ~17 kutu da ayara bağlanır |

Sonraya bırakılan: `density` (Sıklık: `comfortable` / `compact`). Hiçbir görünüm bugün istemiyor (adr/0066 K5); gerektiğinde bu ADR'ye ek olarak açılır. Açıldı: Ek 2026-11-16 (S6).

### 2. Yorum kararları

1. **`menu_style: filled` "biçimin bugünkü çizimi" demektir:** standart reyonda koyu hap, katalog çubuğunda tonlu dolgu ve alt çizgi. Saf bir anlam değildir; mevcut çizimi korumanın (K6) tek yolu budur. Telefon çekmecesindeki dokunma geri bildirimi her basamakta kalır; `plain` ve `underline` yalnız masaüstü üzerine gelme ve açık durumunu değiştirir.
2. **`shadow` iki basamaktır.** `none`'da kenarı olmayan yüzen yüzeye 1 px çizgi (`rule`) eklenir ki zeminden ayrışsın. Kartlara gölge veren üçüncü bir basamak, bir görünüm isteyene kadar açılmaz.
3. **`chip_style` ayrı ayardır**, `surface_style`'a bağlanmaz: çip bir denetimdir, kutu değil. Seçili çipin vurgu dolgusu iki basamakta da aynıdır (adr/0062 karar 11).
4. **`surface_style` genişletmesi Tezgâh'ı bilerek değiştirir.** `lined` seçen tek görünüm Tezgâh'tır ve tasarım dili zaten "her kutu çizgili" der; bugün çizgisiz kalan kutular ayarın eksik kapsamıdır (adr/0066 K9: herkese gelen düzeltme). Alanın anlamı değişmez ("kutular çizgili"), kapsamı tamamlanır; yeni basamak açılmaz. Grafit ve Katalog (`filled`) değişmez. Tezgâh'ın kilit örnekleri o adımda bilerek güncellenir ve tarayıcıda gözle doğrulanır.
5. **Takıma girmeyenler** bölüm ayarı ya da yeni biçim olur (adr/0066 §2): arama genişliği, araçların yeri ve adları, yardımcı şerit, alt bilgi ve duyuru zemini, menü resimleri (`header_bar.menu_images`), sahne tonu. Bölüm düzeyindeki şekil alanları (`arrow_style`, `back_to_top_shape`, `categories.frame`, `trust_badges`) bağımsız kalır; kayıtlı değerleri eski anlamıyla okunur.
6. **Rozet ve sayaç şekli** takıma açılmaz (adr/0062 sahip kararı 4: hap kalır). Harf aralığı ayar değildir; satır içi değerler `--tracking-*` belirtecine taşınır (K3d).
7. **Panel:** tema ayarlarındaki "Köşeler ve düğmeler" grubu ikiye bölünür: "Şekiller" (köşe, düğme, çip) ve "Yüzeyler" (kutu, gölge, fotoğraf zemini, menü, bölüm aralığı). Tema ayarlarının ayar aramasına girmesi ayrı iştir.

### 3. Görünüm kilidi ve taşıma

Kilit (adr/0066 §4) HTML sınıflarını ve tema CSS dosyalarının ham özetini tutar; bu yüzden görünüş değişmese de her taşıma adımı kilidi kırar. Ayrıca yalnız çerçeve ve ana sayfa kilitlidir.

- **Kilit genişler (adım 0):** ürün sayfası ve liste (kategori) sayfası HTML kilidine girer.
- **Çözülmüş stil denetimi** eklenir: tarayıcıda her hazır görünümün çerçevesi, ana sayfası, ürün ve liste sayfası 390 ve 1440 px'te çizilir; öğelerin hesaplanmış görünüş özellikleri (zemin, kenar, köşe, gölge, yazı ağırlığı, iç boşluk, yükseklik, renk) özetlenir. Sınıf adı ve CSS düzeni değişince kırılmaz, gerçek görünüş değişince kırılır. Sunucu ister ve ağırdır; bu yüzden `pnpm verify:changed` içinde koşmaz, temanın çizimine dokunan PR birleşmeden önce elle koşulan bir komuttur ve sonucu PR'a yazılır. adr/0066 açık karar 2 böyle kapanır: ekran görüntüsü farkı yerine çözülmüş stil özeti.
- **Her taşıma adımı iki commit'tir:** (a) yalnız taşıma: HTML ve CSS kilidi bilerek güncellenir, çözülmüş stil özeti aynı kalır; PR gövdesine "yalnız taşıma; çözülmüş stil 5/5 aynı" yazılır. (b) yeni basamaklar: yalnız varsayılan dışı değerde basılan `:root` değişkeni ya da `data-*`.
- Kararı mevcut sınıfa dokunmadan bir belirtece bağlamak (ör. `--shadow-float`) en ucuz yoldur ve tercih edilir.

### 4. Sıra

| Adım | İş | Büyüklük |
| --- | --- | --- |
| 0 | Kilidi genişletmek: ürün ve liste sayfası, çözülmüş stil denetimi | M |
| 1 | `menu_style` | M |
| 2 | Açılır yüzey tarifinin tek yere toplanması + `shadow` | S–M |
| 3 | `chip_style` | M |
| 4 | `surface_style` genişletmesi | M |
| 5 | `media_ground` | M |

Her ayarın sabit gideri yaklaşık 10 dosyadır (sözleşme, backend şeması ve eşitlik testi, vitrin varsayılanı ve bildirimleri, panel alanı ve kaydı, i18n, testler). Toplam kaba tahmin 5–8 iş günü; tahmin dökümün grep sayımına dayanır, hesap, sipariş ve ödeme sayfalarındaki kutular tek tek okunmadı.

Adımları Oğuzhan tarafı yürütür. Adım 1 ve 2, `deniz/katalog-ust-sade` dalının değiştirdiği dosyalara girer (`Aisle.tsx`, `CategoryMenu.tsx`, `HeaderCatalog.tsx`, `menu.css`, `header-catalog.css`): o dal bu adımlar `dev`'e girdikten sonra üstlerine kurulur.

### 5. `deniz/katalog-ust-sade` bu takımla nasıl ifade edilir

Dökümün sayımı: daldaki 17 değişikliğin 3'ü takımla ifade edilir (`menu_style: plain`), 6'sı bölüm ayarı ya da yeni alan ister (tek satır yerleşim, arama genişliği, üst bağlantıların menü çubuğunun sonuna gelmesi, simge adları), 5'i bunların sonucudur, 3'ü herkese gelen ortak düzeltmedir (açılır menülerin `.gf-drop` tarifi, resimli ve sayılı satırlar). `utility_bar` ve `account_text` alanlarının anlamını değiştirmesi K6'ya aykırıdır: yeni anlam yeni alan olur.

Öneri: sade üst bilgi `catalog` biçiminin ayarlarıyla kurulur (varsayılanlar bugünkü çizim) ve Katalog görünümü bu değerleri kendi verisinde seçer; ayarlarla kurulamayan iskelet farkı kalırsa ayrı biçim olur.

## Değerlendirilen seçenekler

| Seçenek | Karar | Neden |
| --- | --- | --- |
| Dört yeni basamak + bir genişletme (bu ADR) | **Seçildi** | Dökümdeki tekrarın çoğunu kapsar; tema ayarı 12'den 16'ya çıkar, "bir avuç" sınırında kalır |
| Çip stilini `surface_style`'a bağlamak | Reddedildi | Mağaza çizgili kutu ile dolu çip isteyebilir; alanın anlamını genişletir |
| `surface_style` için yeni basamak (`lined_all`) | Reddedildi | Aynı kavrama iki basamak; eksik kapsam bir hatadır, yeni seçenek değil |
| Yoğunluğu şimdi eklemek | Sonraya | İsteyen görünüm yok; 44 px dokunma hedefi ve yapışkan ölçüler ayrı çalışma ister |
| Ekran görüntüsü farkı | Reddedildi | Yazı tipi ve kenar yumuşatma farkına duyarlı; çözülmüş stil özeti daha kararlı |
| Tarayıcı denetimini `verify:changed` içine almak | Reddedildi | Sunucu ister, ağırdır (docs/07; 24 GB geliştirme makinesi) |

## Sonuçlar

- Görünüş farkı isteyen görünüm, bu beş alanda bileşene dokunmadan kendi verisinde seçer.
- Taşıma boyunca kilit sık kırılır ve bilerek güncellenir; "görünüş değişmedi" kanıtı çözülmüş stil denetimidir.
- Tezgâh adım 4'te bilerek değişir (karar 4).
- Tema ayarı sayısı artar; panelde iki gruba bölünür.

## Açık kalanlar

1. ~~`density` ne zaman ve hangi adla ("Sık" bölüm aralığında kullanılıyor; öneri "Sıkı").~~ Kapandı: Ek 2026-11-16 (`density`: Ferah / Dengeli / Sıkı).
2. ~~Hesap, sipariş ve ödeme sayfalarındaki kutuların tam listesi adım 4'te çıkarılır.~~ Kapandı: Ek 2026-11-15.
3. Tema ayarlarının ayar aramasına girmesi.

## Uygulama notu (2026-11-15): önce sözleşme

Dört yeni alan (S1–S4) çizime dokunmadan uçtan uca tanımlandı; her alanın çizimi kendi adımında, ayrı dosyalarda bağlanır. Bu PR'dan sonra varsayılan dışı değerler kaydedilir ve vitrine ulaşır, ama görünüşü değiştirmez; panel onları henüz göstermez.

- **Sözleşme:** `packages/types/src/store/style-kit.ts` (`STYLE_KIT`: alan → basamak listesi, ilk basamak varsayılan; `STYLE_KIT_DEFAULTS`, `styleKitAttributes`). `StoreThemeSettings` bu alanları taşır. Backend aynası `platform-settings/sections/theme-style-kit.ts` (eşitlik testi `theme-style-kit.unit.spec.ts`); alan yoksa varsayılan (`withCardDefaults` içinden `withStyleKitDefaults`), liste dışı değer reddedilir. Ayarlar JSON'da, migration yok.
- **İşaret:** `:root` değişkeni değil, `data-*` özniteliği. Temanın kök öğesi (Atölye `Layout`'unun en dıştaki `div`'i, ödeme çerçevesi dahil) varsayılan dışı her alan için `data-menu-style="underline|plain"`, `data-shadow="none"`, `data-chip-style="lined"`, `data-media-ground="page"` taşır; varsayılanda hiçbiri basılmaz, HTML ve stil çıktısı önceki gibidir (görünüm kilidi değişmeden geçti). Temanın `style(settings)` işlevi kit için hiçbir şey basmaz. Neden öznitelik: çizim ajanları yalnız CSS yazar, ortak TS dosyasına (`themes/atolye.ts`) dokunmaz; `:root` değişkenini değerine göre seçen taşınabilir bir CSS yolu da yoktur.
- **CSS'te okuma** (yerel `<dialog>` üst katmanda da DOM'daki atasını korur; Radix portalıyla `body`'ye çizilen diyalog ve çekmeceler işareti kendi taşıyıcılarından alır, aşağıda "Ek 2026-11-15"):

  ```css
  [data-menu-style="plain"] .gf-aisle a:hover { background: none; }
  [data-chip-style="lined"] .gf-chip:not([aria-pressed="true"]) { background: var(--color-paper); box-shadow: inset 0 0 0 1px var(--color-rule); }
  /* Belirteçle (§3, tercih edilen): mevcut sınıf belirteci okur, öznitelik belirteci değiştirir */
  [data-shadow="none"] { --shadow-float: none; --float-line: var(--color-rule); }
  [data-media-ground="page"] { --media-ground: var(--color-paper); }
  ```

  Sınıf ve belirteç adları örnektir (`--shadow-float`, `--media-ground` taşıma adımında tanımlanır). Katman sırası özgüllükten önce gelir: kural ya katmansız (`surface.css` deseni) ya da okuduğu kuralla aynı katmanda yazılır; o zaman öznitelik + sınıf, tek sınıflı kuralı geçer. Kök öğenin dışında kalan yalnız `html`/`body` zeminidir; portallar için "Ek 2026-11-15".
- **Panelde hazır-değil:** `apps/panel/src/features/storefront/editor/forms/style-kit-ready.ts` içindeki `STYLE_KIT_READY` (alan başına bir `false` satırı, aralarında yorum satırı). Kayıt defteri bu alanı `shown: () => STYLE_KIT_READY[alan]` ile bağlar: `false` iken alan formda da ayar aramasında da yoktur. Gruplar ikiye bölündü (§2.7): "Şekiller" (köşe, düğme, çip) ve "Yüzeyler" (kutu, gölge, fotoğraf zemini, menü, bölüm aralığı). Etiketler, basamak adları ve açıklamalar `storefront.editor.theme.styleKit.<alan>.{label,term,steps,hint}` altında yazılı.

**Çizim adımının yapacakları** (alan başına):

1. Taşıma (§3 a): kimliği sabit yazan yerleri sınıf ya da belirtece toplamak; çözülmüş stil aynı kalır, CSS özeti bilerek güncellenir (`pnpm lock:presets`).
2. Yeni basamak (§3 b): yalnız CSS, yukarıdaki seçicilerle. Yeni TS işareti gerekmez; `styleKitAttributes`'e, `themes/atolye.ts`'e, sözleşmeye, backend'e ve i18n'e dokunulmaz (açıklama metni değişecekse yalnız kendi `styleKit.<alan>` bloğu).
3. `STYLE_KIT_READY.<alan>` satırını `true` yapmak; panelde alan açılır.
4. Test: vitrinde basamağın CSS'te okunduğu (ör. `atolye-settings.spec.ts` deseniyle `ruleBody`), panelde alanın göründüğü. Çip adımı `theme-registry.spec.ts`'teki `keys("cizgili")` beklentisini günceller ("Çizgili" artık iki alanda geçer).
5. PR gövdesi: etkilenen hazır görünümler (hepsi varsayılanı taşır: yok), CSS kilidi bilerek güncellendi, çözülmüş stil denetimi sonucu.

Ortak kalan dosyalar: `style-kit-ready.ts` (ayrı satırlar, birleşir), `styles.lock.json` (iki adım aynı anda girerse rebase sonrası `pnpm lock:presets` yeniden koşulur) ve yeni CSS dosyası açılırsa `styles.css`'teki `@import` satırı.

## Ek (2026-11-15): işaret portallara nasıl ulaşır

**Sorun.** Radix `Dialog.Portal` içeriğini `body`'nin sonuna çizer; tema kök öğesinin dışında kalır. #62 ve #63'ü doğrularken sepet çekmecesinde görüldü: `lined` çip ve `page` fotoğraf zemini sepet çekmecesinde, telefon menüsünde, hızlı bakışta, taksit penceresinde, yorum yazmada ve yakınlaştırmada uygulanmıyordu. Süzgeç çekmecesi yerel `<dialog>` olduğu için kökün içindedir, etkilenmiyordu. `surface_style`'ın kutu belirteçleri `:root`'ta olduğu için etkilenmiyordu.

**Karar.** Portal, tema kökünün işaretlerini taşıyan bir taşıyıcıya çizilir:

- `frame/root-marks.ts`: `rootMarks(theme)` kökün işaretleri (`data-surface` ve kit öznitelikleri), tek kaynak. `layerMarks(theme)` en az bir kit basamağı varsayılan dışındayken ya da `surface_style` `lined` iken aynı işaretleri, varsayılanda (`filled` ve kitin varsayılanları) `null` döndürür. (Düzeltme 2026-11-15: ilk sürüm `lined`'ı saymıyordu; kutu belirteçleri `:root`'ta olduğu için yetiyor sanıldı, ama `[data-surface="lined"]` ile okunan kurallar (çekmecedeki adet denetimi) Tezgâh'ta portala ulaşmıyordu.)
- `frame/Layers.tsx`: `Layout` içeriğini `<LayerMarks marks={layerMarks(theme)}>` ile sarar (DOM'a hiçbir şey basmaz). İşaret varken `body`'nin sonunda tek bir `display: contents` taşıyıcı tutar, işaretleri onun üstünde günceller. `LayerPortal` (= `Dialog.Portal container={useLayerHost()}`) katmanı bu taşıyıcıya çizer. Taşıyıcı yine `body`'nin çocuğudur: üstündeki sayfanın yığın bağlamı, `overflow`'u, `transform`'u katmanı etkilemez. Odak tuzağı, kaydırma kilidi ve `aria-hidden` önceki gibi çalışır.
- **Varsayılanda hiçbir şey değişmez:** taşıyıcı yoktur, katman eskisi gibi `body`'nin doğrudan çocuğudur, yayın HTML'i ve çözülmüş stil aynıdır.
- **Kural:** temada çıplak `*.Portal` ya da `createPortal` yazılmaz. Yeni bir katman türü (Popover, Tooltip, DropdownMenu) `frame/Layers.tsx`'e kendi sarmalayıcısını ekler (`container={useLayerHost()}`). `atolye-layers.spec.tsx` bunu denetler.

**CSS yazan adımlar için:** kural, kökteki gibi ata seçicisiyle yazılır (`[data-shadow="none"] .gf-x`, `[data-menu-style="plain"] …`). Taşıyıcı ata olduğu için portal içindeki öğe de bu kuralla eşleşir; ek seçici gerekmez. Seçici `body >` ya da kökün sınıfına (`.min-h-dvh`) bağlanmaz.

**Değerlendirilen seçenekler.** (a) İşaretleri her portalın `Content`'ine basmak: `Content`'in kendisini hedefleyen kural (çekmecenin gölgesi) ata seçicisiyle eşleşmez, perdeye ulaşmaz, her portalda tekrar eder; reddedildi. Kapanış animasyonu Radix'in çocuk başına `Presence`'ını kestiği için portalın içine sarmalayıcı `div` koymak da olmaz. (b) Portalı kökün içine yönlendirmek: katman kökün yığın bağlamına ve gelecekte eklenebilecek `transform`/`overflow`'a bağlanır, çözülmüş stil anahtarları varsayılanda da değişirdi; reddedildi. (c) İşareti `html`/`body`'ye taşımak: tema `body`'yi çizmez (vitrinin kök düzeni), varsayılanda işaretsiz HTML ilkesi ve tema-vitrin sınırı bozulurdu; reddedildi.

## Ek 2026-11-15: adım 4, `surface_style` kapsamı (açık kalan 2 kapandı)

Tema tek tek okundu (hesap, sipariş, ödeme, hediye, ödeme bağlantısı, içerik klasörleri ve bölümler dahil). Döküm ~17 kutu sayıyordu; gerçek sayı daha büyük çıktı, çünkü hesap/sipariş/ödeme sayfalarının kutuları grep'te görünmüyordu.

- **Bağlanan: 80 kutu, 48 dosya.** İki tarif (`surface.css`): `gf-pane` (zemindeki kutu; `filled` = `bg-paper-2` ile aynı) 56 kutu, `gf-pane-inner` (kutu içindeki kutu; `filled` = `bg-field` ile aynı) 24 kutu. Klasöre göre: `account/` 22, `order/` 14, `checkout/` 9, kök sayfalar 13 (marka, kategori, onay, çerez, hediye çeki bakiyesi, yasal, ödeme bağlantısı), `content/` 11, `sections/` 6 (SSS, yazılar, bülten, hikâye, Google puanı, boş raf), `cart/` 3, `payment-link/` 2, `gift/` 0 (formda kutu yok). Sipariş sayfalarının ortak `WELL` sabitleri birer kutu sayıldı.
- **`lined`:** kutu, durduğu bölümün kendi `--color-paper` zemininde ve `--color-rule` çizgisiyle çizilir; grafit ve ana renk zeminli bölümde o bölümün belirteçleri geçer (`:root`'taki `--box-*` sayfanın açık zeminini taşırdı, bu yüzden `gf-box`'tan ayrı tutuldu). Kutu içindeki kutu çizgi almaz, tona iner; üçüncü kat (katlanan sözleşmenin metni) alana döner.
- **`filled` aynı:** iki tarif değiştirdikleri sınıfla aynı bildirimi `components` katmanında taşır; kutudaki her yardımcı sınıf (üzerine gelme tonu, `lg:bg-transparent`) eskisi gibi kazanır. Tailwind'le derlenen stil testi (`atolye-surface-boxes.spec.ts`) bunu doğrular.
- **Nötr zeminli bildirimler bağlandı:** `role="status"`/`"alert"` notları zemini nötr tonsa (yazısı ya da simgesi yeşil/kırmızı olsa da) kutu sayıldı; mevcut `gf-box` emsali böyle (`product/StockAlert.tsx`, `product/Forms.tsx`, sepet notu). Anlam rengini zemininde taşıyan bildirim yok; vurgu zeminliler aşağıda dışarıda.
- **Bilerek dışarıda:** fotoğraf kuyuları ve iskeletler (`media_ground`); çip, hap, rozet, durum hapları ve simge madalyonları (`chip_style` ya da denetim); form denetimleri (ödeme seçeneği kartı `checkout/fields.tsx`, eklenti seçeneği, adet); menü ve açılır yüzeyler (`MenuSheet` hızlı bağlantı kutusu dahil, `menu_style`); yüzen katmanlar (çerez bandı, sepetin yapışkan çubuğu); vurgu zeminli notlar (`bg-highlight-soft`: havale, hesap teklifi, onay notları; anlam rengi); bölüm zeminleri (`Campaign`, alt bilgi bantları); güvence şeridi `strip` biçimi (`trust_badges` kendi `lined` basamağını taşır) ve kategori kartları (`categories.frame`); zaten çizgili kutular (yorum kartları, yardım kutusu, fiyat bantları, SSS sayfasının yan kutusu: iki basamakta da çizgili, ayarla uyumlu); çizgili kartın içindeki ton blokları (mağaza yanıtı `ReviewReply`, Google yorumunun alt kutusu: çizgi alırsa çift çizgi olur); ürün açıklamasındaki alıntı (`[&_blockquote]`, yazı biçimi).
- **Hazır görünümler:** Grafit ve Katalog değişmez. Tezgâh ×3 kilitli sayfalarda yalnız ana sayfanın yazı kartlarında (`home-09-yazilar`) değişir; geri kalanı kilit dışı sayfalardadır.

## Ek 2026-11-16: S6 `density`, bölüm aralığına `tight`, köşeye iki ara basamak (açık kalan 1 kapandı)

**Dayanak.** Sahip (2026-11-16): temadaki boşluklar ve köşeler bir e-ticaret mağazası için fazla açık. Ölçüm ve öneri sunuldu, "Dengeli" hedef onaylandı ("önerilerini beğendim uygula"); düğmeler ve arama kutusu hap kalır, kartlara yeni kenarlık eklenmez. İleride "Sıkı" basamağı da olacak ama hiçbir hazır görünüm onu seçmez.

**Nereye yazılır (adr/0066 §2).** Fark bir görünüştür ve temanın bütününe yayılır (her bölümün başlık altı, her ızgara, alt bilgiye boşluk): bölüm ayarı değil, yeni biçim hiç değil; stil takımında basamak. §1'de "sonraya" bırakılan `density` bu ektir; yeni ADR gerekmedi. Bölüm aralığı ve köşe zaten tema ayarıdır (adr/0062); onlara basamak eklenir, anlamları (K6) değişmez.

**Karar.**

| Alan | Basamaklar (ilk varsayılan; panel adı) | Nasıl basılır |
| --- | --- | --- |
| S6 `density` (yeni, `STYLE_KIT`) | `airy` Ferah · `balanced` Dengeli · `compact` Sıkı | `airy` dışında tema kökünde `data-density` (kit deseni: portallara da ulaşır); `density.css` belirteçleri o öğede yeniden tanımlar |
| `section_spacing` (genişler) | `tight` Çok sık (yeni, ×0,35) · `compact` Sık ×0,55 · `normal` · `roomy` Ferah ×1,2 | `--section-scale` (değişmedi) |
| `radius` (genişler) | `sharp` Keskin ×0,2 · `crisp` Belirgin ×0,6 (yeni) · `gentle` Ölçülü ×0,8 (yeni) · `soft` Yumuşak ×1 · `round` Yuvarlak ×1,5 | `--radius-scale` (değişmedi) |

Gerçek değerler (px, masaüstü / tablet / telefon; tablet 640–1023 px):

| Ölçü | Ferah (bugün) | Dengeli | Sıkı |
| --- | --- | --- | --- |
| Başlık → içerik (`--head-gap`; `-m` fiyat bantları, `-s` ürün rafı, sekmeler, markalar, müşteri fotoğrafları) | 40 / 24 / 24 (32 / 24 / 24; 24) | 24 / 16 / 16 (hepsi) | 16 / 12 / 12 (hepsi) |
| Izgara sütun (`--gap-columns`) | 24 / 24 / 12 | 20 / 16 / 12 | 16 / 12 / 8 |
| Izgara satır (`--gap-rows`; `-s` öne çıkan raf, kategori kartları) | 40 / 32 / 32 (32) | 28 / 20 / 20 | 20 / 12 / 12 |
| Alt bilgiye (`--footer-gap`) | 64 / 48 / 40 | 48 / 40 / 32 | 32 / 24 / 20 |
| Kenar boşluğu (`--gutter`) | 48 / 24 / 16 | aynı | 48 / 24 / 12 |
| Bölüm arası (`section_spacing`, ayrı ayar) | Normal 96 / 64 / 48 | Sık 53 / 35 / 26 | Çok sık 34 / 22 / 17 (33,6 / 22,4 / 16,8; istenen 32 / 24 / 20'ye en yakın yuvarlak çarpan 0,35) |
| Köşe karo / fotoğraf / iç (`radius`, ayrı ayar) | Yumuşak 20 / 14 / 10 | Ölçülü 16 / 11,2 / 8 | Belirgin 12 / 8,4 / 6 |

1. **Yoğunluk bölüm aralığını kapsamaz.** Bölümler arası boşluk `section_spacing`'de kalır (iki ayar, iki soru); "Dengeli" görünüm ikisini birlikte seçer. 44 px dokunma hedefi, yapışkan üst bilgi ölçüleri ve denetimlerin kendi iç boşluğu hiçbir basamakta değişmez (§1'deki çekince böyle karşılandı).
2. **Önce taşıma (§3 a).** Bölüm başlığının altı ve ızgara satırı bileşenlerde elle yazılıydı (`gap-6 lg:gap-10` 7 yer, `gap-6 lg:gap-8` 1, `gap-6` 5, `gap-y-8 lg:gap-y-10` 2, `gap-y-8` 3). Bunlar aynı değeri taşıyan belirteçlere taşındı (`tokens.css`, rem cinsinden, Tailwind'in `lg:` eşiğinde: 1024 px `lg:`'nin); her yerin eski sınıfı ile yeni belirteci 13 genişlikte aynı çözülüyor (`atolye-gap-tokens.spec.ts`). Kilit yalnız sınıf adlarında ve `tokens.css` özetinde değişti.
3. **Basamaklar (§3 b).** `density.css` yalnız `tokens.css`'in tanımladığı belirteçleri ve yalnız `[data-density="balanced"|"compact"]` altında yazar; her belirteç kendi ekran eşiğini korur (başlık ve satır `lg:`, sütun, alt bilgi ve kenar `max-width`). Varsayılanda öznitelik basılmaz; bütün hazır görünümlerin HTML'i bu adımda değişmedi (kilit yalnız stil özetinde).
4. **Hazır görünümler (veri).** Grafit ve Katalog: `density: balanced`, `radius: gentle`, `section_spacing: compact` (dal `deniz/tema-aralik-sik`). Tezgâh ×3 dokunulmadı (zaten `compact` aralık; yoğunluğu Oğuzhan'ın sıradaki işi). `tight`, `crisp` ve Sıkı yoğunluğu hiçbir görünüm seçmez.
5. **Panel.** Tema ayarlarına "Boşluklar" grubu (Şekiller ile Yüzeyler arasında): Bölüm aralığı (Yüzeyler'den taşındı) ve Yoğunluk; köşeler Şekiller'de kalır. Tema alanı aramada görünmeyen sözcüklerle de bulunur (`keywords`: boşluk, aralık, sıkı, ferah, yoğunluk). İpuçları gerçek piksel değerlerini yazar.
6. **Ayna ve okuma.** Sözleşme `STYLE_KIT.density`, `RADIUS_STEPS`, `SECTION_SPACINGS`; backend aynası (`theme-style-kit.ts`, düz listeler `theme-steps.ts`) ve eşitlik testleri. Ayar JSON'dadır, migration yok. Bilinmeyen basamak vitrinde varsayılana düşer, backend kaydı reddeder.

**Değerlendirilen seçenekler.** (a) Yoğunluğu tema ayarı olarak (`theme.density`, kit dışında) eklemek: kitin işaret ve portal altyapısını yeniden yazmak gerekirdi; reddedildi. (b) Yoğunluğu `--section-scale` gibi bir çarpanla basmak: başlık, ızgara ve kenar boşluğu farklı oranlarda küçülmeli (24 → 16 ama 12 → 12) ve serbest sayıya kayar; reddedildi. (c) Bölüm aralığını yoğunluğa bağlamak: kayıtlı `section_spacing` değerlerinin anlamı değişirdi (K6); reddedildi.

**Açık kalan.** Çözülmüş stil denetimi (`style:capture` / `style:diff`) bu dalda koşulmadı (sunucu ister): taşıma commit'i için "aynı", hazır görünüm commit'i için Grafit ve Katalog'da beklenen fark; ana oturum koşar.
