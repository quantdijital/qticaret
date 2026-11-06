# 21 — Vitrin performans ölçümü: Core Web Vitals ve Lighthouse (2026-11-03)

> docs/20 "CWV / Lighthouse kapanışı" (D12). Üretim derlemesinde yerel ölçüm; kod değişmedi. Bütçe (docs/03 F18): LCP ≤ 2,5 sn, INP ≤ 200 ms, CLS ≤ 0,1 (mobil, p75). Bu laboratuvar ölçümü sahadaki p75'in yerine geçmez; saha verisi (CrUX/RUM) yayından sonra alınır.

## Kurulum

- **Vitrin:** `next build` (Next 16.4.2, Turbopack) ve `next start --port 8000`, `NODE_ENV=production`. Her sayfa `force-dynamic`.
- **Backend:** `medusa develop` (`NODE_ENV=development`), tek süreç, Postgres ve Redis Docker'da, demo verisi. **TTFB dev backend'i içerir; CDN yok**, localhost'ta HTTP/1.1 ve gzip (brotli yok). Üretimde TTFB'ye ağ gecikmesi eklenir ama dev backend'in ek yükü düşer.
- **Lighthouse 13.6.0**, Chrome for Testing 156 (Playwright'ın kurduğu), headless. Mobil (varsayılan: Moto G Power, yavaş 4G simülasyonu, 4x CPU) ve masaüstü preset. Sayfa başına 3 koşu, **medyan**.
- **Çapraz kontrol:** (a) 3 sayfada gerçek ağ kısıtlamasıyla (`--throttling-method=devtools`) 2'şer koşu; (b) INP için Puppeteer'la mobil görünüm ve 4x CPU altında tıklama ölçümü (Event Timing); (c) görselleri yüklemek için CSP'si devre dışı bırakılmış Lighthouse koşusu (aşağıda "Ölçümün sınırları").
- **Demo verisinin sınırları:** 10 üründen yalnızca biri görselli. Store API'de ürünü olan kategori yok, bu yüzden kategori sayfası boş bir üst kategoriyle ölçüldü (`/kategori/el-yapimi-caki`). İlk ziyaret: çerez bildirimi açık.

## Sonuçlar

Puanlar: Performans / Erişilebilirlik / En iyi uygulamalar / SEO. Süreler medyan; "koşular" mobil performans puanlarının üçü.

| Sayfa | Mobil P/A/BP/SEO | Mobil LCP · CLS · TBT · TTFB | Koşular | Masaüstü P/A/BP/SEO | Masaüstü LCP · CLS · TBT · TTFB |
|---|---|---|---|---|---|
| `/` | 84 / 100 / 92 / 100 | 4,51 sn · 0 · 45 ms · 135 ms | 83, 100, 84 | 100 / 100 / 92 / 100 | 0,23 sn · 0 · 0 · 95 ms |
| `/urun/keten-gomlek` | 84 / 100 / 92 / 100 | 4,51 sn · 0 · 37 ms · 167 ms | 100, 83, 84 | 100 / 100 / 92 / 100 | 0,22 sn · 0 · 0 · 108 ms |
| `/kategori/el-yapimi-caki` | 100 / 100 / 92 / 91 | 0,81 sn · 0 · 40 ms · 56 ms | 100, 100, 100 | 100 / 100 / 92 / 91 | 0,23 sn · 0 · 0 · 84 ms |
| `/magaza` | 100 / 99 / 92 / 100 | 0,83 sn · 0 · 56 ms · 123 ms | 82, 100, 100 | 100 / 99 / 92 / 100 | 0,24 sn · 0 · 0 · 156 ms |
| `/arama?q=gomlek` | 99 / 98 / 92 / 54* | 0,79 sn · 0 · 92 ms · 108 ms | 99, 100, 99 | 100 / 98 / 92 / 54* | 0,22 sn · 0 · 0 · 95 ms |
| `/sepet` | 100 / 100 / 92 / 54* | 0,79 sn · 0 · 27 ms · 26 ms | 100, 84, 100 | 100 / 100 / 92 / 54* | 0,22 sn · 0 · 0 · 50 ms |
| `/blog` | 100 / 100 / 92 / 100 | 0,80 sn · 0 · 54 ms · 46 ms | 100, 83, 100 | 100 / 100 / 92 / 100 | 0,22 sn · 0 · 0 · 36 ms |
| `/kategoriler` | 100 / 100 / 92 / 100 | 0,79 sn · 0 · 71 ms · 29 ms | 84, 100, 100 | 100 / 100 / 92 / 100 | 0,22 sn · 0 · 0 · 28 ms |

\* `/arama` ve `/sepet` bilerek `noindex` (docs/13): SEO 54, `is-crawlable` ve meta açıklama denetimlerinden. Hata değil.

**Her sayfada aynı:** JS 199–200 KB aktarım (8–9 dosya; ham ~670 KB), toplam ~600 KB. Bunun **354 KB'ı önceden yüklenen 4 yazı tipi dosyası**. HTML gzip'le 18–25 KB.

**Gerçek ağ kısıtlamasıyla mobil (devtools, 2 koşu):** `/` LCP 1,76–1,81 sn (P 98–99) · ürün 1,78–2,10 sn (P 97–99) · `/magaza` 1,75 sn (P 99). Üçü de 2,5 sn bütçesinin altında. LCP'nin ~1,6 sn'si "render gecikmesi": ana CSS (16,8 KB) yazı tipleriyle bant genişliğini paylaştığı için 1,66 sn'de iniyor (aşağıda 1. düzeltme).

**INP (laboratuvar, mobil, 4x CPU, 3 koşu):** `/` en kötü 72–96 ms (mobil menüyü açma) · ürün 40 ms (adet artır, sepete ekle) · `/magaza` 64–80 ms. Hepsi 200 ms'nin altında. Lighthouse gezinme kipi INP ölçmez; TBT 27–92 ms (iyi).

**CLS:** her sayfada 0 (ürün sayfasında devtools koşusunda 0,001). Görsellerde genişlik/yükseklik ya da en-boy oranlı kutu var; yazı tiplerinde `next/font` ölçü ayarlı yedek yazı tipi kullanıyor.

### Mobil puanın 83 ile 100 arasında gidip gelmesi

Aynı sayfada koşular 100 ya da ~83 çıkıyor; fark yalnızca LCP'de (0,8 sn ↔ 4,5 sn). Gözlenen LCP her koşuda 80–240 ms ve FCP'ye eşit. 4,5 sn Lighthouse'un simülasyonundan (Lantern) geliyor: kötümser senaryo LCP'den önce başlayan her isteği sayıyor (yazı tipleri 354 KB + JS 200 KB + CSS + HTML ≈ 600 KB, yavaş 4G'de ~4,5 sn). Hangi senaryonun seçileceği koşudan koşuya değişiyor. Kalıcı çözüm LCP'den önce inen baytı azaltmak (1. ve 4. düzeltme). PageSpeed Insights da aynı simülasyonu kullandığı için yayında da benzer dalgalanma görülür.

## LCP öğeleri

| Sayfa | Mobil | Masaüstü |
|---|---|---|
| `/` | Hero açıklaması `section.grid > div.flex > p.max-w-xl` (metin) | Hero `h1` |
| Ürün | Çerez bildirimi metni (`form … > p.text-sm`). Devtools koşusunda görselsiz ürünün baş harfi ("K") | Çerez bildirimi metni |
| Kategori, `/magaza`, `/arama` | Çerez bildirimi metni | Sayfa `h1`'i |
| `/sepet`, `/kategoriler` | Çerez bildirimi metni | Çerez bildirimi metni |
| `/blog` | Çerez bildirimi metni. Görseller açılınca kapak görseli (`loading="eager"`, `fetchpriority="high"`: doğru) | Çerez bildirimi metni |

Çerez bildirimi ilk ziyarette çoğu sayfanın LCP öğesi. Sunucuda render edildiği için LCP = FCP ve ceza yok. **Bildirim istemcide geç render edilirse LCP her sayfada kayar; sunucu render'ı korunmalı.** Görsel LCP'si ölçülemedi (aşağıda).

## Düzeltme listesi (öncelik sırasıyla)

Etiketler: **[vitrin]** yalnız `apps/storefront` · **[tema]** yalnız `packages/themes/base` (veya `packages/ui`) · **[backend]** backend/veri gerekir.

1. **Yazı tipi yükünü 354 KB'tan ~125 KB'a indir.** [vitrin] + [tema kararı]
   - Bulgu: Inter ve Fraunces, `latin` ve `latin-ext` alt kümeleriyle 4 dosya ve dördü de her sayfada önceden yükleniyor (Inter 48+84 KB, Fraunces 118+104 KB). Türkçe metin ğ/Ş/İ/₺ içerdiği için `latin-ext` her sayfada iniyor. Oysa Türkçenin `latin-ext`'ten istediği 6 glif, Inter'de 3 KB, Fraunces'te 11 KB tutuyor. Fraunces `SOFT` eksenini tam aralıkla taşıyor ama tema yalnızca `"SOFT" 50` kullanıyor. Ekseni 50'ye sabitleyince latin dosyası 121 KB'tan 67 KB'a iniyor (fontTools ile ölçüldü).
   - Yapılacak: `next/font/local` ile "latin + Türkçe" tek alt küme. Fraunces `SOFT=50` sabitlenmiş, `opsz` ve `wght` eksenleri korunuyor. Önceden yükleme yalnızca gövde yüzüne. Dosyalar: `apps/storefront/src/app/fonts.ts`, yazı tipi dosyaları (`apps/storefront/src/app/fonts/`); `packages/themes/base/src/styles.css` değişmez. OFL lisansı alt küme almaya izin verir; ayrılmış ad (RFN) koşulu kontrol edilmeli.
   - Ek bulgu: önceden yükleme derleme anında Inter + Fraunces'e sabit. Mağaza başka yüz seçerse bu 354 KB boşa iner, seçilen yüz önceden yüklenmez (`fonts.ts` açıklaması bunu kabul ediyor). Seçilen yüz kadar önceden yükleme ya da hiç önceden yükleme yapılmamalı; ölçü ayarlı yedek yazı tipi sayesinde CLS korunur.
   - Beklenen kazanç: ilk ziyarette −230 KB. Devtools kısıtlamasında mobil LCP ~1,8 sn → ~1,1–1,3 sn (CSS bant genişliği için yarışmaz). Lantern'in kötümser LCP'si ~1 sn düşer, 83 ↔ 100 dalgalanması daralır.

2. **CSP'ye `style="pointer-events:none"` özetini ekle.** [vitrin]
   - Bulgu: Radix NavigationMenu, kapalı açılır menülerde (6 adet) `style="pointer-events:none"` yazıyor. `style-src-attr` yalnızca `position:relative` özetine izin veriyor, bu yüzden her sayfada 6 CSP ihlali konsola düşüyor ve BP 92 kalıyor.
   - Yapılacak: `apps/storefront/src/lib/security/csp.ts` `RADIX_STYLE_HASHES` listesine `'sha256-1OjyRYLAOH1vhXLUN4bBHal0rWxuwBDBP220NNc0CNU='` (yöntem, mevcut özetle doğrulandı) ve birim testi.
   - Kazanç: BP 92 → 100 (üretimde görseller https olduğu için kalan konsol hatası da yok).

3. **Sayfa başına backend çağrılarını azalt.** [vitrin]
   Ölçüm, çerezsiz tek istek. Backend günlüğünde (`GET /store/...` satırları): ana sayfa 22, ürün 15, kategori/mağaza/arama 12, blog 10, sepet/kategoriler 8 çağrı.
   - **Yasal metin 404'leri önbelleğe girmiyor:** her sayfada 6 `GET /store/legal/*` → 404 (demo mağazada yayında metin yok). `shared()` hatayı önbelleğe almıyor ve `legalDocument` 404'ü null'a çeviriyor. "Yok" yanıtı da kısa süre önbelleğe alınmalı; `/store/legal/` tazeleme sinyali zaten bu anahtarları temizliyor. Dosyalar: `src/lib/views/legal.ts`, `src/lib/store-api/server.ts` / `shared.ts`.
   - **Oturumsuz ziyaretçi için `GET /store/customers/me` → 401** her sayfada (ürün sayfasında 2 kez). Oturum çerezi yoksa istek atılmamalı, sonuç `cache()` ile istek başına bir kez alınmalı. Dosya: `src/lib/account/auth.ts`.
   - **`/store/seo/resolve` ürün ve kategori sayfasında 2 kez:** biri proxy'de, biri sayfada. Ürün sayfasının en yavaş çağrısı (36 ms). Proxy çözümü istek başlığıyla sayfaya geçirilebilir. Dosyalar: `src/proxy.ts`, `src/lib/store-api/requests.ts`.
   - **`/icon.svg` proxy'den geçiyor:** her sayfa görüntülemesinde `seo/resolve?path=/icon.svg?...` + `POST /store/seo/not-found` çağrılıyor. Bu **SEO 404 günlüğünü ikonla kirletiyor**. Ayrıca ikon `max-age=0` ile sunuluyor. `icon.svg` (ve ileride `apple-icon`, `manifest`) matcher dışına ya da `isSystemPath`'e alınmalı. Dosyalar: `src/proxy.ts` (`config.matcher`), `src/lib/seo/paths.ts`.
   - Kazanç: ürün sayfasında 15 → ~6 çağrı, TTFB −20…40 ms. Backend'in IP başına sınırı daha geç dolar.

4. **Düzen istemci JS'ini tembel yükle.** [tema]
   - Bulgu: her sayfaya inen ortak parça 48 KB gz (`CartDrawer`, `MobileMenu`, `CookieDialog`, `CategoryNav` + Radix Dialog/Sheet/Accordion/Checkbox/NavigationMenu). Lighthouse bunun %55'ini ilk yüklemede kullanılmamış buluyor (toplam kullanılmayan JS 73–77 KB). Masaüstü `CategoryNav` mobilde de hydrate ediliyor.
   - Yapılacak: çekmece, menü ve çerez tercihleri içeriklerini açılınca yükle (`next/dynamic` ya da tetikleyici + tembel içerik). Masaüstü menüyü mobilde hydrate etme. Dosyalar: `packages/themes/base/src/layout/{CartDrawer,MobileMenu,CookieDialog,CategoryNav}.tsx`.
   - Kazanç: −20…30 KB gz JS. TTI (mobil 4,0–4,5 sn) ve TBT düşer, Lantern LCP'si iyileşir. INP zaten iyi.

5. **Render'ı engelleyen CSS.** [vitrin]
   - Bulgu: 2 CSS dosyası (16,8 KB + 2,6 KB gz). Lighthouse mobilde ~400 ms kazanç tahmin ediyor. `globals.css` `@source` ile `packages/ui/src`'nin tamamını tarıyor; vitrinin kullanmadığı bileşenlerin sınıfları da CSS'e giriyor.
   - Yapılacak: önce `@source`'u daraltıp CSS'i küçült. Sonra `experimental.inlineCss`'i dene: deneysel, CSS'i RSC yükünde ikiler ve satır içi `<style>`'ın CSP nonce'u alıp almadığı doğrulanmalı, yoksa sayfa stilsiz kalır. Dosyalar: `apps/storefront/src/app/globals.css`, `apps/storefront/next.config.ts`.
   - Kazanç: mobil FCP/LCP −100…400 ms (simülasyon). 1. düzeltmeden sonra yeniden ölçülmeli.

6. **Başlık sırası (erişilebilirlik).** [tema] `/magaza` ve `/arama`'da ürün kartı `h3`, `h1`'den hemen sonra geliyor (`h2` yok). Liste sayfasında ızgaranın önüne görünmez bir `h2` eklenmeli ya da kart başlık düzeyini parametre olarak almalı. Dosyalar: `packages/themes/base/src/ListingPage.tsx`, `components/ProductCard.tsx`. Kazanç: A 98/99 → 100.

7. **İçerik (blog) görselleri türevsiz.** [backend] + [tema] Blog kapağı tek özgün JPG: `srcset` yok, genişlik/yükseklik yok. LCP öğesi olduğunda Lighthouse 16 KiB tasarruf görüyor (demo görseli 19 KB; gerçek fotoğraflarda fark büyür). İçerik medyası için de AVIF/WebP türevleri (adr/0016) ve ölçüler gerekli. `PostCard` bunları `ResponsiveImage`'a geçirmeli.

8. **Boş kategoride meta açıklama yok.** [backend] `/kategori/el-yapimi-caki`'de SEO 91. Kategori açıklaması boşsa `seo` yükü açıklama üretmiyor. SEO advisor bunu işaretlemeli ya da şablonlu yedek açıklama üretilmeli (docs/13, docs/14).

9. **Ürün sayfası kırıntısı 404'e bağlanıyor.** [vitrin] + [veri] `/urun/keten-gomlek` kırıntısı `/kategori/giyim`'e bağlanıyor, o adres 404 (kategori Store API listesinde yok). Kırıntı yalnızca yayında olan kategorilere bağlanmalı. Performans dışı bulgu; iç bağlantı hatası olarak SEO'yu etkiler.

10. **Eski tarayıcı polyfill'leri (14 KB).** Next çekirdeğinin kendi paketinde (`Array.prototype.at`, `Object.hasOwn` …). Düşük öncelik, Next sürümleriyle izlenir.

## Ölçümün sınırları

- **Görseller ölçümde yok:** üretim CSP'si `img-src … https:` istiyor; dev MinIO `http://localhost:58333` olduğu için görseller engellendi (konsol hatası, BP'yi de etkiler). CSP'yi atlayan ayrı Lighthouse koşusunda (`/`, `/blog`, `/magaza`) yalnızca blogun LCP öğesi kapak görseline döndü; diğerleri değişmedi, CLS 0 kaldı. Gerçek ürün fotoğraflı bir katalogda ürün ve kategori ölçümü staging'de (F16, https + CDN) tekrarlanmalı.
- Demo katalog küçük ve kategoriler boş; liste sayfalarının DOM ve görsel yükü gerçek mağazada büyür.
- Mobil puanlar simülasyon kaynaklı iki moda ayrılıyor (yukarıda). Karar için devtools kısıtlamalı ölçüm ve yayından sonra saha verisi esas alınmalı.

## Tekrar üretme

`pnpm --filter storefront build`, ardından env'le `next start --port 8000` (anahtar: dev backend `GET /dev/storefront-key`). `npx lighthouse@13.6.0 <url> --chrome-flags="--headless=new" [--preset=desktop]`, `CHROME_PATH` Playwright'ın Chromium'u. Bu ölçümün ham JSON raporları oturumun geçici klasöründeydi; kalıcı arşiv istenirse `docs/perf-raporlari/` altına özet eklenir.

## Yapılanlar (2026-11-03)

Düzeltme listesinin 1, 2, 3 ve 6. maddeleri yapıldı; 4. madde ertelendi (aşağıda). Bu oturumda Lighthouse ölçümü yapılmadı; puanlar yeni üretim derlemesinde yeniden ölçülecek. Doğrulama: birim testleri, e2e ve `next build`.

### 1. Yazı tipleri: varsayılan mağazada 350 KB → 122 KB

- **`next/font` kaldırıldı.** Yedi yüz `apps/storefront/public/fonts/` altında, `@font-face` kuralları `src/app/fonts.css`'te. Her yüzün değişkeni (`--font-inter` …) `:root`'ta. `<html>` artık yazı tipi sınıfı taşımıyor.
  - Neden `next/font/local` değil: next/font'un önyüklemesi derleme anında sabittir ve her sayfaya aynı gider. Mağazanın yüzü ise çalışma anında `theme.typography`'den gelir (adr/0053 §B).
  - Dosyalar bilinen adreslerde olunca layout yalnız seçilen yüzleri `<link rel="preload" as="font" crossorigin>` ile önyükler (`app/fonts.ts` `fontPreloads`). React bu bağlantıları `<head>`'e taşır.
- **Önyükleme kararı:** önce gövde yüzü, sonra başlık yüzü.
  - Gövde yüzü telefonda ilk metni çizer (hero satırı, çerez bildirimi).
  - Başlık yüzü de önyüklenir: üst bilgideki mağaza adı (logo yoksa) ve her sayfanın `h1`'i bu yüzle, her sayfada ilk ekranda.
  - Seçilmeyen beş yüz için hiçbir şey inmez: tarayıcı `@font-face` dosyasını yalnız o yüzle metin çizilince ister.
- **Alt küme.** Her yüz iki dosya, aynı aile adı altında `unicode-range` ile:
  - Google Fonts'un `latin` dosyası, olduğu gibi. Kaynak: next/font/google'ın son derlemede indirdiği dosyalar.
  - `latin-ext` dosyasından yalnız Türkçenin istediği harfler: Ğ ğ İ Ş ş ₺. `ı` zaten `latin`'de. Playfair Display ve DM Serif Display'de ₺ yok; onu yedek yazı tipi çizer (önceden de böyleydi).
  - Tek dosyaya birleştirilmedi: tam kaynak dosyası bu ortamda indirilemedi ve fontTools değişken yazı tiplerini birleştirmiyor. Bedeli: `latin` ile Türkçe harf arasında kerning yok (Google'ın kendi bölmesinde de yok).
  - Fraunces `SOFT` 50'ye sabitlendi (tema yalnız bu değeri kullanıyor); `opsz` ve `wght` eksenleri duruyor. Inter yalnız `wght` taşıyor (önceki gibi).

  | Yüz | Önce (`latin` + `latin-ext`) | Sonra (`latin` + Türkçe) |
  |---|---|---|
  | Inter | 47 + 83 KB | 47,3 + 3,2 KB |
  | Fraunces | 117 + 103 KB | 65,3 + 6,3 KB |
  | Playfair Display | 37 + 20 KB | 37,6 + 2,8 KB |
  | DM Serif Display | 17 + 6 KB | 17,4 + 1,6 KB |
  | Manrope | 23 + 14 KB | 23,9 + 2,4 KB |
  | Source Sans 3 | 28 + 58 KB | 28,1 + 2,6 KB |
  | Nunito | 38 + 34 KB | 38,2 + 3,6 KB |

  Varsayılan mağazanın önyüklediği dört dosya 350 KB'tan 122 KB'a indi.
- **CLS:** her yüzün yedek yazı tipi (Arial ya da Times New Roman) next/font'un ölçüleriyle aynı (`size-adjust`, `ascent-override` …), `font-display: swap`.
- **Önbellek:** dosya adında içeriğin sha256 özetinin ilk 10 hanesi var; dosya değişirse adresi de değişir.
  - `next.config.ts`: `/fonts/:file` → `public, max-age=31536000, immutable`. `public/` dosyalarının varsayılanı `max-age=0`.
  - Geliştirme sunucusunda e2e doğruladı. Üretimde yeniden ölçümde başlığa bakılmalı.
- **Proxy:** dosyalar matcher'ın dışında (`fonts/[a-z-]+\.[0-9a-f]{10}\.woff2$`) ve `isStaticFile`'da. Resolve gitmez; bakım sayfası yazı tipini kesmez.
- **Lisans (OFL 1.1):** dosyalar telif satırını ve lisans adresini (name 0 ve 14) taşıyor.
  - Ayrılmış adlı iki yüzden (Playfair Display; Source Sans 3, RFN "Source") kesilen Türkçe dosyalarının iç adı değiştirildi: "Qticaret Ext Serif" ve "Qticaret Ext Sans". `latin` dosyaları Google'ın dağıttığı haliyle duruyor.
  - CSS aile adları bizim (`qt-inter` …).
- **F16:** standalone imajına `.next/static` gibi `public/` de kopyalanmalı.
- **Yeni yüz ya da yeni sürüm eklerken:**
  1. Google Fonts CSS API'den `latin` ve `latin-ext` woff2'lerini al.
  2. Türkçe dosyayı fontTools'la kes: `pyftsubset <latin-ext>.woff2 --unicodes=U+011E,U+011F,U+0130,U+015E,U+015F,U+20BA --layout-features='*' --flavor=woff2`. Ayrılmış adlı yüzde iç adı değiştir. Fraunces'te önce `fontTools.varLib.instancer` ile `SOFT=50`.
  3. Dosyayı içerik özetiyle adlandır, `fonts.css` ve `FONT_FILES`'a ekle. `app/__tests__/fonts.spec.ts` ad, özet ve liste uyumunu denetler.

### 2. CSP: `pointer-events:none` özeti

`RADIX_STYLE_HASHES`'e `'sha256-1OjyRYLAOH1vhXLUN4bBHal0rWxuwBDBP220NNc0CNU='` eklendi. Özet, değerin tam metninden (`pointer-events:none`) yeniden hesaplanarak doğrulandı. Birim testi her özeti değerinden hesaplar. `unsafe-inline` yok.

### 3. Sayfa başına backend çağrıları

- **Yasal metin 404'leri:** `storePublicFind` (`lib/store-api/server.ts`) 404'ü "yayında değil" (null) sayar ve bulunan yanıt gibi 60 sn tutar. 5xx ve zaman aşımı tutulmaz. Yenileme sinyalinin `legal` kapsamı bunları da siler. `legalDocument` bunu kullanıyor: her sayfadaki 6 `GET /store/legal/*` artık dakikada bir.
- **`/store/customers/me`:** oturum çerezi yoksa ya da jetonun süresi geçmişse istek atılmaz. React `cache` ile istek başına bir kez sorulur (ürün sayfasında 2 → 1, ziyaretçide 0).
- **`seo/resolve`:** backend rotası ziyaretçiden bağımsız: yalnız `path`'i okur ve `public, max-age=60` döner. Bu yüzden süreç içi 10 sn önbellek eklendi (adr/0046 Ek 2026-11-03).
  - Yalnız `entity` ve `not_found` yanıtları tutulur; `redirect` kural vuruşlarını saydığı için tutulmaz.
  - Ürün ve kategori sayfasında proxy'nin yanıtını sayfa kullanır: 2 → 1.
- **`/icon.svg` hatası:** proxy matcher'ı `icon\.svg$`, `apple-icon\.png$`, `manifest\.webmanifest$` (ve yazı tipleri) için tam eşleşmeyle dışarıda bırakıyor. Aynı liste `isStaticFile`'da; proxy'ye ulaşırsa da sayfa sayılmaz.
  - Birim testi Next'in derlediği biçimle (`functions-config-manifest.json`) matcher'ı ve `isStaticFile`'ı karşılaştırır.
  - e2e: `/icon.svg` ikonu döner ve proxy'nin her yanıta koyduğu CSP başlığını taşımaz.
- Çağrı sayıları ölçülmedi; yeniden ölçümde backend günlüğüyle sayılmalı.

### 6. Başlık sırası

- Liste sayfalarında (`/magaza`, `/arama`, kategori, marka, `/kampanyalar`) "N ürün" satırı artık ızgaranın `h2`'si. Ürün kartları (`h3`) `h1`'in hemen altına düşmüyor.
- Görünüm aynı: `font-sans text-sm font-medium tracking-normal`; tema `h2`'ye başlık yüzü verdiği için yazı tipi sınıfı açıkça yazıldı. Yeni i18n anahtarı yok.
- `/blog` zaten doğruydu: `h1`, ardından `PostCard` `h2`.
- e2e: axe `heading-order` kuralı 11 sayfada (ana sayfa, ürün, liste, arama, blog, kategoriler, markalar, yorumlar, sepet). Eski işaretlemeyle `/magaza` ve `/arama`'da kırmızı verdiği denendi.

### Ertelenen: 4. madde (düzen JS'ini tembel yükleme)

Yapılmadı. Nedenler:

- `next/dynamic` temayı Next'e bağlar. `@qticaret/theme-base` yalnız React'e bağlı ve tema yalnız sunumdur (adr/0046 §7).
- `CategoryNav`'ın bağlantıları ilk HTML'de kalmalı (docs/13). "Mobilde hydrate etme" ancak hiç çözülmeyen bir Suspense sınırıyla ya da medya sorgusuna bağlı istemci yüklemesiyle olur; ikisi de hydration uyuşmazlığı ve script'siz yedek riski taşıyor.
- Çekmece ve menünün tetikleyicileri hydration'da Radix Dialog'u zaten istiyor. Yalnız içeriği tembel yüklemek Radix'i paylaşılan parçadan çıkarmaz; kazanç tahminden küçük kalır.
- Doğru yol ayrı bir görev: tema sözleşmesine "tembel ada" yuvası (vitrin `next/dynamic` sağlar, tema yalnız bileşeni verir) ve paylaşılan parçanın önce/sonra ölçümü.

## Grafit ölçümü ve düzeltmeler (2026-11-06)

> F18 D12, Grafit teması (`STOREFRONT_THEME=atolye`) ve gerçek katalogla (My L'arte verisi: görselli ürünler, dolu kategoriler, blog). Yukarıdaki 2026-11-03 tablosu `base` temasıyla ve görselsiz demo veriyle alınmıştı. Bu bölüm ondan sonraki durumu anlatır.

### Kurulum

- **Vitrin:** worktree'den `next build` (Next 16.4.2, Turbopack), `next start -p 8100`, `NODE_ENV=production`. Sahibin `:8000`, `:9000` ve `:5173` sunucularına dokunulmadı.
- **Backend:** sahibin çalışan dev backend'i (`medusa develop`). TTFB dev backend'i içerir. CDN yok, HTTP/1.1, gzip.
- **Lighthouse 13.6.0** (Node API, puppeteer-core) ve Chrome for Testing 156, headless.
  - Mobil varsayılan profil (Moto G Power, yavaş 4G simülasyonu, 4x CPU) ve masaüstü preset.
  - Sayfa ve kip başına 3 koşu, **medyan**.
  - Kategoriler: Performans / Erişilebilirlik / En iyi uygulamalar / SEO / Agentic Browsing.
- **Görseller ölçüme dahil:** dev görsel sunucusu `http://localhost:58333`, üretim CSP'si ise `img-src https:` istiyor.
  - Bu yüzden ölçüm tarayıcısında CSP atlandı (`page.setBypassCSP(true)`). Görseller canlıdaki https CDN'den gelir gibi yüklendi.
  - BP'de CSP konsol hatası görünmez. Canlıda görseller https olduğu için sonuç aynı olmalı.
- **Sepet:** her koşudan önce ürün sayfasında "Sepete ekle" (1 satır), ardından HTTP önbelleği boşaltıldı. Sepet çerezi korundu (`disableStorageReset`).
- **İlk ziyaret:** çerez bildirimi açık. Sepet dışındaki sayfalarda depolama her koşuda sıfırlandı.
- **Gürültü:** "sonra" turu, sahibin projeyi taşıyıp sunucularını yeniden başlattığı saate denk geldi.
  - Bazı koşularda TTFB 0,5–1,5 sn çıktı; önce turunda 20–190 ms idi.
  - TBT de bu yüzden 10–20 ms'den 30–100 ms'ye çıktı. Kod değişikliği ana iş parçacığına iş eklemedi; aşağıdaki bayt tablosu bunu gösteriyor.

### Sonuçlar: önce / sonra

P / A / BP / SEO / Agentic. LCP Lighthouse'un simülasyonu (Lantern), medyan.

| Sayfa | Mobil önce | Mobil sonra | Mobil LCP · CLS · TBT önce → sonra | Masaüstü P önce → sonra · LCP |
|---|---|---|---|---|
| `/` | 80 / 97 / 100 / 100 / 100 | 85 / 97 / 100 / 100 / 100 | 5,35 → 4,23 sn · 0 · 12 → 71 ms | 95 → 96 · 1,55 → 1,45 sn |
| `/kategori/el-yapimi-caki` | 100 / 97 / 100 / 100 / 100 | 100 / 97 / 100 / 100 / 100 | 0,95 → 0,96 sn · 0 · 11 → 37 ms | 99 → 99 · 0,88 → 0,84 sn |
| `/urun/el-yapimi-balta-caki-…` | 89 / 97 / 100 / 100 / 100 | 90 / 97 / 100 / 100 / 100 | 3,84 → 3,56 sn · 0 · 17 → 58 ms | 100 → 100 · 0,79 → 0,78 sn |
| `/sepet` (1 satır) | 100 / 97 / 100 / 58* / 100 | 100 / 97 / 100 / 58* / 100 | 0,78 → 0,80 sn · 0 · 6 → 34 ms | 100 → 100 · 0,21 → 0,22 sn |
| `/kategoriler` | 83 / 97 / 100 / 100 / 100 | 85 / 97 / 100 / 100 / 100 | 4,82 → 4,36 sn · 0 · 11 → 64 ms | 100 → 100 · 0,28 → 0,27 sn |
| `/blog/elmax-celik-nedir` | 93 / 97 / 100 / 100 / 100 | 94 / 97 / 100 / 100 / 100 | 3,22 → 3,00 sn · 0 · 16 → 96 ms | 100 → 100 · 0,66 → 0,65 sn |
| `/yorumlar` | 100 / 97 / 100 / 100 / 100 | 100 / 97 / 100 / 100 / 100 | 0,81 → 0,84 sn · 0 · 10 → 32 ms | 100 → 100 · 0,22 → 0,22 sn |
| `/blog/yazar/my-l-arte` | 86 / 97 / 100 / 100 / 100 | 88 / 97 / 100 / 100 / 100 | 4,17 → 3,95 sn · 0 · 13 → 32 ms | 99 → 99 · 0,85 → 0,84 sn |

\* `/sepet` bilerek `noindex,nofollow` ve meta açıklamasız (docs/13 §7). SEO 58 bundan gelir, hata değil.

- Ana sayfanın mobil "sonra" değeri 2 koşudan. Üçüncü koşuda Lighthouse izi kaydedemedi (`NO_NAVSTART`).
  - Aynı kodla ikinci bir tur da koşuldu (TTFB 0,5–1,5 sn). Beş koşu: P 80–86, LCP 4,20–4,46 sn.
- **CLS her sayfada 0.**
- **Gözlenen LCP** (kısıtlamasız) her sayfada 0,1–0,35 sn. Yalnız TTFB'nin 1,4 sn olduğu ana sayfa koşusunda 1,6 sn.
  - Mobildeki 3–5 sn'lik değerler Lantern'in kötümser senaryosundan geliyor: LCP'den önce başlayan her baytı yavaş 4G'de sayıyor (yukarıdaki "Mobil puanın 83 ile 100 arasında gidip gelmesi").
  - Bu değerleri sürükleyen, aşağıdaki türevsiz görseller.
- **LCP öğeleri (mobil):**
  - Ana sayfa: hero görseli (AVIF 800w, `fetchpriority=high`, önyüklü).
  - Ürün: galerinin ilk görseli (eager, high).
  - Blog yazısı ve yazar sayfası: kapak görseli (eager, high).
  - `/kategoriler`: bir kategori kartının görseli.
  - Kategori, `/yorumlar`, `/sepet`: metin (başlık altı satır, yorum, çerez bildirimi).
  - Lighthouse'un "LCP keşfi" denetimi `/kategoriler` dışında her sayfada temiz. Orada LCP görseli `lazy`; aşağıda "Denenip geri alınan".

**Sayfa başına aktarım (mobil, medyan):**

| | Önce | Sonra |
|---|---|---|
| JS | 245–246 KB (10 dosya) | 211–212 KB (9 dosya) |
| CSS (render'ı engelleyen tek dosya) | 31,0 KB (185 KB ham) | 24,0 KB (131 KB ham) |
| Kullanılmayan JS (Lighthouse) | 111–113 KB | 94–96 KB |
| Render'ı engelleme tahmini | 210–270 ms | 20–110 ms |
| `/sepet` görselleri (1 satır) | 301 KB | 81 KB |
| Yazı tipleri | 27 KB (Manrope `latin` + Türkçe, önyüklü, `swap`) | aynı |

**INP (laboratuvar; mobil görünüm, 4x CPU, Event Timing, 3 koşu, sonra):**

| Etkileşim | Süre |
|---|---|
| Mobil menüyü açma (`/`, kategori sayfası) | 88–128 ms |
| Üründe adet artırma, sekme değiştirme | 32–40 ms |
| Ürünü sepete ekleme | 328–360 ms |
| Çerez bildiriminde "Tümünü kabul et" | 304–392 ms |

- Son ikisi sunucu eylemli form gönderimi. 200 ms bütçesini 4x CPU'da aşıyorlar; sürenin ~%90'ı sunum gecikmesi. Aşağıda "Kalanlar" 2. madde.
- **Düzeltme (aynı gün):** bu iki değer ölçüm tarayıcısının bir kusurundan geliyor, sayfanın işinden değil. Gerçek pencereli Chrome'da ikisi de 56–72 ms. Aşağıda "Sepete ekle ve çerez onayı: INP incelemesi".

### Yapılanlar

1. **Grafit artık `baseTheme`'i bütün olarak almıyor.** [tema]
   - **Bulgu:** Turbopack bir sayfanın sunucu modül grafiğinin eriştiği her istemci bileşenini o sayfanın istemci parçasına koyuyor. Bu, render edilmeyen bileşenleri de kapsıyor.
   - `atolyeTheme` `...baseTheme` ile başladığı için base temanın çerçevesi de her sayfaya iniyordu: `CartDrawer`, `CategoryNav`, `CookieDialog`, `MobileMenu`, `SearchForm`, `NewsletterForm` ve Radix Accordion/Checkbox/NavigationMenu. Grafit bunların hiçbirini çizmiyor.
   - Aynı nedenle `@qticaret/theme-base`'ten alınan dört parça da base temanın tamamını getiriyordu: `AddonEditor`, `GiftRecipient`, `OrderReturns`, `OrderGift`.
   - **Yapılan:** base pakete `@qticaret/theme-base/borrow` girişi eklendi (`src/borrow.ts`).
     - Başka temanın ödünç alabileceği beş sayfayı verir: marka, onay, çerez tercihleri, hediye kartı bakiyesi, ödeme bağlantısı.
     - Ayrıca bir ana sayfa bölümünü ve dört akış parçasını verir.
     - Grafit bunları tek tek alıyor. `baseTheme`'in API'si değişmedi; base index aynı parçaları yeniden dışa veriyor.
   - **Kazanç:** temanın paylaşılan istemci parçası 76 → 60 KB gz (288 → 210 KB ham).
2. **Hata sayfaları sözlüğün tamamını taşımıyor.** [vitrin]
   - `app/error.tsx` ve `app/global-error.tsx` istemci bileşeni ve her sayfa onları yüklüyor.
   - İkisi de `@/lib/i18n`'i alıyordu. Böylece `tr.json` (64 KB ham, 19 KB gz, 1069 anahtar) her sayfanın script'ine giriyordu.
   - Artık `lib/i18n/error.ts` yalnız dört anahtarı taşıyor: `error.title`, `error.body`, `error.retry`, `error.home`.
   - Birim testi denetler: değerler `tr.json` ile aynı, iki temanın hata sayfası ve `global-error` başka anahtar istemiyor, iki hata sayfası sözlüğü içe aktarmıyor.
3. **Grafit'in stil dosyası yalnız temanın eriştiği dosyaları tarıyor.** [vitrin] (2026-11-03 listesindeki 5. madde, Grafit için)
   - `themes/atolye.css` önceden `packages/ui/src` ve `packages/themes/base/src`'nin tamamını `@source` ile tarıyordu.
   - Artık Grafit klasörünün tamamını, ui'nin kullanılan dört bileşenini ve `hooks`/`lib`'ini, base'in ödünç alınan sayfa ve parçalarını tarıyor.
   - **Kazanç:** CSS 185 → 131 KB ham, 31,0 → 24,0 KB gz. 548 sınıf düştü; hiçbiri erişilen kaynak dosyalarda geçmiyor (eski ve yeni derlemenin seçicileri karşılaştırılarak doğrulandı). Görünüm aynı.
   - **Koruma:** `themes/__tests__/atolye-sources.spec.ts` temanın ve vitrinin içe aktarmalarını izler ve ulaşılan her `packages/ui` ile `packages/themes/base` dosyasının bir `@source` satırına girdiğini denetler. Grafit yeni bir ui bileşeni ya da base parçası kullanınca `@source` eklenmezse test kırmızı yanar; sessizce stilsiz kalmaz.
   - `base` temasının stil dosyası (`themes/base.css`) değişmedi: o tema iki paketin tamamını kullanıyor.
4. **Sepet, çekmece, ödeme özeti ve sipariş satırları görsel türevlerini kullanıyor.** [vitrin]
   - Satırın küçük resmi (`line.thumbnail`) ürünün yüklendiği haliyle özgün dosyaydı (100–250 KB), 64–128 px'lik kutuda.
   - `linePicturesOf` (`lib/views/line-paths.ts`) satırların ürünlerini `productPathsOf` ile aynı istekte sorar: ürünün `media_assets` alanları, dakikalık ortak önbellek.
   - Küçük resmin adresini medya kaydıyla eşler. Satır böylece AVIF/WebP `srcset`'ini ve ölçülerini alır; kutularda zaten `sizes` vardı.
   - Bilinmeyen küçük resim eskisi gibi gösterilir. Backend reddederse görsel yine gösterilir.
   - **Kazanç:** `/sepet`'te tek satırda görsel 301 → 81 KB (satırın görseli 233 → ~14 KB). Ödeme ve sipariş sayfalarında da aynı.
   - Birim testleri `line-paths.spec.ts`'te.
5. **Favoriler bağlantısının adı göründüğü gibi.** [tema] Üst bilgideki bağlantının `aria-label`'ı "Favorilerim" idi, görünen yazı "Favoriler" (WCAG 2.5.3, axe `label-content-name-mismatch`). Artık `nav.favorites`. Görünüm aynı.

### Denenip geri alınan

- **`/kategoriler`'de ilk kartı öncelikli yüklemek.** Kart `lazy` olduğu için Lighthouse "LCP keşfi"ni işaretliyor.
  - İlk karta `priority` verildi. Ancak LCP öğesi ilk kart değil, türevsiz 94 KB'lık bir kategori kapağı (eşit boyutlu kartlarda tarayıcının seçtiği).
  - Lantern LCP'si 4,4 sn'den 4,7–5,7 sn'ye çıktı. Değişiklik geri alındı.
  - Doğru düzeltme kapakların türevleri (aşağıda 1. madde). Ondan sonra ilk satır yeniden ölçülmeli.

### Kalanlar ve nedenleri

1. **Türevsiz görseller (en büyük kalem).** [backend]
   - Kategori kapakları, blog kapakları ve içerik görselleri tek özgün WebP: `srcset` yok.
   - Ana sayfanın reyon kartları 77–165 KB. `/kategoriler`'de kartlar 94–124 KB, 553 KB tasarruf görülüyor. Yazar sayfasında kapaklar 88–231 KB, 493 KB tasarruf.
   - Mobildeki 3–5 sn'lik Lantern LCP'sinin ana nedeni bu.
   - `GET /store/category-images` boyutu ve türevleri "medya kütüphanesi biliyorsa" veriyor. Taşımayla gelen kapakların (`workflows/migration/category-covers.ts`) türevi yok.
   - İçerik görselleri için de türev ve ölçü gerekli (2026-11-03 listesinde 7. madde).
   - Türevler gelince tema değişmeden küçük dosyayı seçer: kartlarda `sizes` doğru.
   - **Yapıldı (2026-11-06, kod):**
     - **Yüklemede tek yer:** kütüphaneye giren her görsel (`POST /admin/media` `library: true`, adresle içe aktarma, taşımanın kategori ve yazı kapakları) `registerMediaWorkflow` içinde `media.registered` olayını yayar. `media-versions` aboneliği yanıttan sonra `deriveLibraryMediaWorkflow`'u koşar (docs/05 §2: ağır iş worker'da).
       - Ürün görselleriyle aynı türevler: WebP + AVIF 400/800/1600 (görselden geniş olmayan) ve 1200×630 paylaşım kırpması (`lib/media/derive.ts`). Ad görselin kendi adından: `kapak-fotografi-800.avif`.
       - Ürün sihirbazının yüklemesi (`library` yok) yine ürününe bırakılır: türevleri ürün adıyla (adr/0016). Bir ürün görseli tutuyorsa kütüphane koşusu onu atlar; arada ürün türev yaptıysa kütüphanenin dosyaları silinir, ürününki kalır.
       - Sınırlar değişmedi: ana dosya yüklemede temizlenmiş ve boyutu sınırlanmış haliyle okunur; SSRF ve bayt kontrolleri yükleme ve içe aktarmada.
     - **Geriye dönük:** `pnpm --filter @qticaret/backend media:derivatives` (yalnız sayar), `… media:derivatives apply` (yapar).
       - Ana dosyası olan ve türevi olmayan her kayıt, id sırasıyla 50'şer. Ürünsüz olan kendi adıyla; ürün görseli ürününün kendi koşusuyla (ürün adıyla).
       - Türevi olan atlanır: yarıda kesilen koşu kaldığı yerden sürer, ikinci koşu 0 bulur (başaramadıkları hariç, `failed`). Uygulanınca denetim kaydı `media.versions_backfilled`.
     - **Zengin metin:** `GET /store/content/:id` (ve önizleme) ile `GET /store/products/:id/description` artık `images` döner: metindeki kütüphane görsellerinin `url`, `width`, `height`, `derivatives`'i.
       - Vitrin `withPictures` (`lib/views/prose-images.ts`) her bilinen `<img>`'i `<picture>` yapar: AVIF ve WebP `srcset` + `sizes="(min-width: 48rem) 46rem, 100vw"` (okuma sütunu), `width`/`height`, `loading="lazy"`.
       - Kapaksız sayfada metnin ilk iki bloğundaki ilk görsel `loading="eager" fetchpriority="high"`. Kütüphanede olmayan görsel backend'in yazdığı gibi kalır. 8. madde (ölçüsüz içerik görselleri) de bununla kapanır.
     - **Vitrin bileşenleri:** kategori kartları, üst bilgideki kategori paneli, `/kategoriler` başlık küçük resimleri, blog kartları, yazı kapağı, yazar kutusu ve sayfası zaten `ResponsiveImage` ile türevleri basıyordu; değişiklik gerekmedi. `atolye-picture-versions-theme.spec.ts` bunu denetler.
     - **Kalan:** dev DB'de `media:derivatives apply` koşulup `/`, `/kategoriler`, yazar sayfası ve bir yazı yeniden ölçülmeli. `/kategoriler`'de ilk satıra `priority` o zaman yeniden denenmeli.
2. **Sunucu eylemli iki etkileşim 4x CPU'da 300–390 ms.** [tema/vitrin, ayrı görev]
   - "Sepete ekle" ve çerez bildiriminde "Tümünü kabul et".
   - Kırılım (Event Timing): girdi gecikmesi ~25 ms, olay işleyicileri 11–15 ms, **sunum gecikmesi ~290–300 ms**.
   - Yani işleyicinin kendisi hafif. Süre, işleyiciden sonra ve ilk boyamadan önce ana iş parçacığında yapılan işten geliyor: React'in form eylemini başlatırken yaptığı render.
   - Gerçek cihazda süre kabaca dörtte biri (~80–100 ms), ama bütçe p75 mobil için.
   - Bekleyen durumun (`useFormStatus`, `aria-busy`) yalnız düğmeyi yeniden çizmesi ve çerez formunun `key` değişiminin bütün formu yeniden kurmaması incelenmeli. Saha verisi (RUM) gelince öncelik ona göre verilmeli.
   - **Kapandı (2026-11-06):** yukarıdaki açıklama yanlış çıktı. Neden bir ölçüm kusuru; aşağıda "Sepete ekle ve çerez onayı: INP incelemesi".
3. **Temanın istemci parçası hâlâ her sayfada tek dosya.** [vitrin + tema sözleşmesi]
   - Grafit'in paylaşılan parçası 210 KB ham: ürün sayfası 48 KB, çerçeve 30 KB, ödeme 16 KB, hesap 17 KB, Radix ~35 KB.
   - Her rota temanın tüm nesnesini (`theme.ts` → `atolyeTheme`) aldığı için her sayfaya iniyor. Ana sayfada %75'i kullanılmıyor.
   - Rotaya göre bölmek için sayfaların yalnız kendi tema bileşenini içe aktarması gerekir. Bu tema sözleşmesinin (adr/0046 §7, adr/0057) biçimini değiştirir; ADR'lık ayrı bir görev.
   - Tahmini kazanç ana sayfada ~25 KB gz. Ürün, kategori ve içerik aynı yakalayıcı rotada (`[...path]`) olduğu için o rotada daha az.
4. **404 gövdesi ilk HTML'de yok.** [vitrin, ayrı görev] **(SEO)**
   - Durum kodu doğru: 404 ve `noindex`. Ancak `notFound()` ile biten her sayfanın HTML'i Next'in boş hata kabuğu (`<html id="__next_error__">`, `lang` yok, `h1` yok).
   - Örnekler: `/bu-sayfa-yok`, `/urun/olmayan`, `/magaza?sayfa=999`. Sayfa yalnız JS ile istemcide çiziliyor.
   - RSC yükünde `NEXT_HTTP_ERROR_FALLBACK;404` hatası satır olarak var, yani SSR sınırı yakalamıyor.
   - `htmlLimitedBots` kaldırılarak denendi, sonuç aynı. Sahibin dev sunucusunda da aynı. Bu oturumun değişikliklerinden önce de vardı.
   - docs/03 F18 "Non-200 sayfalarda JS render'a güvenilmez" der. 404 sayfasındaki "yol göster" kategorileri JS'siz tarayıcıya ulaşmıyor.
   - **Düzeltildi** (aşağıda "Denetim düzeltmeleri", 1): bilinmeyen adresler için. Sayfanın kendi bulduğu 404'ler (`/magaza?sayfa=999` gibi) Next sınırı olarak kalıyor.
5. **Kanonik ve JSON-LD dev'de ölçülemedi.** [ortam]
   - `seo.canonical_host` dev'de boş. Backend kanonik yoksa `jsonLd`'yi de boş döner (`lib/seo/home.ts`; ürün, liste, içerik de öyle). `/sitemap.xml` 404, `robots.txt`'de `Sitemap:` yok.
   - Ana sayfadaki tek blok vitrinin kendi `FAQPage`'iydi (artık yok, 6. madde).
   - Bloğun biçimi backend birim testleriyle doğrulandı (`src/lib/seo`, 27 takım, 352 test yeşil).
   - `/seo-audit`, `/seo-technical`, `/seo-schema` kabulü (docs/03 F18) kanonik alan adı olan ortamda (F16 staging) koşulmalı. Dev'de alan adı ayarlamak sahibin verisini değiştireceği için yapılmadı.
6. **Ana sayfada `FAQPage`.** [karar] Vitrin SSS bölümünü `FAQPage` olarak basıyor (`lib/seo/faq.ts`, adr/0049 Ek 2026-11-03). docs/13 §5 ise "`FAQPage` kullanılmaz" diyor: Google'ın SSS zengin sonucu Mayıs 2026'da kalktı. Zararsız ama iki belge çelişiyor; sahip kararı. **Karar ve düzeltme:** docs/13 geçerli, `FAQPage` basılmıyor (aşağıda "Denetim düzeltmeleri", 3; adr/0049 Ek 2026-11-06).
7. **Ürün başlığında mağaza adı iki kez.** [backend/veri]
   - `El Yapımı Balta Çakı | 21 cm … Kabza | My L'arte | My L'arte` (99 karakter). Ürünün `seo_title`'ı zaten "| My L'arte" ile bitiyor, şablon bir kez daha ekliyor.
   - Şablon, adla biten başlığa eklememeli ya da advisor uyarmalı (docs/14).
   - Yazar sayfası `My L'arte | My L'arte`: yazar adı mağaza adıyla aynı (veri).
   - **Düzeltildi** (aşağıda "Denetim düzeltmeleri", 2): backend tekrar eden başlık parçasını atar.
8. **İçerik sayfasında ölçüsüz görseller.** [backend/içerik] `/hakkimizda` gövdesinde 3 görselin `width`/`height`'ı yok. Ölçülen CLS 0, ama yavaş bağlantıda kayma riski var. Zengin metin görselleri medya kaydından ölçü almalı. **Düzeltildi** (aşağıda "Denetim düzeltmeleri", 4; yalnız `width`/`height`, `srcset` 1. maddeyle).
9. **Mobil alt çubukta "Ana sayfa" hedefi** (axe `target-size`, A 97).
   - İlk ziyarette çerez kartı alt çubuğun üstüne biniyor ve "Ana sayfa"nın görünen alanı 12 px kalıyor. Bildirim kapanınca sorun yok.
   - Kartın yerini değiştirmek tasarım değişikliği; design.md kilitli olduğu için yapılmadı.
   - Alt çubuktaki sepetin adı "Sepet, 1 ürün", görünen yazı "1 Sepet" (`label-content-name-mismatch`, deneysel kural, puana girmiyor). Sayacın yeri değişmeden düzeltilemiyor.
10. **Hız sınırına takılan istek 500 dönüyor.** [vitrin/backend]
    - İç bağlantı taramasında kısa sürede ~300 istek atıldı. Backend'in IP başına sınırı (`429`) doldu ve vitrin bu sayfaları 500 ile verdi: facet ve arama bağlantıları.
    - Facet adresleri `robots.txt`'de kapalı. Yine de hızlı tarayan bir bot 5xx görür; `503` + `Retry-After` daha doğru.
    - Canlıda vitrin ziyaretçi adresini imzaladığı için sınır bot başına işler.
    - **Düzeltildi** (aşağıda "Denetim düzeltmeleri", 5): sınırdaki ziyaretçinin katalog sayfaları `503` + `Retry-After`. Sınıra çarpan ilk sayfa çizimi 500 kalabilir.
11. **Küçük kalemler:**
    - Next çekirdeğinin eski tarayıcı polyfill'leri (14 KB).
    - `visa.png` 7 KB (6 KB tasarruf).
    - `/yorumlar`'daki yorum fotoğrafları en küçük türev 400w olduğu için küçük kutuda ~20 KB fazla.
    - HTML 300–570 KB ham, 33–55 KB gz; büyük kısmı RSC yükü. `/magaza` en büyüğü.

### Teknik SEO taraması (2026-11-06, JS kapalı ilk HTML)

13 sayfa tarandı: ana sayfa, kategori, ürün, sepet, kategoriler, blog, yazı, yorumlar, yazar, mağaza, arama, 404, içerik.

- **Başlık ve açıklama:** her dizinlenen sayfada var, ilk HTML'de. Açıklamalar 74–149 karakter. İstisna ürün başlığı (99 karakter, yukarıda 7. madde).
- **Robots:**
  - Dizinlenen sayfalar `index,follow`.
  - `/sepet` `noindex,nofollow`, `/arama` `noindex,follow`, 404 `noindex`.
  - `robots.txt` vitrinden geliyor: sepet, ödeme, hesap ve arama kapalı, her facet parametresi `?`/`&` desenleriyle kapalı. Kanonik alan adı yok, bu yüzden `Sitemap:` satırı da yok.
- **Kanonik, `og:url`, JSON-LD:** dev'de yok (yukarıda 5. madde). `hreflang` yok; beklenen durum (F19).
- **URL normalizasyonu:**
  - `/URUN/X` → 301 `/urun/x`.
  - `/kategoriler/` → 301 `/kategoriler`.
  - `/blog//elmax…` → 308 tek eğik çizgiye (Next'in kendi normalizasyonu; docs/13 301 diyor, etki aynı).
- **Başlık yapısı:** her sayfada tek `h1`, düzey atlaması yok. 404'te `h1` ilk HTML'de yok (4. madde; bilinmeyen adresler için düzeltildi).
- **Görseller:** `alt`'sız görsel yok. Boş `alt`'lar süs: adı yanında yazan kart ve satır görselleri. Ölçüsüz görsel yalnız içerik gövdesinde (8. madde).
- **İç bağlantılar:** üst menü, alt bilgi, reyonlar, ürün ve blog bağlantılarının hepsi 200.
  - `/hesap` ve `/hesap/favoriler` girişe 307 (oturumsuz; beklenen).
  - Facet ve arama bağlantılarındaki 500'ler hız sınırından (10. madde). Tek tek açıldığında 200.
- **Lighthouse SEO ve Agentic Browsing:** dizinlenen her sayfada 100 / 100. `/sepet` SEO 58 (bilerek `noindex`).

### Denetim düzeltmeleri (2026-11-06)

Yukarıdaki 4, 6, 7, 8 ve 10. maddeler. Doğrulama: worktree'den üretim derlemesi (`next build`, `next start -p 8102`, Grafit, sahibin dev backend'i), ilk HTML JS'siz okundu.

1. **404 sayfası ilk HTML'de tam.** [vitrin]
   - **Neden:** Next 16.4.2'de çizim sırasında `notFound()` atan **her** dinamik sayfa kabuk hatası sayılıyor. React sunucu çiziminde hata sınırı çalışmaz; Next 404 durumunu verir ama gövde olarak boş `<html id="__next_error__">` kabuğunu gönderir ve `not-found.tsx` yalnız istemcide çizilir.
   - Bu, vitrine özgü değil: yalnız `layout` + `not-found` + `notFound()` atan bir sayfadan oluşan boş bir Next 16.4.2 uygulamasında da aynı kabuk geldi (iç içe `not-found.tsx` ve `generateMetadata`'lı biçimler de). Eşleşmeyen adresin `/_not-found` rotası ise tam çiziliyor; vitrinde her adresi `[...path]` yakaladığı için o rota hiç çalışmıyor.
   - Askıya alınmış (`Suspense`) bir parçada atmak çözüm değil: gövde gelir ama durum 200 olur (soft 404).
   - `htmlLimitedBots`, vekilin yeniden yazması ya da tema etkili değil (410 sayfası zaten tamdı).
   - **Düzeltme:** vekil, `resolve`'un `not_found` dediği adresi `/_bulunamadi` sayfasına **404 durumuyla yeniden yazar** (410'un `/_kaldirildi`'si gibi; `lib/seo/gone.ts` `notFoundResponse`). Sayfa normal çizilir: başlık, metin, arama formu ve kategori kutuları ilk HTML'de, `<html lang="tr">`, `noindex`. Adres tarayıcıda aynı kalır; 404 günlüğüne bildirim eskisi gibi.
   - Sayfa yalnız vekilin işaretiyle (`x-qt-not-found`) çizilir; kendi adresiyle istenince ya da ziyaretçi başlığı gönderince 404 kabuğu.
   - Ana sayfa ve vitrinin kendi listeleri eski platform sorgusuyla `not_found` alsa da kendileri çizilir (eskisi gibi). `resolve` yanıt veremezse sayfa kendisi sorar.
   - **Doğrulama:** `/bu-sayfa-yok`, `/urun/olmayan`, `/kategori/olmayan-kategori`, `/blog/olmayan-yazi` → 404, `h1` "Sayfa bulunamadı", `/arama` formu, kategori kutuları, `lang="tr"`, hata kabuğu yok. İstemci gezintisiyle eksik adrese gidiş tam sayfa yüklemesine düşüp aynı sayfayı gösteriyor. `/wp-login.php` → 410, tam (değişmedi).
   - **Kalan (Next sınırı):** sayfanın kendi bulduğu 404'ler `notFound()` ile kalıyor ve gövdeleri yine yalnız istemcide: son sayfadan sonrası (`/magaza?sayfa=999`, blog arşivleri, `/yorumlar`), bilinmeyen yasal metin, filtre sınırını aşan arama, başkasının siparişi, önizleme. Durum ve `noindex` doğru. Bunlar için vekilin önceden bilmesi gerekir (sayfa sayısı); ayrı görev, Next'in sonraki sürümlerinde yeniden denenmeli.
   - Hata sayfaları (500) da aynı kabukla gelir; JS'siz okuyucuya gidecek içerik yok, bilerek bırakıldı. Bakım sayfası (503) vekilin kendi HTML'i, tam.
   - Testler: `app/__tests__/not-found-page.spec.ts` (Grafit'in başlığı, arama formu ve kutuları dahil), `__tests__/proxy-fallbacks.spec.ts`, `lib/seo/__tests__/gone.spec.ts`.
2. **Mağaza adı başlıkta bir kez.** [backend]
   - **Neden:** vitrin şablon eklemiyor (`metadataOf` `title.absolute`, layout'ta `title.template` yok). İkinci ad backend'in başlığından geliyor: ürün şablonu `{ürün_adı} | {marka} | {mağaza}` ve markası mağaza adıyla aynı (ya da adı zaten "| My L'arte" ile biten) üründe ad iki kez çıkıyor. Yazar sayfasında `{başlık} | {mağaza}`, yazarın adı mağaza adı.
   - **Düzeltme:** `withoutRepeatedParts` (`lib/seo/template.ts`): başlık kurulduktan sonra, boşluklu ayraçlar arasındaki parçalardan öncekini tekrarlayan ayracıyla atılır (büyük/küçük harf ve boşluk farkı sayılmaz). Şablondan gelen ve elle yazılmış `seo_title` ikisine de uygulanır; OG ve Twitter başlığı aynı. docs/13 §3'e kural eklendi.
   - Örnek: `El Yapımı Balta Çakı | 21 cm … Kabza | My L'arte` (87 karakter; 60'ın üstü advisor'ın uzunluk uyarısında kalır). Yazar sayfası `My L'arte`.
   - Diğer sayfa türleri tarandı, hepsinde ad bir kez: ana sayfa, kategori, ürün, içerik, blog yazısı, `/blog`, `/kategoriler`, `/magaza`, `/markalar`, `/kampanyalar`, `/yorumlar`; `/arama` adı hiç taşımıyor.
   - Dev backend'i sahibin ana checkout'undan çalıştığı için canlı başlık backend yeniden başlayınca düzelir; doğrulama birim testleriyle (`template.unit.spec.ts`, `resolve.unit.spec.ts`) ve HTTP testleriyle (`seo-resolve`, `seo-payload`, `seo-contract`).
   - Ayrıca görüldü (düzeltilmedi): `/magaza?sayfa=2` başlığı " – Sayfa 2" almıyor (docs/13 §3 sayfalama kuralı; blog arşivleri alıyor).
3. **`FAQPage` basılmıyor.** [vitrin, karar] Ana oturum kararı: docs/13 §5. `lib/seo/faq.ts` silindi; ana sayfa, ürün, liste ve tasarım önizlemesi artık `FAQPage` basmıyor, SSS sayfada aynen görünüyor. adr/0049 Ek 2026-11-06. Advisor'da ilgili kural yoktu. Koruma: `lib/seo/__tests__/seo-policy.spec.ts` (kaynakta `"FAQPage"` yok), e2e duman testi.
4. **Zengin metin görsellerine ölçü.** [backend] İçerik belgesindeki görseller medya kütüphanesinden (`media_asset` `width`/`height`, blog kapaklarıyla aynı sorgu) ölçü alır ve `<img … width height>` basılır. `cardTargets` belgenin kartlarıyla birlikte görsellerin ölçülerini de getirir: içerik sayfası, blog yazısı, landing ve tema düzenleyicinin zengin metin bölümü. Ölçüsü bilinmeyen görsel eskisi gibi. `srcset` ayrı iş (Kalanlar 1). Testler: `content.unit.spec.ts`, HTTP `content.spec.ts`.
5. **Hız sınırı 503.** [vitrin]
   - Bir sayfa durumunu kendi seçemediği için (Next'te yalnız `notFound`/`forbidden`/`unauthorized` var) karar vekilde.
   - `storeRequest` bir **okumanın** 429'unu ziyaretçi başına `Retry-After` süresince tutar (`lib/store-api/busy.ts`; süreç kayıt defterinde, vekil ve sayfalar aynı haritayı görür; 1–300 sn, başlık yoksa 30).
   - Vekil o süre boyunca ziyaretçinin **katalog sayfalarına** (ana sayfa, listeler, kayıt sayfaları, `/arama`) `503`, aynı `Retry-After`, `no-store`, `noindex`'siz kısa metin döner. Vekilin kendi `resolve` çağrısı 429 aldıysa aynı istek de 503.
   - Dışında kalanlar: sepet, ödeme ve dönüşü, hesap, token bağlantıları, rota işleyicileri, POST'lar; formların kendi sınırları ve canlı arama (`/store/listings/suggest`) sayılmaz.
   - **Sınır:** sınıra ilk çarpan sayfa çizimi (vekil `resolve` sormadığında: listeler, `/arama`) hâlâ 500; sonraki istekler 503. Canlı ölçüm yapılmadı (sahibin dev backend'inin sınır sayaçlarını doldurmamak için); testler `busy.spec.ts`, `proxy-fallbacks.spec.ts`.

### Tekrar üretme

1. **Derle:** worktree'de `STOREFRONT_THEME=atolye pnpm exec next build`.
2. **Başlat:** `next start -p 8100`, ortam değişkenleriyle:
   - `STOREFRONT_PUBLISHABLE_KEY`: dev backend `GET /dev/storefront-key`.
   - `STOREFRONT_TRUSTED_PROXY_HOPS=0`.
   - Diğerleri ana checkout'un `apps/storefront/.env.local`'ı; okumadan symlink.
3. **Ölç:** Lighthouse Node API, `lighthouse(url, flags, config, page)`.
   - `page` puppeteer sayfası, `setBypassCSP(true)`.
   - Masaüstünde `core/config/desktop-config.js`.
   - Sepette önce ürün sayfasından ekleme ve `Network.clearBrowserCache`, `disableStorageReset: true`.
4. **Arşiv:** ham JSON raporları oturumun geçici klasöründeydi.

## Sepete ekle ve çerez onayı: INP incelemesi (2026-11-06)

> Yukarıdaki tabloda "Sepete ekle" 328–360 ms, çerez bildiriminde "Tümünü kabul et" 304–392 ms idi. İkisi de 200 ms bütçesinin üstündeydi. Bu bölüm nedenini ve yapılanı anlatır. **Sonuç:** sürenin neredeyse tamamı ölçüm tarayıcısının bir kusurundan geliyor. Gerçek pencereli Chrome'da ve eski headless kabukta iki etkileşim de 32–72 ms.

### Kurulum

- **Vitrin:** worktree'den `STOREFRONT_THEME=atolye next build`, `next start -p 8103`. Ortam ve anahtar yukarıdaki "Tekrar üretme" ile aynı.
- **Profil:** yukarıdaki INP ölçümünün betiğinin aynısı.
  - puppeteer-core, Moto G Power görünümü (412×823, DPR 1,75, dokunmatik), 4x CPU (sayfa yüklenirken de).
  - Dokunma (`tap`), Event Timing. Sıra: `/`'da menü ve "Tümünü kabul et"; ürün sayfasında adet artırma, sekme ve "Sepete ekle"; kategori sayfasında menü.
  - 3 koşu, medyan.
- **Üç tarayıcıda koşuldu:** üçü de aynı Chromium yapısı (Playwright `chromium-1248`):
  - Chrome for Testing 156, yeni headless. Yukarıdaki ölçüm bununla alınmıştı.
  - `chrome-headless-shell`, eski headless.
  - Aynı Chrome, gerçek pencereyle (`headless: false`).
- İzler: Chrome performans izi (`devtools.timeline`, `cc`, `viz`, `gpu`) ve V8 örnekleyicisi.

### Bulgu: süre ana iş parçacığında değil, ekran birleştiricisinde

İz, yeni headless'ta tıklamadan sonra şunu gösteriyor:

1. **Olay ve ilk kare:**
   - İşleyiciler bitiyor; "Ekleniyor…" etiketi ya da kapanan çerez kartı +18–43 ms'de ilk karede çiziliyor.
   - Kare Viz'e ulaşıyor (`Surface::ActivateFrame`). Ancak ekranın `Display::DrawAndSwap` adımı **"Draw skipped / Swap skipped"** diyor: hasar yok sayılıyor ve kare ekrana basılmıyor.
2. **Bekleme:**
   - Ana iş parçacığı +80 ms ile sunucu yanıtı arasında neredeyse boş: sunucu eylemi yolda.
   - Ekran bu sürede hiç kare basmıyor.
3. **Bitiş:**
   - Sunucu yanıtı gelince React ağacı yeniden çiziyor ve Next adresi `history.replaceState` ile yeniliyor.
   - Tarayıcının kendi birleştiricisi bu yüzden bir kare üretiyor. Ekran ancak o zaman basıyor (+280–610 ms).
   - Event Timing etkileşimin sunumunu bu kareye yazıyor. "Sunum gecikmesi ~290 ms" buradan geliyor.

Kanıtlar:

- **Görsel geri bildirim anında geliyor.** Ekran görüntülü izde (ekran görüntüsü her kareyi basmaya zorluyor) "Ekleniyor…" +59 ms'de görünüyor. INP aynı koşuda 88 ms.
- **Tarayıcıyı dürtmek süreyi kapatıyor.**
  - Deneme amaçlı bir sayfa betiği gönderimden hemen sonra `history.replaceState` çağırdı.
  - Tarayıcı birleştiricisi erken kare üretti; INP 56–72 ms'ye düştü. Ana iş parçacığının işi aynıydı.
- **Hiç görsel değişiklik getirmeyen olay da aynı kusura düşüyor.** Ölçüm betiğinin bastığı Escape tuşu, yeni headless'ta 780–890 ms "sunum" ölçtü.
- **Etkenler tek tek denendi, hiçbiri kusuru açıklamıyor.** Adet düğmesine aynı yükü eklemek kusuru üretmedi:
  - 12 ms'lik işleyici
  - `fetch` POST
  - önlenen form gönderimi
  - odaktaki düğmeyi devre dışı bırakmak
  - Navigation API'yi kapatmak (React 19.3'ün varsayılan geçiş göstergesi)
  - `TreesInViz` özelliğini kapatmak
- **Ana iş parçacığının gerçek işi küçük:**
  - Tıklama görevi 22–48 ms; işleyicilerin payı 11–15 ms. Bunun bir kısmı React'in form eylemini başlatması: `FormData`, sunucu eylemi kodlaması, yönlendirici.
  - Yanıttan sonraki yeniden çizim bir görevde 87–140 ms. Bunun 31–53 ms'si stil yeniden hesabı: `revalidatePath` ile bütün RSC ağacı yenileniyor.
  - Bu görev tıklamanın INP'sine girmiyor; o anda gelen bir sonraki dokunuşu bekletebilir. Aşağıda "Kalan".

### Önce / sonra (ms; medyan, kırılım girdi / işleyici / sunum)

| Tarayıcı | Etkileşim | Önce | Sonra |
|---|---|---|---|
| Yeni headless (eski profil) | Sepete ekle | 312 (24 / 11 / 278) | 296 (23 / 4 / 268) |
| | Tümünü kabul et | 272 (25 / 8 / 240) | 224 (23 / 3 / 198) |
| | Sepete ekle, sekmeden hemen sonra | 592 (koşular 592–640) | 360 (koşular 280–368) |
| Eski headless kabuk | Sepete ekle | 56 (26 / 15 / 15) | 40 (24 / 4 / 13) |
| | Tümünü kabul et | 48 (28 / 13 / 7) | 32 (22 / 2 / 9) |
| Gerçek pencere | Sepete ekle | 72 (22 / 9 / 41)* | 72 (24 / 5 / 43) |
| | Tümünü kabul et | 56 (21 / 8 / 27)* | 56 (21 / 1 / 34) |

\* Pencereli "önce" turunda bir koşuda sayfa yüklenmedi; değer 2 koşudan.

- **Pencereli Chrome'da sunum ~30–45 ms'nin altına inmiyor.** Gerçek ekranın kare temposu bu.
- **Yeni headless'ta iki etkileşim hâlâ 200 ms civarında ve üstünde.** Kalan süre yukarıdaki ekran kusuru. Sayfa kodu bunu kapatamaz; yalnız tarayıcıyı yapay biçimde dürtmek kapatır. O yapılmadı: gerçek kullanıcıya bir şey kazandırmaz, sadece ölçümü güzelleştirir.

**Diğer etkileşimler (eski headless kabuk, önce → sonra):**

| Etkileşim | Önce | Sonra |
|---|---|---|
| Mobil menü, `/` | 144 | 80 |
| Mobil menü, kategori | 136 | 80 |
| Adet artırma | 48 | 32 |
| Sekme değiştirme | 40 | 40 |

- Menünün kodu değişmedi. "Önce" turunda menünün işleyicileri 89–116 ms ölçtü; "sonra" turunda ve diğer turlarda 47–52 ms. Fark makinenin o andaki yükü, gerileme değil.
- Pencereli Chrome'da da aynı tablo: menü 88–136 → 104–168 ms, adet 48–56 → 64 ms, sekme 56 → 56 ms. İşleyiciler aynı; fark pencereli sunumun 8 ms'lik adımları ve gürültü içinde.

### Yapılanlar

1. **Form eylemi, basışın karesi çizildikten sonra başlıyor.** [ui]
   - Yeni `afterPaint` (`packages/ui/src/lib/after-paint.ts`) işi bir sonraki kareden sonraki ayrı bir görevde çalıştırır. Kare gelmeyen sayfada (gizli sekme) 100 ms sonra çalıştırır; asla iki kez çalıştırmaz.
   - `useKeptForm`:
     - Gönderimde düğme aynı karede "bekliyor" olur: `pending`, eylem başlamadan da doğru.
     - Eylem `afterPaint` ile başlar. React'in sunucu eylemini başlatma işi (`FormData`, kodlama, yönlendirici) artık basışın görevinde değil.
     - `pending` eylem başlayınca `useActionState`'inkine devredilir; arada boşluk yok.
     - Bekleme boyunca düğme zaten `disabled`: çift gönderim olmuyor.
   - `KeptForm` da eylemini aynı biçimde başlatır.
   - **Etkisi:** iki temanın bütün tutulan formları (`useKeptForm` ya da `KeptForm` kullanan 13 dosya) ve çerez bildirimi.
   - **Sonuç:** işleyiciler "Sepete ekle"de 8–17 → 3–6 ms, çerezde 7–20 → 1–5 ms (4x CPU, üç tarayıcıda).
2. **Çerez bildirimi formu `KeptForm`.** [tema]
   - `frame/Consent.tsx` sunucu bileşeni olarak kalıyor. Formu artık düz `form` yerine `KeptForm`.
   - Kart, basışın karesinde kapanıyor (`ConsentFrame`'in `onSubmit`'i, eskisi gibi). Cevap o kareden sonra gidiyor.
   - Formun `key`'i ve alan adları aynı.
3. **Korunanlar:**
   - **JS'siz gönderim:** iki formda da `action` yerinde. JS kapalıyken çerez cevabı ve "Sepete ekle" düz POST ile gidiyor; elle denendi.
   - **Reddedilen gönderim:** alanlar korunuyor.
   - **`add_to_cart`:** sepet görüntüsüyle (`watchCart`) bir kez gidiyor. Yol değişmedi: `revalidatePath` ve çerçevenin yenilenmesi aynı.
   - **Erişilebilirlik:** `aria-busy` ve `role="status"` aynı.
   - **CSP:** etkilenmedi; yeni betik yok.
   - **Görünüm:** design.md'ye dokunulmadı.
4. **Testler:**
   - `packages/ui`: `after-paint.spec.ts` (kare sonrası, tek sefer, karesiz sayfa) ve `use-kept-form.spec.tsx`. Yeni test: basışta `pending`, eylem karenin ardından ve bir kez.
   - Vitrin: `kept-forms-theme.spec.tsx` ve `checkout-code-theme.spec.tsx` gönderimi kare beklemesiyle yapıyor.
   - Sonuç: `packages/ui` 21/21, vitrin 874/874 yeşil.

### Kalan

- **Ölçüm profili değişmeli.** Etkileşim ölçümü (INP) yeni headless Chrome 156 ile alınmamalı: hasar algılamayan kare tıklamanın sunumunu bir sonraki tarayıcı karesine kaydırıyor.
  - Yerine `chrome-headless-shell` ya da pencereli Chrome kullanılmalı. Lighthouse (yükleme ölçümü) için yeni headless sorun değil.
  - Asıl söz saha verisinin (RUM, p75 mobil). F16'da `web-vitals` atıflı INP toplanınca bu iki etkileşim orada izlenmeli.
- **Sepete eklemeden sonraki yenileme tek görevde 87–140 ms (4x CPU).** [vitrin, ayrı görev]
  - `revalidatePath("/", "layout")` sayfanın bütün RSC ağacını yeniliyor. Başlıktaki sayaç ve analitiğin sepet görüntüsü bunun için var.
  - Tıklamanın INP'sine girmiyor. Ama yanıt geldiği anda yapılan ikinci bir dokunuşu (ör. "Sepete git") bekletebilir.
  - Daralmak için sayacın ve sepet görüntüsünün istemcide güncellenmesi gerekir. Bu analitik sözleşmesini (docs/20 D9, sepet görüntüsü sunucudan) değiştirir; ayrı karar.

### Tekrar üretme

1. Derle ve başlat: yukarıdaki "Tekrar üretme" 1–2, port 8103.
2. Ölç: puppeteer-core ile yukarıdaki profil.
   - `executablePath` olarak `chrome-headless-shell` (`~/Library/Caches/ms-playwright/chromium_headless_shell-1248/…`) ya da `headless: false`.
   - Sayfaya `PerformanceObserver({ type: "event", durationThreshold: 16 })`; `interactionId`'li girdiler.
3. Kusuru görmek için:
   - Aynı betiği yeni headless'ta koşun ve tıklamayı izleyin (`page.tracing.start`, `viz` kategorisi).
   - `Display::DrawAndSwap` altında "Draw skipped" ve sunucu yanıtına kadar basılmayan ekran görülür.
