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
   - Backend imzayı `clientIp(req)` ile doğrular: geçerliyse ve en çok 30 sn eskiyse (2026-11-02'ye kadar 60 sn) bu adres sayılır, değilse bağlantının adresi.
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

## Ek (2026-11-02): müşteri oturumu, paylaşılan önbellek, ödeme çerçevesi (otonom, gözden geçir)

- **Müşteri oturumu (D8):** backend'in müşteri JWT'si vitrinin kendi alan adında httpOnly çerezde (`__Host-qt_session`, 1 gün; JWT ömrü); vitrin sunucusu her Store çağrısına `Authorization: Bearer` ekler, süresi geçmiş jetonu göndermez. Tarayıcı backend'i görmez (§5 aynen). Doğrulanmamış hesabın jetonu ayrı çerezde 15 dakika (`qt_verify`): doğrulama kodu yalnızca isteyen kimlikle onaylanır (adr/0037). Çerezler tek yardımcıyla aynı niteliklerle yazılır ve silinir (`lib/security/cookies.ts`): `__Host-` çerezinin silinmesi Secure olmadan tarayıcıca yok sayılır.
- **Paylaşılan önbellek (§2'ye ek):** kişisel olmayan mağaza geneli yanıtlar (site SEO, kategori ağacı, vitrin ayarları, yasal kimlik, yol kaydı, yasal metinler) vitrin sürecinde 60 sn tutulur ve müşteri anahtarı olmadan istenir (`lib/store-api/shared.ts`). Neden: her sayfa çerçeveyi yeniden istediğinde hızlı gezinen ziyaretçi (ya da CGNAT arkasındaki çok müşteri) backend'in IP başına sınırına takılıyordu (e2e yakaladı). Panel değişikliği vitrine en geç 60 sn'de yansır. Fiyat, stok, sepet, müşteri verisi önbelleğe girmez.
- **Ödeme (D7):** PayTR formu `/odeme/kart`'ta çerçevelenir; adresi sepete bağlı httpOnly `__Host-qt_pay` çerezinde, yalnızca `PAYMENT_FRAME_ORIGINS` kökenleri. iyzico sayfasına yalnızca `PAYMENT_REDIRECT_ORIGINS` kökenlerine yönlendirilir (CSP `form-action` de). Dönüş `/odeme/sonuc` bir rota: sağlayıcının çerçevesinden çıkar (yalnızca orada `frame-ancestors 'self'`), siparişi `order-access` ile bekler, meta refresh'li `/odeme/durum`. 428 iş kanıtı tarayıcıda çözülür.
- **İstemci adresi (§5'e ek):** yalnızca `X-Forwarded-For` sağdan okunur (`X-Real-IP` yok); canlıda `STOREFRONT_TRUSTED_PROXY_HOPS` zorunlu.
- **İlk giriş kaynağı (F11.2):** proxy ilk sayfada utm kelimelerini, reklam tıklaması var/yok bilgisini ve başka sitenin kökenini (yalnız `https://site/`; sayfa yolu bir kişiyi adlandırabilir) oturum çerezine yazar (2500 karakteri aşacaksa hiç yazmaz); ziyaretin ilk sepeti `/store/carts/:id/source`'a gönderir. Kişiye ait bir şey tutulmaz.
- **Bağımsız güvenlik incelemesi (2026-11-02):** 1 yüksek (çıkışta `__Host-` çerezi silinmiyordu), 3 orta (`?sonra=` açık yönlendirme, GET ile sepet değiştiren hatırlatma bağlantısı, X-Real-IP), 2 düşük (ödeme çerezi sepete bağlı değildi, iyzico köken listesi yoktu); hepsi düzeltildi (`899a8ce`).
- **İkinci bağımsız güvenlik incelemesi (2026-11-02 gece):** yüksek yok; hepsi düzeltildi.
  - Orta: `/store/listings/products` her çağrıda 3000'e kadar ürünü önbelleksiz tarayıp fiyatlıyordu; imzalı çağrıların 3000/dk kovası bunu ucuzlatıyordu. Liste satırları liste, bölge, para birimi ve kanal başına 30 sn süreçte tutuluyor (anahtar başına tek yükleme, en çok 200), uca ayrı sınır `listing` (ziyaretçi adresi başına 120/dk, imzalı ya da değil).
  - Düşük: aynı anda iki KVKK talebi açılabiliyordu → açık talep denetimi iş akışında kilit altında (hesap ve panel). `/store/reviews` satış kanalına bakmıyor, yayında olmayan ürünlerin yorumlarını sayıyordu → yalnız yayındaki ve anahtarın kanalındaki ürünler. Giriş çerezi yönlendiren sayfanın yolunu tutuyor, boyutu sınırsızdı → yalnız köken, 2500 karakter sınırı. İmzalı adres başlıkları iki dakika boyunca yeniden kullanılabiliyordu → izin verilen saat farkı 30 sn.
  - **Karar (otonom, gözden geçir):** giriş çerezi kişisel veri ve tanımlayıcı taşımadığı (kampanya kelimeleri, kaynak site, oturum süresi) için çerez onayına bağlanmadı; avukat bulunursa sorulacak (adr/0039 §2).
  - **F16 şartı:** vitrin → backend hattı özel ağda ya da TLS'li olmalı: imzalı başlıklar ve müşteri jetonu bu hatta düz gider.
- **Üçüncü bağımsız güvenlik incelemesi (2026-11-02 gece; iletişim formu, bülten, önizleme, hediye kartıyla ödeme, kargo takibi):** yüksek bulgu yok; hepsi düzeltildi.
  - Orta:
    - İletişim formunun personel e-postası, günlük e-posta bütçesini (sipariş e-postaları dahil) tüketebiliyordu. Artık mağaza genelinde 10 dakikada bir gidiyor ve gönderenin adını taşımıyor.
    - Ödenecek tutarı olmayan sepet, `credit` başlatmasının korumalarını (hız, iş kanıtı, kara liste, hazırlık denetimi) atlayıp doğrudan tamamlanabiliyordu. Bunun için Medusa'nın açık `POST /store/payment-collections` ucu kullanılabiliyordu. Artık bu uç kapalı; tamamlama da yalnız `credit` başlatmasının sepete yazdığı `qt_credit_checkout` işaretiyle mümkün (testli).
    - Zil kaydı gönderenin adını süresiz tutuyordu. Artık yalnız konu tutuluyor.
  - Düşük:
    - Bülten bir adrese art arda onay e-postası yağdırabiliyordu. Artık bekleyen istek varsa 24 saat yeni e-posta gitmiyor.
    - Bülten, yanıt süresinden adresin abone olup olmadığını belli ediyordu. Artık gönderim istek yolunun dışında yapılıyor.
    - Girişli müşteri başkasının adresini yazınca izin o müşterinin hesabına bağlanıyordu. Artık yalnız hesabın kendi adresiyse bağlanıyor.
    - Gönderen metni personel e-postasında görünüyordu. Artık hiç gitmiyor.
    - Önizleme bağlantısı sonraki düzenlemeleri de gösteriyordu. Artık bağlantı içeriğin kaydedilme anına bağlı; yeniden kaydedince eski bağlantı açılmıyor.
  - Ek sağlamlaştırmalar:
    - Toplam okunamazsa "ödenecek tutar yok" sayılmıyor.
    - `credit` başlatması, önceki kapıda ödeme ücret satırını temizliyor.
    - Önizleme rotası boş gövde şemasıyla korunuyor.
