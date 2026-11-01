# ADR-0046: Vitrin mimarisi ve tema sözleşmesi

- **Durum:** Otonom kabul (2026-11-01). Kullanıcı: "kodlamaya başla f18i bana bir şey sorma … beğenmezsem geri alırız." Gözden geçirilecek; yedek `pre-f18-2026-11-01` etiketi ve dalı.
- **Tarih:** 2026-11-01

## Bağlam

F18 (docs/03) vitrinden şunları istiyor:

- **SSR:** title, meta, canonical, robots ve JSON-LD ilk HTML'de.
- **SEO:** `seo` payload'ı olduğu gibi basılır; URL normalizasyonu 301 ile yapılır; 404'ler `POST /store/seo/not-found` ile bildirilir.
- **Performans:** Core Web Vitals bütçeleri.
- **Ajan dostu HTML.**
- **Planlanan yapı:** `apps/storefront` (Next.js), `packages/themes/<tema>`, ortak `packages/ui`.

Backend tarafında bugün olanlar (Store API envanteri, 2026-11-01):

- **SEO:** `seo` yalnızca `GET /store/seo/resolve` yanıtında var; ürün, kategori ve içerik uçları onu taşımıyor (adr/0015). Resolve yanıtı dört biçimden biri: `entity`, `redirect` (301/302/307, zincir tek adıma indirilmiş), `gone` ya da `not_found`. Listeleme sorgusu `listing` alanında geliyor.
- **URL desenleri:** mağaza ayarı (`/urun/{slug}` ya da `/{slug}`).
- **Sistem yolları:** `/sepet`, `/odeme`, `/hesap`, `/giris`, `/kayit`, `/cikis`, `/arama` vitrine ayrılmış (`lib/seo/paths.ts`).
- **İstemci IP'si:** hız sınırı, dolandırıcılık denetimi, ödeme ve onay kanıtı hep bağlantının IP'sini kullanıyor. docs/04 bunu açık bıraktı: "sunucudan proxy'leyen storefront için imzalı istemci-IP header'ı ADR'si gerekir."
- **Anahtar ve CSRF:** Medusa, Store'un CORS ön isteğinde de publishable key istiyor; tarayıcıdan doğrudan çağrı bu yüzden sorunlu (docs/04). CSRF yalnızca çerezli mutasyonda Origin'e bakıyor.

Next.js 16.4.2'de doğrulananlar (Context7, `/vercel/next.js/v16.2.9`; 16.4.2, 14 gün kuralına uyan son sürüm):

- `middleware.ts`'in adı artık `proxy.ts`: `export function proxy(request)` ve `config.matcher`.
- `generateMetadata` dinamik sayfada varsayılan olarak akıtılıyor; yalnızca "HTML-limited bot"larda `<head>`'de. `htmlLimitedBots: /.*/` akıtmayı herkes için kapatıyor.
- `params` ve `searchParams` Promise.
- JSON-LD, `<script type="application/ld+json">` içinde, `<` kaçışlı basılıyor.

## Karar

1. **Uygulama: `apps/storefront`, Next.js 16.4.2 App Router.**
   - Diğer bileşenler: React 19.3, TypeScript strict, Tailwind v4 (PostCSS).
   - Port 8000 (`STORE_CORS` varsayılanı); `output: "standalone"` (F16 imajı).
2. **Her sayfa istek anında sunucuda üretilir.**
   - Next'in veri önbelleği kullanılmaz: fiyat ve stok her istekte backend'den gelir. Önbellek backend'dedir (resolve 60 sn, site 300 sn).
   - Metadata akıtılmaz (`htmlLimitedBots: /.*/`).
   - Sayfanın ana verisi Suspense dışında beklenir; 404 ve yönlendirme durum kodları böylece doğru gider.
3. **Rota ağacı desen bilmez.**
   - Sistem sayfaları sabit rotalardır (`/sepet`, `/odeme`, `/hesap/*`, `/giris`, `/kayit`, `/arama`, `/siparis/[id]`).
   - Geri kalan her yol tek bir `[[...path]]` sayfasına düşer. Sayfa resolve'u çağırır ve varlık türüne (`product`, `product_category`, `brand`, `product_collection`, `landing`, `page`, `post`) göre temanın sayfasını basar.
4. **`src/proxy.ts`, her sayfa isteğinden önce:**
   - (a) URL normalizasyonu tek 301'le yapılır: büyük harf, çift `/`, sondaki `/` ve `index.html`. Sorgu korunur.
   - (b) Sistem yolu olmayan sayfa isteğinde resolve çağrılır. `redirect` backend'in kendi koduyla (301/302/307) döner; `gone` 410 ve kısa bir sayfa döner. `not_found` olursa yol `POST /store/seo/not-found`'a bildirilir; 404 sayfayı sayfa verir.
   - (c) İstek başına nonce'lu CSP üretilir.
   - Sayfa resolve'u ikinci kez çağırır (backend önbellekli). Proxy'den sayfaya SEO verisini başlıkla taşımak boyut ve kodlama yüzünden kırılgandı; ölçüm gerekirse süreç içi kısa önbellek eklenir.
5. **Backend'e yalnızca vitrin sunucusu gider (BFF).**
   - Tarayıcı Store API'yi doğrudan çağırmaz. CORS ön isteği sorunu yok, çerezler vitrinin alan adında kalır.
   - Mutasyonlar Server Action'larla yapılır; Next aynı köken denetimini yapar. Sunucu backend'e `Origin: STOREFRONT_ORIGIN` ile gider (backend'in CSRF denetimi).
   - **İmzalı istemci IP'si:** vitrin sunucusu her Store isteğine üç başlık ekler:
     - `x-qt-client-ip`: ziyaretçinin adresi.
     - `x-qt-client-time`: Unix saniyesi.
     - `x-qt-client-signature`: `<zaman>.<adres>` metninin `STOREFRONT_IP_SECRET` ile HMAC-SHA256'sı.
   - Backend imzayı `clientIp(req)` ile doğrular: geçerliyse ve en çok 60 sn eskiyse bu adres sayılır, değilse bağlantının adresi.
   - Bu yardımcı bütün IP okumalarının yerine geçti: hız sınırı, iş kanıtı, dolandırıcılık, ödeme oturumu, yasal onay, ileti izni, takip ve denetim kaydı.
   - Sır yalnızca iki sunucuda durur; tarayıcı göremez. Vitrinin ziyaretçi adresini nereden okuyacağı F16'nın vekil düzenine bağlıdır (`X-Forwarded-For`'un son girdisi; `STOREFRONT_TRUSTED_PROXY_HOPS`).
6. **Çerezler vitrinin alan adında, httpOnly.**
   - Sepet kimliği: yerelde `qt_cart`, başka her yerde `__Host-qt_cart`; SameSite=Lax, 30 gün.
   - Backend'in kurduğu çerezleri (`qt_vid`, müşteri oturumu `connect.sid`) vitrin sunucusu kendi alanına aktarır ve backend'e geri iletir (adr/0004). Hesap işleri D8'de.
7. **Tema sözleşmesi (`@qticaret/ui`).**
   - Tema yalnızca sunumdur: veri çekmez, SEO ve JSON-LD yazmaz, durum kodu belirlemez.
   - Sayfaları (`Layout`, `HomePage`, `ProductPage`, `ListingPage`, `ContentPage`, `NotFoundPage`, …) görünüm modelleriyle ve metin işleviyle (`t`) çağrılır.
   - Eylemler (sepete ekle vb.) temaya prop olarak verilen Server Action'lardır.
   - İlk tema `packages/themes/base`: sektörden bağımsız, mobil öncelikli. Temanın seçimi ve ayarları (renk, logo, yerleşim) D11'de `platform-settings`'ten JSON şemayla gelir.
8. **Store API sözleşmesi `@qticaret/types`'ta (`src/store/*`).**
   - `SeoPayload`, `Resolution`, `ListingView` ve vitrinin okuduğu ürün, fiyat ve sepet alanları burada.
   - Backend'deki tiplerin vitrin kopyasıdır: Medusa'nın derlemesi çalışma alanındaki TypeScript paketlerini derlemediği için backend bu pakete bağlanmaz. Sapma e2e ve sözleşme testleriyle yakalanır.
9. **Görseller:** backend'in hazır türevleri (`media_assets.derivatives`, adr/0016) `<img srcset>` ile basılır. Next'in görsel işleme kapalıdır (`images.unoptimized`). LCP görseli tembel yüklenmez ve `fetchpriority="high"` alır.
10. **Metinler:** i18n anahtarlarıyla, `src/i18n/tr.json`, sunucu tarafında `t()`; ek kütüphane yok. Mağaza verisi (ürün adı vb.) olduğu gibi basılır.
11. **Arama** (Meilisearch ve indeksleme subscriber'ı) kendi görevinde (D10), altyapı eki bu ADR'a yazılır.
12. **Ödeme deneme sayfası (adr/0028):** vitrin ödemesi uçtan uca çalışınca silinir (D7). O zamana kadar kalır, çünkü elle ödeme denemenin tek yolu o.
13. **Geliştirme kolaylığı:** `GET /dev/storefront-key` yalnızca geliştirmede demo publishable anahtarını verir (`/dev/checkout`'un yaptığı arama). Vitrin geliştirmede `STOREFRONT_PUBLISHABLE_KEY` boşsa oradan alır. Başka her ortamda anahtar zorunludur.

## Alternatifler

| Seçenek                           | Artı                                                              | Eksi                                                                        |
| --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Next.js App Router (seçilen)**  | docs/03'ün planı; SSR, metadata API'si, Server Action'lar; yaygın | Akıtılan metadata ve önbellek varsayılanları ayar ister                     |
| React Router 7 (framework modu)   | Panelle aynı ekosisteme yakın, sade veri modeli                   | docs/03'ten sapma; metadata ve tema düzeni elle                             |
| Astro                             | Az JavaScript, iyi CWV                                            | Sepet ve hesap gibi etkileşimli kısımlar adalarla; iki model                |
| Medusa'nın Next.js starter'ı      | Hazır sayfalar                                                    | Ödeme akışımız, SEO çözümlemesi ve tema sözleşmesi farklı; kopya bakımı     |
| Tarayıcıdan doğrudan Store API    | Sunucu yükü az, IP sorunu yok                                     | Ön istekte anahtar sorunu, CSRF ve çerez alan adı, SEO verisi yine sunucuda |
| Sabit rota ağacı (`/urun/[slug]`) | Basit                                                             | Mağazanın URL deseni ayardır; desen değişince vitrin kırılır                |

## Sonuçlar

- **Backend:** `lib/security/client-ip.ts` (imza ve doğrulama), `api/http/client-ip.ts` (`clientIp(req)`), env `STOREFRONT_IP_SECRET` (isteğe bağlı; yoksa eski davranış). HTTP testi `storefront-client-ip.spec.ts`: imzalı adres ayrı sayılıyor, sahte imza yok sayılıyor.
- **Geliştirme ortamı:** `pnpm env:init`, paylaşılan sırrı (`STOREFRONT_IP_SECRET`) hem backend'e hem vitrine yazar.
- **F16:** vitrin ve backend aynı iç ağda; sır kurulumda üretilir. Vitrinin önündeki vekil `X-Forwarded-For`'u ekler. Staging'de `X-Robots-Tag: noindex`.
- **docs/04'teki iki açık madde bu kararla kapanır:** imzalı istemci IP'si ve tarayıcıdan doğrudan Store çağrısında ön istek sorunu.
