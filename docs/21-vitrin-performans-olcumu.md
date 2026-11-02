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
