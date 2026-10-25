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

### 4.3 Bileşen ve yerleşim (ayarlardan yönetilir)
| Token | Varsayılan | Kaynak |
| --- | --- | --- |
| `--radius` (sm/md/lg türetilir) | 8 px | Görünüm ayarı: köşe |
| `--control-height`, `--row-height` | 36 / 40 px | Görünüm ayarı: yoğunluk |
| `--border-width`, `--border` | 1 px, nötr-200 | sabit |
| `--sidebar-width`, `--sidebar-width-icon` | 264 / 56 px | sabit |
| `--topbar-height` | 56 px | sabit |
| `--content-max-width`, `--page-padding` | 1280 / 24 px | sabit |
| `--dialog-width-sm/md/lg` | 420 / 560 / 760 px | sabit |
| `--overlay` | nötr-900 %40 | sabit |
| `--shadow-overlay` | tek gölge | sabit |
| `--focus-ring` | marka, 2 px, 2 px ofset | sabit |

Bir bileşenin boyutu, çizgisi ya da köşesi sabit kodlanmaz; token'dan okunur. Yeni bir değer gerekiyorsa önce token eklenir.

---

## 5. Tema motoru (`src/theme/engine.ts`)

Mağaza sahibi beş şey seçer; gerisi türetilir:

| Ayar | Değerler | Etkisi |
| --- | --- | --- |
| Marka rengi | hex | `--primary`, `--ring`, seçili durumlar, grafik-1, nötr ölçeğin tonu |
| Logo | açık ve koyu için görsel | Menü başı, giriş sayfası |
| Köşe | keskin / yumuşak / yuvarlak | `--radius` 4 / 8 / 12 |
| Yoğunluk | ferah / kompakt | kontrol ve satır yükseklikleri |
| Mod | açık / koyu / sistem | anlamsal token seti |

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
│   │   ├── settings/
│   │   └── <alan>/{api,components,pages,schemas}/
│   ├── components/
│   │   ├── ui/               # shadcn üretimi, bizim sahipliğimizde
│   │   ├── patterns/         # PageHeader, DataTable, Wizard, StatCard, EmptyState, StatusBadge, ConfirmDialog, FormSection
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
- `components/ui` yalnızca shadcn CLI ile değişir; özelleştirme token'la yapılır, bileşen kodunu elle boyamak yok.
- Bir desen (`patterns/`) iki yerde kullanılmadan önce yazılmaz; üç yerde kopyalanmadan önce desen olur.
- Dosya ~300 satır, fonksiyon ~50 satır (docs/10).

---

## 7. Desenler

| Desen | Ne zaman | Notlar |
| --- | --- | --- |
| PageHeader | Her sayfa | Başlık, bir cümle açıklama, sağda tek birincil eylem, ikincil eylemler menüde |
| DataTable | Her veri listesi | Yapışkan başlık, satır hover, durum rozeti, seçim + toplu işlem çubuğu, sunucu sayfalama, URL'de filtre |
| Wizard | Çok adımlı oluşturma | Numaralı adımlar, her adımda tek soru grubu, taslak olarak kaydet, geri dönülebilir, ilerleme |
| StatCard | Dashboard | Etiket, büyük sayı (tabular), bir cümle bağlam, isteğe bağlı küçük çizgi grafik |
| EmptyState | Boş liste | Bir cümle + bir eylem |
| StatusBadge | Sipariş/ödeme/kargo durumu | Yalnızca durum renkleri; metin sözlükten |
| ConfirmDialog | Geri alınamaz işlem | Özet + açık eylem adı ("Siparişi iptal et"), "Tamam" değil |
| FormSection | Formlar | Başlık + açıklama solda, alanlar sağda (geniş ekranda); doğrulama satır altında |
| Toast | Sonuç bildirimi | Kısa, eylem bağlantılı; hata toast'ı kalıcı, başarı 4 sn |

---

## 8. Erişilebilirlik ve performans

- Kontrast AA; tema motoru garanti eder, axe testi doğrular.
- Her etkileşimli öğe klavyeyle; odak halkası token'dan; diyaloglar ESC ile kapanır, odak tuzağı.
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
- [ ] Açık ve koyu modda, keskin ve yuvarlak köşede bakıldı.
