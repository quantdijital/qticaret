# 18 — Panel Tasarım Sistemi

> Yönetici panelinin (`apps/panel`, adr/0022) görsel dili, token'ları, tema motoru ve klasör yapısı.
> Amaç: bir e-ticaret firmasının profesyonel paneli; sakin, yoğun ama ferah, mağaza sahibinin rengiyle.
> Bu belge inceleme ölçütüdür: yeni her ekran §3 kara listesinden ve §9 kontrol listesinden geçer.

---

## 1. Yığın

| Katman | Seçim | Neden |
| --- | --- | --- |
| Uygulama | React 19, Vite, TypeScript strict | Hafif SPA; backend'le aynı origin'den sunulur |
| Stil | Tailwind v4 (CSS-first `@theme`) | Token'lar CSS değişkeni; tema çalışma anında değişir |
| Bileşen | shadcn/ui (new-york), Radix tabanlı | Kod bizde (`components/ui`), erişilebilir, token'larla boyanır |
| İkon | lucide-react | Tek set, tek çizgi kalınlığı; emoji yok |
| Yönlendirme | TanStack Router (dosya tabanlı) | Tip güvenli URL ve filtre parametreleri |
| Veri | TanStack Query + `@medusajs/js-sdk` (session) | Backend'le aynı istemci; önbellek, yeniden deneme |
| Tablo | TanStack Table | Sıralama, seçim, toplu işlem; shadcn deseni |
| Form | React Hook Form + Zod | Backend'le aynı doğrulama dili |
| Grafik | Recharts | shadcn chart deseni; token renkleri |
| Metin | i18next, `tr` varsayılan | Backend hata anahtarları `lib/errors/messages` ile aynı kaynak |
| Yazı tipi | Inter Variable, kendi sunucumuzdan | Türkçe karakterler tam, `tnum` ile hizalı tutarlar; Google Fonts yok |
| Test | Vitest + Testing Library; Playwright (e2e); axe | docs/06 kontrol listesi |

Sürümler `apps/panel/package.json`'da exact ve ≥14 gün kuralıyla (docs/04).

---

## 2. Görsel dil

**Bir cümleyle:** nötr yüzeyler, tek vurgu rengi, sıkı tipografi, 4 px ızgara, ince çizgiler, hareket yalnızca durum değişiminde.

- **Yüzeyler:** üç seviye: sayfa, kart, vurgulu alan. Kartlar yalnızca gruplama gerektiğinde; bir sayfada yan yana "her şey kart" olmaz.
- **Çizgiler:** 1 px, düşük kontrast. Gölge yalnızca üstte duran katmanlarda (menü, diyalog); kartlarda gölge yok.
- **Renk:** mağazanın marka rengi yalnızca birincil eylem, seçili durum ve odak halkasında. Durum renkleri (başarı, uyarı, hata, bilgi) sabittir ve yalnızca durum anlatır. Metin asla renkli "vurgu" için boyanmaz.
- **Tipografi:** Inter; ağırlık 400/500/600; ölçek 12 / 13 / 14 / 16 / 18 / 22 / 28 px. Tutarlar ve sayılar `font-variant-numeric: tabular-nums`. Başlıklar kısa, cümle düzeni (büyük harfle bağırmak yok).
- **Yoğunluk:** tablolar ve listeler sıkı (satır 40 px), formlar ferah (kontrol 36 px). "Kompakt" tercihinde 32 / 32.
- **Köşe:** tek kaynak (`--radius`), mağaza seçer: keskin 4, yumuşak 8, yuvarlak 12. Rozetler her zaman tam yuvarlak.
- **Hareket:** 120–200 ms, ease-out, yalnızca açılan/kapanan ve durum değiştiren öğelerde. `prefers-reduced-motion` saygı görür.
- **Boş durum:** bir cümle + bir eylem. İllüstrasyon yok.
- **Metin:** sade Türkçe, ünlem yok, jargon yok (docs/06 sözlüğü). Hata metni ne olduğunu ve ne yapılacağını söyler.
- **Yerleşim:** sol menü (daraltılabilir, ikon modu), üst çubuk (arama, bildirim, hesap), içerik en çok 1280 px, sayfa başlığı deseni (başlık, bir cümle açıklama, sağda birincil eylem).
- **Denge (2026-10-26, kullanıcı kuralı):** dengesiz görüntü hata sayılır.
  - Aynı satırdaki kartlar aynı yükseklikte. Yan yana sütunlar aynı çizgide biter: kısa sütunun son kartı uzar (`PageGrid` + `PageColumn`). Sayfa düzeninde `items-start` kullanılmaz.
  - Yalnızca yapışkan özet sütunu (formun önizlemesi ve kaydet düğmesi, düzenleyicinin yan kartları; `PageColumn sticky`) kendi boyunda kalır. Pencereye sığdıkça kaydırırken görünür kalır; sığmıyorsa sayfayla kayar. Kendi içinde kayan yan sütun yoktur (sahip 2026-11-06).
  - Uzayan kartta içerik üstte kalır. Toplamlar gibi bir kartın sonu kartın dibine, tek cümlelik boş durum ortaya yaslanır.
  - Bir satırdaki kontroller tek boydadır: sayfa başlığında ve araç çubuklarında 36 px (düğme, segment grup, arama, seçici); kart başlığındaki eylemler 32 px (`sm`), ama aynı başlıktakiler birbirine eşit. Bir alanın yanındaki ikon düğme alanla aynı boyda.
  - Kartın içindeki iki parça (özet + liste gibi) birbirine yakın boyda tutulur: uzun liste iki sütuna bölünür ya da kısaltılır.
  - Hiçbir kartın yanında ya da altında anlamsız boşluk kalmaz; uzun içerik kendi sekmesine taşınır (Raporlar).
  - `e2e/layout.e2e.ts` her sayfayı masaüstü genişlikte ölçer; ihlal testi kırar.
- `e2e/shell.e2e.ts` (2026-11-03): her sayfa üç ekran boyunda sonuna kaydırılır; içeriğin bittiği yerle ekranın altı arasında sayfa arka planı dışında bir alan, yüzey–kanvas farkı ya da yatay kaydırma olamaz; listelerin ilk kaydı da açılır, kayıt yoksa atlanır. Ayarlar menüsü lg+'da yapışkan ve kendi içinde kayar (sayfa yalnız kendi içeriği kadar uzundur).
- Diyalog ve sheet'ler (2026-11-03): paylaşılan `DialogContent` tek sütun `grid-cols-[minmax(0,1fr)]` (içerik kutuyu genişletemez), `sm` üstünde en çok `--dialog-max-height` (ekranın %85'i; 2026-11-05, kullanıcı: "o modal niye bu kadar yüksek? modal yapılarımız standart bir modaldan çekiliyordur diye düşünüyorum") boyunda, uzunsa içinde kayar, alt bilgi yapışkan; <640 px'te alt kenardan tam genişlik sheet (içeriği kadar, en çok ekran). Uzun liste ya da ızgara tutan diyalog `DialogContent pane`: başlık ve alt bilgi yerinde kalır, yalnızca `DialogBody` kayar (kaydırma çubuğu kutunun kenarında, alt bilginin üstünde ince çizgi); diyalog içinde ikinci bir kaydırma kutusu (`max-h-72 overflow-y-auto` liste) açılmaz. Sekme değişince boyu oynamaması gereken pencere (ortam seçici, varyant penceresi) yüksekliğini sabitler (`sm:h-(--dialog-max-height)`, varyantta en çok 40rem). Kendi yüksekliğini koyan diyaloglar (2026-11-05 denetimi) bu düzene alındı: ortam seçici, yasal metin önizlemesi, yorum fotoğrafı, web kancası teslim kaydı, menü kayıt seçici, toplu kargoya verme sonucu, para iadesi, kargoya verme, yönlendirme içe aktarma. Form tutan diyalog `FormDialog` (`components/patterns/form-dialog.tsx`): alanlar gövdede, "Vazgeç" ve (değişiklik varken etkin) "Kaydet" alt bilgide, kaydedilmemiş değişiklikle kapatmak (köşedeki düğme, Esc, dışarı tık, "Vazgeç") ya da başka kayda geçmek `useDiscardGuard` ile önce sorar ("Değişiklikleri at"); reddedilen alan yanında söylenir. Radix onay kutusu/radyo/anahtar/seçim satırı `relative` (gizli mutlak input kaydırılan listeden kaçmasın — `globals.css`). `e2e/dialogs.e2e.ts` 14 diyaloğu (varyant penceresi, ortam seçici, ürünün katalog penceresi dahil) 1440 ve 390'da açıp taşma/kırpılmayı ve `sm` üstünde %85'i aşan boyu ölçer. Ferah düzen (2026-11-03, "ince ve geniş"): genişlik `size` ile (§4.3), iç boşluk 24 px (telefon) / 32 px, başlık–gövde–alt bilgi arası 24 px, gövde parçaları `DialogBody` içinde 20 px, uzun diyalogda `DialogSection` başlıkları, satırlar 48 px, satır listeli diyalog `DialogBody list` ile en az 176 px gövde; sheet'ler aynı 24 px kenar boşluğunu kullanır. Sayı alanı yalnızca `NumberField` (`components/patterns`): tarayıcı oku yok (`globals.css` her `input[type=number]`'da gizler), kutu 36 px (`compact` 32 px, satırlar için), birim eki (₺, %, cm), Türkçe ondalık; sağ kenarın içinde üst üste lucide `ChevronUp`/`ChevronDown`, her biri kutunun yarı boyu, yalnız simge (üzerine gelince hafif zemin, soluk → ön plan rengi), fare alanın üstündeyken ya da odaktayken görünür, yerleri hep ayrılı (hiçbir şey kaymaz), basılı tutunca tekrarlar, sınırda kapanır, sekme sırasında değil (ok tuşları aynı işi yapar), dokunmatikte (`pointer: coarse`) çizilmez, telefonun sayı klavyesi yeter (kullanıcı 2026-11-06: "normal artır azalt ikonları aşağı yukarı olsun, hover olunca sadece ikon"); `type="number"` kullanan çıplak input `house-rules.spec.ts`'te kırılır.

---

## 3. Kara liste ("AI slop" olmayacak)

İncelemede bunlardan biri görülürse ekran geri döner:

- Gradyan, cam efekti (blur/glass), parlama, dekoratif blob ve dalga.
- Her kutuda gölge; "kart içinde kart"; aynı sayfada beş farklı köşe yarıçapı.
- Emoji ve dekoratif ikon; renkli büyük ikon çemberleri; stok illüstrasyon.
- Vurgu rengiyle boyanmış başlık, rastgele mor/mavi gradyan butonlar.
- Yan yana dizilmiş dört "özellik kartı" düzeni; hero bölümü; pazarlama dili.
- Yer tutucu metin ("Lorem", "Hoş geldin! 🚀"); ünlem işaretleri; "Harika!" tonu.
- Tablo yerine kart ızgarası (veri listeleri tablodur).
- Sayfa başına birden çok birincil buton.
- Animasyonlu sayaçlar, zıplayan geçişler, yükleme spinner'ı (iskelet kullanılır).
- Google Fonts ve dış CDN; inline base64 görsel.

---

**Giriş sayfaları istisnası (kullanıcı kararı, 2026-11-04):** `/login`, `/reset-password`, `/invite`, `/security/setup` ve rolsüz sayfa `AuthShell` ile lg+'da iki sütun: solda ürün tanıtımı (`AuthIntro`: menü renk belirteçleri, solan ızgara çizgileri + hafif marka tonu, ad, vaat, dört değer satırı — başka yerde yasak olan tanıtım dili yalnız burada), sağda kenarlıksız kart üzerinde form; dar ekranda üstte ~70 px şerit; form kaynakta önce (klavye sırası). Mağaza logosu giriş öncesi herkese açık bir uç olmadığından gösterilmez.

## 4. Token katmanları

Tek kaynak: `apps/panel/src/theme/tokens.css`. Üç katman; bileşenler yalnızca anlamsal ve bileşen token'larını kullanır, ham palete dokunmaz.

### 4.1 İlkel (sabit)
- Nötr ölçek (OKLCH, marka tonuna hafif eğimli, kroma ≤ 0,01): `--neutral-0 … --neutral-1000`.
- Durum renkleri: `--green-*`, `--amber-*`, `--red-*`, `--blue-*` (OKLCH, açık/koyu için iki değer).
- Aralık: 4 px ızgara (`--space-1` = 4 px … `--space-12` = 48 px).
- Yazı: `--font-sans`, ölçek `--text-xs … --text-2xl`, satır yükseklikleri.
- Süre: `--duration-fast` 120 ms, `--duration-base` 180 ms; `--ease-out`.

### 4.2 Anlamsal (tema bunları değiştirir; shadcn adları)
`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--accent`, `--destructive`, `--success`, `--warning`, `--info`, `--border`, `--input`, `--ring`, `--chart-1 … --chart-5`, `--sidebar-*`.

`--primary-text`: marka renginde metin (bağlantı düğmesi, "Göster", adım göstergesi). Dolgunun kendi açıklığından başlar, her yüzeyde (arka plan, kart, açılır pencere, muted) AA'yı tutturana kadar kayar; marka rengi metin olarak doğrudan `--primary` ile yazılmaz (2026-10-29, şifre yenileme sayfasındaki bağlantı koyu kırmızı markada AA'yı kaçırıyordu).

### 4.3 Bileşen ve yerleşim (ayarlardan yönetilir)
| Token | Varsayılan | Kaynak |
| --- | --- | --- |
| `--radius` (sm/md/lg türetilir) | 8 px | Görünüm ayarı: köşe |
| `--control-height`, `--row-height` | 36 / 40 px | Görünüm ayarı: yoğunluk |
| `--border-width`, `--border` | 1 px, nötr-200 | sabit |
| `--layout-sidebar-width`, `--layout-sidebar-width-icon` | 264 / 56 px | sabit (shadcn'in kenar çubuğu bunları okur) |
| `--layout-topbar-height` | 56 px | sabit |
| `--page-padding`, `--page-padding-wide`, `--grid-gap` | 24 / 32 / 16 px | sabit. İçerik tam genişlik kullanır (üst sınır yok, kullanıcı kararı 2026-10-25); okunabilirlik 12 kolonlu ızgara ve kart genişlikleriyle sağlanır |
| `--chart-muted`, `--chart-grid`, `--chart-canceled`, `--chart-ramp-1..4` | motor türetir | grafik: karşılaştırma serisi, ızgara, iptal, sıralı aşama rampası (akromatik markada gri rampa) |
| `--dialog-width-sm/md/lg/xl` | 448 / 512 / 672 / 768 px | sabit; `DialogContent size`: onay ve kısa form / form ve satır listesi (varsayılan) / tablo ya da iki sütun / geniş seçici ya da önizleme |
| `--dialog-max-height` | 85dvh | sabit; `sm` üstünde her diyaloğun en çok boyu; ortam seçici bu boyda sabit (2026-11-05) |
| `--overlay` | nötr-900 %40 | sabit |
| `--shadow-overlay` | tek gölge | sabit |
| `--focus-ring` | marka, 2 px, 2 px ofset | sabit. Yalnızca klavyeyle (Tab) gezerken düğme benzeri kontrollerde görünür; yazı alanlarında halka ya da renkli kenarlık yok, fare/dokunmada hiç yok (`lib/input-mode.ts`, kullanıcı kararı 2026-10-28) |

Bir bileşenin boyutu, çizgisi ya da köşesi sabit kodlanmaz; token'dan okunur. Yeni bir değer gerekiyorsa önce token eklenir.

---

## 5. Tema motoru (`src/theme/engine.ts`)

Mağaza sahibi yedi şey seçer; gerisi türetilir:

| Ayar | Değerler | Etkisi |
| --- | --- | --- |
| Marka rengi | hex | `--primary`, `--ring`, seçili durumlar, grafik-1, nötr ölçeğin tonu |
| Logo | açık ve koyu için görsel | Menü başı, giriş sayfası |
| Köşe | keskin / yumuşak / yuvarlak | `--radius` 4 / 8 / 12 |
| Yoğunluk | ferah / kompakt | kontrol ve satır yükseklikleri |
| Mod | açık / koyu / sistem | anlamsal token seti |
| Menü zemini | koyu / açık / marka rengi | `--sidebar-*` |
| Menü davranışı | açık / kapalı / otomatik | geniş ekranda sol menü: hep açık, yalnızca ikonlar ya da ikonlar ve üzerine gelince sayfayı itmeden açılan menü (50 ms gecikme, 100 ms açılış); üst çubuktaki düğme bir sonraki ziyarete kadar açıp kapatır; telefonda menü her zaman düğmeyle açılan çekmece |

- Marka renginden OKLCH'de 11 tonluk ölçek üretilir (`culori`). `--primary` için açıklık `[0,40 – 0,62]` aralığına çekilir ki beyaz metin AA (≥ 4,5:1) sağlasın; düzeltme yapıldıysa ayar ekranı "renginiz koyulaştırıldı" uyarısı gösterir. Kontrast testi birim testidir.
- Nötr ölçek, marka tonuna `kroma 0,006` ile eğilir; böylece panel "gri" değil, markanın soğuk/sıcak havasında olur ama renk okunaklılığı bozulmaz.
- Koyu mod aynı ölçekten ters okunarak türetilir; durum renkleri koyu modda bir ton açılır.
- Değerler `platform-settings` `appearance` bölümünde durur; panel açılışta okur, `document.documentElement`'e CSS değişkeni olarak yazar. Önizleme aynı motorla, kaydetmeden çalışır.
- Hazır paletler (6 adet) yalnızca başlangıç noktasıdır; hepsi aynı motordan geçer.

---

## 6. Klasör yapısı

```
apps/panel/
├── index.html
├── vite.config.ts            # proxy: /admin, /auth, /store, /static → backend
├── components.json           # shadcn
├── src/
│   ├── main.tsx              # sağlayıcılar: Query, Router, Theme, i18n
│   ├── routes/               # TanStack dosya tabanlı; ince: yalnızca feature sayfasını çağırır
│   │   ├── __root.tsx
│   │   ├── _auth.tsx         # giriş gerektiren kabuk
│   │   ├── _auth/index.tsx   # dashboard
│   │   ├── _auth/products/…  # listeler, sihirbazlar, detaylar
│   │   ├── _auth/settings/…
│   │   └── login.tsx
│   ├── features/             # alan başına: sayfa, bileşen, api, şema
│   │   ├── dashboard/
│   │   ├── setup/            # kurulum sihirbazı
│   │   ├── products/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── categories/ inventory/ promotions/ reports/ seo/
│   │   ├── attributes/       # özellik şablonları ve ürün özellikleri (adr/0013)
│   │   ├── settings/         # mağaza, görünüm, SEO, özellikler, işler, denetim kaydı
│   │   └── <alan>/{api,components,pages,detail,wizard}/
│   ├── components/
│   │   ├── ui/               # shadcn üretimi, bizim sahipliğimizde
│   │   ├── patterns/         # PageHeader, DataTable, FilterTabs, SearchInput, Pagination, Wizard, CardForm, LeaveGuard, SectionCard, KpiTile, StatusBadge, ConfirmDialog, FormDialog, FormSection, CollapsibleSection, MediaField, MediaPicker
│   │   └── layout/           # AppShell, Sidebar, Topbar, PageContainer
│   ├── theme/                # tokens.css, engine.ts, presets.ts, schema.ts
│   ├── lib/                  # sdk, auth, i18n, format (para, tarih, tr), errors
│   ├── locales/              # tr.json, en.json
│   ├── styles/globals.css    # tailwind + tokens
│   └── test/                 # kurulum, yardımcılar
├── e2e/                      # Playwright
└── package.json
```

Kurallar:
- `routes/` içinde iş mantığı yok; sayfa `features/<alan>/pages` içindedir.
- `components/ui` yalnızca shadcn CLI ile değişir; özelleştirme token'la yapılır, bileşen kodunu elle boyamak yok. CLI `cn` paketini bağımlılık olarak ekleyip `import { cn } from "cn"` yazıyor: her eklemeden sonra import `@/lib/utils`'e çevrilir, `cn` paketi ve CLI'nin indirdiği sürüm değişiklikleri (ör. recharts) geri alınır.
- Bir desen (`patterns/`) iki yerde kullanılmadan önce yazılmaz; üç yerde kopyalanmadan önce desen olur.
- Dosya ~300 satır, fonksiyon ~50 satır (docs/10).

---

## 7. Desenler

- `components/patterns/media-picker.tsx` + `media-field.tsx` (2026-11-04; tek giriş 2026-11-05): paneldeki her görsel alanı `MediaField` ile (önizleme çerçevesi `wide` / `share` / `square` / `logo`, alt metin alanı `children` olarak görselin yanında). **Bir görsel tek yoldan girer** (kullanıcı, 2026-11-05: "kütüphaneden seç neden ayrı bir altta? direkt o 'görselleri sürükle' yazdığın box'a tıkladığım an o modal açılsa"): çerçevenin kendisi giriştir; tıklanınca `MediaPicker`, üstüne bırakılan dosya pencere açılmadan kütüphaneye yüklenip seçilir; görsel varken çerçeve aynı yolla değiştirir (köşesinde "Değiştir"), yanında yalnız "Kaldır". Ayrı "Görsel seç" ya da "Kütüphaneden seç" düğmesi yok. Ürün galerisi (`features/products/components/image-gallery.tsx`) ve varyant penceresi de böyle: bırakma alanı ya da ızgaranın son karesi "Görsel ekle" pencereyi açar, dosya bırakmak doğrudan yükler. Seçim `MediaPicker` diyaloğunda (`size="xl"`, `pane`, `--dialog-max-height` boyunda sabit; başlık, sekmeler, arama ve "n görsel seçildi · Seç" yerinde, yalnızca ızgara kayar), üç sekme: Kütüphane (arama, sayfa, tek ya da `multiple` + `max`), Bilgisayardan yükle (sekmeyi dolduran bırakma alanı, dosya dosya durum ve ilerleme; hepsi yüklenince seçer, hata varsa nedenleri kalır), Adres (sunucu adresten kütüphaneye alır, sonra seçer). Hangi sekme açık olursa olsun pencereye bırakılan dosyalar yüklemeye gider. Yüklenen ve alınan her görsel önce kütüphaneye girer; sayfa yalnızca mağazanın kendi kopyasını gösterir. Kütüphaneden seçilen görselin alt metni boş alt metni doldurur. Kullananlar: vitrin düzenleyicisinin açılış ve kayan görselleri, içerik kapağı ve metindeki görsel, mağaza logoları, paylaşım görseli, marka logosu, kategori görseli, ETBİS karekodu, ürün galerisi, varyant penceresi. Ortam kütüphanesi sayfası (`/media`) ve seçici küçük resim ızgarası kullanır: görseller göze göre ayırt edilir, §3'teki "tablo yerine kart ızgarası" yasağının bilinçli istisnası.
- `components/patterns/chip-input.tsx` (2026-11-04): etiket/terim girişi — Enter ya da virgül ekler, boş alanda Backspace sonuncuyu siler, yinelenen (Türkçe harf ve büyük/küçük duyarsız) reddedilir, `n / en çok` sayacı; eş anlamlı gruplar, özellik seçenekleri ve ürün sihirbazı seçenek değerleri bunu kullanır.

| Desen | Ne zaman | Notlar |
| --- | --- | --- |
| PageGrid + PageColumn | Yan yana kartlar | 12 sütunlu ızgara; satırdaki hücreler eşit, sütunların son kartı uzar; yapışkan özet sütunu `sticky` (§2 Denge) |
| PageTabs | Bir ayar sayfasının parçaları; detay sayfasının ikincil kartları (docs/06 "Detay sayfası düzeni", 2026-11-04) | Alt çizgili sekmeler, dar ekranda alt satıra kayar; kayıt sayısı adın yanında; açık sekme `?part=`'ta, sekme değişince sayfa yukarı atlamaz (`useOpenPart`); form tutan sekmelerde `keepMounted`. `SettingsTabs` bunun ayarlardaki adıdır |
| EmptyRow | Detay sayfasında boş bölüm | Kart yerine tek satır: bir cümle + varsa eylem; kart içinde bir şey olunca çizilir |
| CollapsibleSection | Metin sayfasının ve ürün sayfasının ikincil bölümleri (docs/06 "Metin sayfaları", "Ürün sayfası", 2026-11-05); ana içeriği aşağı iten uzun ikincil kartlar | Kart başlığının tamamı açar/kapar (`aria-expanded`; klavyede kartın içinde ince çizgi); kapalıyken başlık + tek satır özet (telefonda iki satır), açıkken açıklama; `attention` (acil bulgu, boş zorunlu alan) açar, açmak tercih sayılmaz; kişinin seçimi `localStorage`'da kullanıcı başına (`qt.panel.section:<kullanıcı>:<ad>`, okunamazsa varsayılan); kapalıyken içerik DOM'da kalır, kaydedilmemiş düzenleme varsa satırda söylenir. Kaydeden kart `CardForm collapse`, salt okunan kart `SectionCard collapse` ile katlanır; açıkken başlıktaki eylem (bir düğme, bir seçim) telefonda başlığın altına iner; `revealSection(id)` kapalıyı açıp ona kaydırır (SEO danışmanının "Alana git"i; bölüm olmayan bir yer `useRevealTarget` ile önce kendini açar, ör. ürünün yan kartlarının penceresi, kodu eksik varyantın penceresi, alt metni eksik görselin karesi). Grafik `WhileOpen` içinde: kapalı bölümün kutusu boyutsuz, grafik yalnız açıkken çizilir |
| PageHeader | Her sayfa | Başlık, bir cümle açıklama, sağda tek birincil eylem, ikincil eylemler menüde |
| DataTable | Her veri listesi | Yapışkan başlık, satır hover, durum rozeti, seçim + toplu işlem çubuğu, sunucu sayfalama, URL'de filtre |
| Wizard | Çok adımlı oluşturma | Numaralı adımlar, her adımda tek soru grubu, taslak olarak kaydet, geri dönülebilir, ilerleme |
| StatCard | Dashboard | Etiket, büyük sayı (tabular), bir cümle bağlam, isteğe bağlı küçük çizgi grafik |
| EmptyState | Boş liste | Bir cümle + bir eylem |
| StatusBadge | Sipariş/ödeme/kargo durumu | Yalnızca durum renkleri; metin sözlükten |
| ConfirmDialog | Geri alınamaz işlem | Özet + açık eylem adı ("Siparişi iptal et"), "Tamam" değil |
| MediaField + MediaPicker | Görsel tutan her form alanı | Çerçeve tek giriş: tıkla → seçici, dosya bırak → yükle ve seç; görsel varken "Kaldır"; seçici üç sekme (Kütüphane, Bilgisayardan yükle, Adres), `xl` + `pane`; alt metin görselin yanında; adres alanı tek başına yok (2026-11-04, 2026-11-05) |
| FormDialog | Bir kaydın bir parçasını düzenleyen pencere (ürünün yan kartları, varyant) | "Vazgeç" + "Kaydet" alt bilgide; kaydedilmemiş değişiklikle kapatma ya da başka kayda geçme `useDiscardGuard` ile sorar; boy ölçekten (`size`), uzunsa `pane`; kaydedince kapanır (2026-11-05) |
| FormSection | Formlar | Başlık + açıklama solda, alanlar sağda (geniş ekranda); doğrulama satır altında |
| Toast | Sonuç bildirimi | Kısa, eylem bağlantılı; hata toast'ı kalıcı, başarı 4 sn |
| FilterTabs + SearchInput + Pagination | Liste üstü ve altı | Hızlı görünümler sayılarıyla; arama 300 ms sonra; durum URL'de (`?status=&q=&page=`, sayfa 1 tabanlı) |
| CardForm | Detay sayfasının bölümleri | Her kart kendi kaydeder; Kaydet/Geri al yalnızca değişiklik varken görünür; RHF `values` + `keepDirtyValues` ile başka kartın kaydı bu karttaki düzenlemeyi silmez |
| LeaveGuard | Uzun formlar (sihirbaz, kampanya) | Kaydedilmemiş değişiklikle sayfadan çıkarken onay; kayıttan sonraki yönlendirme `ignoreBlocker` ile |
| Sunucu panosu (board) | Sunucunun filtreleyemediği hesaplanan durumlar | Sipariş aşaması ve satılabilir stok gibi: en yeni N kayıt sunucuda sıralanır, sekme sayıları ve `limited` bayrağıyla döner (`/admin/order-board`, `/admin/stock-board`) |

---

## 8. Erişilebilirlik ve performans

- Kontrast AA; tema motoru garanti eder, axe testi doğrular: `e2e/a11y.e2e.ts` her ekranı açık ve koyu modda denetler (kayıtlı mod ne olursa olsun; CI'ın yeni mağazası açık, geliştiricininki koyu olabilir).
- Her etkileşimli öğe klavyeyle; odak çizgisi token'dan ve yalnızca klavye modunda; diyaloglar ESC ile kapanır, odak tuzağı.
- `aria-live` ile sonuç bildirimi; tablo başlıkları `scope`.
- İlk yükleme: kod bölme route başına; grafik kütüphanesi yalnızca dashboard'da yüklenir.
- Her üç durum: iskelet, boş, hata (docs/06).

---

## 9. Kontrol listesi (her panel PR'ı)

- [ ] Yalnızca token kullanıldı; sabit renk, px köşe, gölge yok.
- [ ] §3 kara listesinden hiçbir öğe yok.
- [ ] Sayfa başlığı deseni; tek birincil eylem.
- [ ] Üç durum tasarlandı ve testli.
- [ ] Metinler `locales/tr.json`'da; sözlüğe uygun; ünlem yok.
- [ ] Klavye ve axe testi geçti.
- [ ] Mobil genişlikte (375 px) çalışıyor.
- [ ] Denge (§2): yan yana kartlar `PageGrid`/`PageColumn` ile; satırdaki kontroller tek boy; `e2e/layout.e2e.ts` geçti; ekran görüntüsüne bakıldı.
- [ ] Açık ve koyu modda, keskin ve yuvarlak köşede bakıldı.

Testle korunanlar (F12 Y12): sabit renk, hex ve px köşe yasağı, TR/EN anahtar eşleşmesi ve Türkçe metinde ünlem yok (`src/theme/house-rules.spec.ts`; bilinçli istisnalar gerekçesiyle listede). Geliştirmede bulunmayan çeviri anahtarı konsola yazılır, e2e koruyucusu bunu hata sayar. Bütün ekranlar açık ve koyu modda axe'tan (`e2e/a11y.e2e.ts`), 375 px'te taşma denetiminden (`e2e/phone.e2e.ts`, listelerin ilk kaydı dahil) ve denge ölçümünden (`e2e/layout.e2e.ts`) geçer; ekran listesi `e2e/support/screens.ts`. Tailwind'in gölge ölçeği (`shadow-xs` ile `shadow-xl` arası) tema gölgelerine bağlıdır (`--shadow-card`, `--shadow-overlay`). Yana kayan tablo kutusu yalnızca kaydığında klavyeyle odaklanır.
