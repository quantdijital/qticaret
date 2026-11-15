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

Sonraya bırakılan: `density` (Sıklık: `comfortable` / `compact`). Hiçbir görünüm bugün istemiyor (adr/0066 K5); gerektiğinde bu ADR'ye ek olarak açılır.

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

1. `density` ne zaman ve hangi adla ("Sık" bölüm aralığında kullanılıyor; öneri "Sıkı").
2. Hesap, sipariş ve ödeme sayfalarındaki kutuların tam listesi adım 4'te çıkarılır.
3. Tema ayarlarının ayar aramasına girmesi.
