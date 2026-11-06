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

## Ek (2026-11-03): yazım toleranslı arama (otonom, gözden geçir)

docs/20 "arama kalitesi": Meilisearch kararına (§11, D10) kadar ara çözüm. Yeni servis ve veritabanı eklentisi (pg_trgm) yok. Arama, liste motorunun zaten tuttuğu satırlar üzerinde bellekte yapılır.

- **Uç:** `GET /store/listings/products?type=search&q=…` (`id` gönderilmez). Liste motorunun filtreleri, sıralamaları (varsayılan "önerilen" = alaka; `yeni`, `fiyat-artan`, `fiyat-azalan`), sayfalaması ve facet sayıları aynen geçerli. Yanıta `search: { suggestions, related: { categories, brands }, took_ms }` eklenir. `q` 1–100 karakter, kontrol karakteri yok, en az bir kelime; aksi 400. Uca mevcut `listing` sınırı uygulanır (adres başına 120/dk).
- **Veri:** tüm katalog listesinin (`all`, `/magaza`) satırları; en çok `LISTING_SCAN_LIMIT` (3000, en yeniler), bölge, para birimi ve kanal başına 30 sn tutulur. Bu satırlar yalnız bu listede başlık, alt başlık, açıklamanın ilk 240 karakteri, etkin ve iç olmayan kategoriler, markanın kimliği ve **yalnız herkese açık** özellik değerleriyle okunur. Mağazanın kendine sakladığı özellik aramada bulunmaz.
- **İndeks:** satırlar her yüklendiğinde bir kez kurulur: kelime sözlüğü, kelimelerin trigramları, alan başına kelime kimlikleri. 3000 ürün ≈ 45–55 ms. Sorgu sonucu (kimlikler, öneriler, çipler) aynı yüklemeye bağlı, karşılaştırma biçimindeki sorguyla 30 sn tutulur (en çok 300 sorgu). Satırlar yenilenince indeks ve sonuçlar onlarla birlikte bırakılır. Bir arama 3000 üründe ≈ 2–20 ms.
- **Normalleştirme:** NFKC, Türkçe küçük harf (`İ`→`i`, `I`→`ı`), işaretler atılır (`ç ğ ı ö ş ü â` → `c g i o s u a`); "cakı" "çakı"yı, "bicak" "bıçak"ı bulur. Harf, rakam ve işaret dışındaki her şey ayraçtır. Bağlaç kelimeleri (`ve`, `ile`, `için`, `veya`, `ya`, `bir`) yalnız başka kelime varsa atılır. En çok 8 kelime okunur.
- **Eşleşme (sorgu kelimesi × katalog kelimesi):**
  - tam: 1;
  - önek (`bıç` → `bıçak`, en az 2 harf): 0,75;
  - kök (`bıçaklar` → `bıçak`; katalog kelimesi en az 4 harf ve sorgunun en az yarısı): 0,6;
  - bulanık: trigram Dice benzerliği × 0,5. pg_trgm gibi önce iki, sonra bir boşlukla doldurulur. Eşik 5+ harfte 0,4, 3–4 harfte 0,5; 3 harften kısa kelimede bulanık eşleşme yok.
  - Rakam içeren kelime (kod, ölçü) yalnız tam ya da önek eşleşir: `model124` `model123`ün yazım hatası değildir.
- **Puan:** her sorgu kelimesi için her alanın en iyi kelimesi × alan ağırlığı, alanlar toplanır. Ağırlıklar: başlık 3, marka 2, kategori 2, özellik 1, alt başlık ve açıklama 0,5. Bir–iki kelimelik sorguda her kelime, daha uzununda biri hariç hepsi bulunmalı. Eksik kelime puanı oranla düşürür. Sorgunun tamamı başlıkta geçiyorsa +2. Eşit puanlarda katalog sırası (en yeni önce) korunur.
- **Öneri ("bunu mu demek istediniz"):** sorgunun bir kelimesi katalogda tam, önek ya da kök olarak yoksa (yalnız yazım hatası olarak eşleşiyorsa) sorgu zayıf sayılır. O kelimenin yerine en benzer başlık kelimeleri konur (benzerlik, sonra kaç başlıkta geçtiği; kelime başına 3). Bilinen kelimeler katalogdaki yazılışıyla kalır. Tüm kelimelerini bir arada taşıyan ürün yoksa öneri gösterilmez. En çok 5 öneri.
- **İlgili çipler:** ilk 48 sonucun en sık 5 kategorisi (`{id, name}`) ve markası (`{id, name, handle}`).
- **Arama raporu (F11.8):** yalnız ilk ve daraltılmamış sayfa (filtre ve fiyat yok) yeni arama sayılır. `count` ile, ürün listesindeki aramayla aynı yoldan (`countSearchTerm`) sayılır: kişisel veri süzgeci, ziyaretçi başına günde bir kez, günde en çok 30 terim.
- **SEO:** `/arama` sistem yolu ve `noindex,follow` kalır; değişiklik yok.
- **Sınırlar:**
  - Katalog 3000 ürünü aşarsa yalnız en yeni 3000'i aranır.
  - Eş anlamlı kelime ve çok dilli arama yok.
  - Seçim özelliklerinde etiket değil değer (slug) aranır; işaretler atıldığı için sonuç aynı.
  - Her süreç kendi indeksini kurar.
  - Fiyat ya da ürün değişikliği 30 sn içinde yansır.
- **Tam çözüm:** Meilisearch (D10) kalır: büyük katalog, eş anlamlılar, vurgulama, indeksleme subscriber'ı. Geçişte uç ve `search` bloğu aynı kalır; yalnız satır kaynağı değişir.

- **Güvenlik incelemesi 2026-11-03 (L3):** sorgu kelimesi artık bütün sözlükle değil, yalnızca en az bir trigram paylaştığı ve eşleşebilecek uzunluktaki kelimelerle karşılaştırılır (trigram → kelime indeksi, kısa kelime önce; sonuçların aynı kaldığı birim testte bütün sözlükle karşılaştırılarak kanıtlı); açıklamanın ilk 400 karakteri etiketlerden arındırılıp 240 karaktere kesilir.

## Ek (2026-11-03): süreç içi resolve önbelleği (otonom, gözden geçir)

§4'ün "ölçüm gerekirse" dediği önbellek (docs/21 3. düzeltme): ürün ve kategori sayfasında resolve iki kez gidiyordu (proxy, sonra sayfa).

- `GET /store/seo/resolve` yanıtı vitrin sürecinde yol + sorgu anahtarıyla **10 sn** tutulur (`lib/store-api/resolutions.ts`); proxy ve sayfa paketleri aynı haritayı görür (`registry.ts`).
- Ziyaretçiden bağımsızlık denetlendi: backend rotası yalnız `path`'i okur; oturum, çerez ya da ziyaretçi adresi yanıtı değiştirmez ve rota `Cache-Control: public, max-age=60` döner.
- Yalnız `entity` ve `not_found` tutulur. `redirect` her sorguda kuralın vuruş sayısını artırdığı için tutulmaz; `gone` ve `redirect`'i zaten proxy yanıtlar.
- Yenileme sinyali (adr/0048 Ek) kapsamı ne olursa olsun hepsini siler. En çok 500 yol.

## Ek (2026-11-04): ikinci temanın istediği isteğe bağlı sözleşme alanları (otonom, gözden geçir)

Atölye teması (`packages/themes/atolye`, `design.md` § Components) temanın tek başına çizemeyeceği alanlar istedi (denetim 2026-11-04 §7). Hepsi **isteğe bağlı ve eklemelidir**: alanı vermeyen vitrin ya da eski backend aynı sayfayı çizer; taban tema hepsini çizer, iki tema tek sözleşmeyi paylaşır. Yeni görünüm tipleri `packages/ui/src/card-views.ts`'te.

| Alan (görünüm modeli) | Şekli | Kaynak (Store API) |
| --- | --- | --- |
| `NavCategoryView.image?`, `CategoryTreeView.image?`, `ListingPageView.subcategories[].image?`, `categories` bölümünün `categories[].image?` | `CategoryCardView extends LinkView { image?: ImageView \| null }` | `GET /store/category-images` → `{ images: { category_id, url, alt, width, height, derivatives }[] }` (yalnız etkin ve iç olmayan kategoriler; `max-age=300`; vitrinde 60 sn, `menus` yenile kapsamı). Ana menüde yalnız `kind: "category"` bağlantıları resim taşır. |
| `ProductCardView.stock?` | `"in_stock" \| "low" \| "out"` (adet asla) | `GET /store/card-facts?id=` (en çok 100) → `{ facts: { [product_id]: { stock, quick_add: { variant_id } \| null } } }`; yalnız yayındaki ve anahtarın kanalındaki ürünler; `no-store`. Sayfa başına bir ürün ve bir stok okuması (`getVariantAvailability`). "Az" eşiği `storefront.low_stock_threshold` (varsayılan 3, 0: hiç) |
| `ProductCardView.quickAdd?` | `{ variantId } \| null` | aynı uç: tek varyant, stokta, hediye kartı değil, mağaza ekleri açıkken zorunlu eki yok; vitrin ayrıca fiyatı olmayan ve satın alınamayan kartta kaldırır |
| `ListingPage`/`HomePage` `quickAdd?` prop | `FormAction` (`addToCart`'ın alanları, adet 1) | vitrinin `addToCart` Server Action'ı |
| `ReviewsView.distribution?` | `RatingBarView[]` (5→1: `{ stars, count, percent, label }`) | `GET /store/products/:id/reviews` → `rating.distribution: { "5": n, … "1": n }` |
| `ReviewView.photos?` | `ReviewPhotoView[]` (`{ image: ImageView }`) | aynı uç ve `GET /store/reviews` → `reviews[].photos: { id, url, width, height }[]` |
| `reviews` bölümünün `photos?` | `CustomerPhotoView[]` (`{ image, product: LinkView \| null, rating, author }`) | `GET /store/reviews/photos?limit=` (1–24) |
| `ThemeActions.writeReview` | alanlara `photos` (en çok 3 dosya) eklendi; form `multipart/form-data` | eylem fotoğrafları önce `POST /store/products/:id/reviews/photos`'a (baytlar gövde), sonra yorumu `photo_ids` ile gönderir (adr/0037 Ek 2026-11-04) |
| `ProductPageView.specGroups?` | `SpecGroupView[]` (`{ title: string \| null, rows: SpecView[] }`) | ürün `fields`'ına `attribute_values.definition.group` ve `.definition.template.groups` (adr/0013 Ek 2026-11-04) |
| `ShopView.etbisQr?` | `ImageView \| null` | `GET /store/legal-identity` → `identity.etbis_qr: { url, alt, width, height, derivatives } \| null`; panel: Ayarlar > Mağaza, `store.etbis_qr_url` |
| `ShopView.paymentMarks?`, `carrierMarks?` | `ShopMarkView[]` (`{ key, label }`) | `GET /store/storefront` → `marks: { payments, carriers }`; anahtarlar: `visa`, `mastercard`, `troy` (bir kart sağlayıcısı bağlıyken; PayTR ve iyzico üçünü de alır), `paytr`, `iyzico`, `bank_transfer` (açık ve IBAN'lı), `cash_on_delivery` (bayrak açık ve kapıda tahsil eden bir kargo seçeneği varken); `aras`, `yurtici` (hesabı kayıtlı). Adlar vitrinin `tr.json`'unda (`marks.*`). |

- **İşaretler (logolar):** depoda sağlayıcıların resmî işaretleri yok; taban tema metin rozeti çizer. Resmî işaret kullanımı sağlayıcının marka kurallarına bağlıdır (sahibin işi); tema yalnız `key`'e bakıp kendi işaretini koyabilir.
- **Geliver:** bir toplayıcıdır, etiketi aldığı kargo firması önceden belli değildir; işaret listesine girmez.
- **Vitrin:** `lib/store-api/extras.ts` (üç yeni çağrı, backend yanıt vermezse alan çıkar), `lib/views/card-extras.ts` (saf görünüm yardımcıları, testli). Kart, liste, arama, ana sayfa rafları ve benzer ürünler kart bilgisini sayfa başına tek çağrıyla alır.
- **Migration'lar:** `catalogExtension` `Migration20261104210343` (`category_image`), `productAttributes` `Migration20261104210344`, `product_reviews` `Migration20261104210345`.
- **Ortam kütüphanesi:** kategori resmi ve ETBİS karekodu "kullanımda" sayılır (`media.in_use`); ayrıntıda `category` ve `etbis_qr` türleri.

## Ek (2026-11-05): kampanyalı fiyat, yakın plan ürün ve mağaza puanı (otonom, gözden geçir)

Atölye ana sayfası için istenen iki alan ve kart/sepet fiyat farkının düzeltmesi (adr/0023 Ek 2026-11-05). Hepsi **isteğe bağlı ve eklemelidir**; yeni görünüm tipleri `packages/ui/src/home-views.ts`'te.

| Alan (görünüm modeli) | Şekli | Kaynak (Store API) |
| --- | --- | --- |
| `PriceView.current` (anlamı genişledi) | değişmedi: alışverişçinin ödeyeceği fiyat; herkese uygulanan otomatik kampanya dahil, üstü çizili fiyat indirim öncesi kuralından (10 gün) | `GET /store/price-display` → `current` (kampanya dahil), `before`, `rule_version: "tr-10d-1"`; vitrin `current`'ı Medusa'nın `calculated_amount`'ından önce okur (`lib/views/price.ts` `shownAmount`) |
| `PriceView.cartOffer?` | `string \| null`: "Sepette %10 indirim", "2.000,00 TL ve üzeri sepette %10 indirim", "Sepette 50,00 TL indirim" (sözle) | aynı uç → `cart_offer: { type: "percentage" \| "fixed", value: number \| "50.00", minimum: "2000.00" \| null } \| null`; yalnız koşulu sepet tutarı olan otomatik kampanya. Ürün sayfasının varyant fiyatlarında dolu; kartta yok. Taban tema satın alma panelinde fiyatın altında çizer (Atölye ürün sayfası taban temanın) |
| `HomeSectionView` `featured_product` | `FeaturedProductSectionView`: `{ id, type, title: string \| null, text: string \| null, product: ProductCardView, subtitle, images: ImageView[], facts: SpecView[], specGroups: SpecGroupView[] }`; `facts` mağazanın öne çıkardığı özellikler (`SpecView.highlight`), `specGroups` ürün sayfasının şekli | düzen belgesi `home[]` → `{ type: "featured_product", title, text, product_id }` (adr/0049; yalnız ana sayfa; kayıtta ürün var mı denetlenir, yayında olmayan ürünün bölümü vitrine gitmez); vitrin ürünü `products/:id` (sayfanın alanlarıyla), fiyatı `price-display`, kartı `card-facts` ile kurar; ürünün sayfası yoksa ya da uç yanıt vermezse bölüm çıkar. Panel: Tema düzenleyici > Bölüm ekle > "Öne çıkan ürün" (ürün seçici, başlık, satır) |
| `reviews` bölümünün `summary?` | `ShopRatingView` = `CardRatingView & { distribution: RatingBarView[] }`: `{ average: "4,6", count, label: "5 üzerinden 4,6 (128 değerlendirme)", distribution }` | `GET /store/reviews/summary` → `{ rating: { average: 4.6, count, distribution: { "5": n … "1": n } } \| null }`; yalnız alışverişçinin görebildiği (yayında, anahtarın kanalında) ürünlerin onaylı yorumları; `max-age=60` |
| `ReviewsPageView.summary?` | `ShopRatingView \| null` | aynı uç; `/yorumlar` artık ortalamayı sayfadaki 20 yorumdan değil mağazanın tümünden alır (`average`, `count` da oradan) |

- **Atölye:** kart `price.before` varken üstü çizili fiyatı zaten çiziyordu; kampanyalı fiyat oraya kendiliğinden geldi. `featured_product` Atölye'nin kendi yakın planı çizilene kadar taban temanın bileşeniyle (`@qticaret/theme-base` `FeaturedProductSection`, Atölye token'larıyla) çizilir; yorumlar bölümünün `summary`'si Atölye'de henüz çizilmez (temanın sıradaki adımı). Faz 2c'den beri ikisini de Atölye kendisi çizer (`home/CloseUp.tsx`, `home/RatingSummary.tsx`); `PriceView.cartOffer` kart görünümlerinde yok, Atölye kartları ona dokunmaz.
- **Taban tema:** yakın plan bölümü (görsel, ad, fiyat, öne çıkan özellik çipleri, satır, "Ürünü incele", bölümlü özellik tabloları), yorumlar bölümünde ve `/yorumlar`'da büyük ortalama + yıldız + sayı + 5→1 çubuklar (`RatingSummary`).
- **Vitrin:** `lib/views/featured.ts`, `lib/store-api/extras.ts` `reviewSummary`, `lib/views/card-extras.ts` `shopRatingView`, `lib/views/price.ts` `shownAmount`/`cartOfferText`; sözler `tr.json` (`price.cart_offer_*`, `home.featured*`, `reviews.count`).

## Ek (2026-11-05, liste ve ürün sayfaları): aramanın fotoğraflı kategorileri (otonom, gözden geçir)

Atölye'nin liste, arama ve ürün sayfaları (`design.md` § Liste sayfası, § Arama sonuçları, § Ürün sayfası). Sahip kuralı: kategoriler her yerde fotoğraflı karo, çip yok. Alanlar **isteğe bağlı ve eklemelidir**; taban tema bugünkü gibi çizer.

| Alan (görünüm modeli) | Şekli | Kaynak |
| --- | --- | --- |
| `SearchHelpView.categories` | `LinkView[]` → `CategoryCardView[]` (resim isteğe bağlı; `LinkView` olarak okuyan tema değişmeden çalışır) | aramanın ilgili kategorileri, `categoryTiles(ids)` ile: mağazanın kategori resmi, yoksa kategorinin (alt ağacıyla) en yeni ürün fotoğrafı; aynı sıra, aynı yollar (`withTiles`, `lib/views/search.ts`) |
| `SearchHelpView.popular?` | `CategoryCardView[]` | arama hiçbir şey bulmadıysa ya da hiç arama yoksa mağazanın üst kategorileri (`categoryTiles([])`); taban tema çizmez |
| `ListingPageView.subcategories[].image` (anlam genişledi) | değişmedi | kategori sayfasında alt kategoriler ve `/magaza`'da üst kategoriler artık `categoryTiles` ile: kendi resmi yoksa en yeni ürün fotoğrafı (ana sayfanın reyon kartlarıyla aynı kaynak, istekler altışar, bir dakika herkes için saklanır) |

- **Taban tema:** `SearchHelp` gösterecek öneri, kategori ya da marka yoksa hiçbir şey çizmez (boş bölge kalmaz); `popular`'ı çizmez.
- **Atölye:** sözleşmenin `ProductPageView`'unda ölçek görseli, ayrı bakım notu ve yasal uyarı alanı yok; tema bunları uydurmaz, açıklama belgesinde ne varsa o görünür.

## Ek (2026-11-05): satın alma sayfalarının istediği isteğe bağlı alanlar (otonom, gözden geçir)

Atölye sepet çekmecesini, sepeti, ödemeyi, siparişi ve sipariş takibini kendisi çizdi (`design.md` § Satın alma sayfaları). Temanın tek başına çizemeyeceği alanlar eklendi. Hepsi **isteğe bağlı ve eklemelidir**: alanı vermeyen vitrin ya da taban tema aynı sayfayı çizer.

| Alan | Şekli | Kaynak |
| --- | --- | --- |
| `Layout` `changeCartLine?` | `(form: FormData) => Promise<void>` (`ThemeActions.changeCartLine`'ın aynısı) | çekmecedeki adet ve silme; yoksa satırlar yalnız okunur |
| `CartPageView.shipping?` | `string \| null` ("Ücretsiz", "85,00 TL", "85,00 TL'den başlayan") | `GET /store/shipping-options?cart_id=` (adres olmadan da yanıt verir); en ucuz fiyatlı seçenek, vitrin sunucusunda seçilir |
| `CartPageView.offers?` | `string[]` | sepet satırlarının `price-display` `cart_offer`'ı, `cartOfferText` ile sözle, tekrarsız (sepet artık `items.variant_id` ister) |
| `CartPageView.trust?` | `TrustBadgeView[]` | `storefront.trust_badges` |
| `CartPageView.upsell?` | `{ title, products: ProductCardView[] } \| null` | ana sayfa düzeninin `best_sellers` rafının `product_ids`'i, yoksa en yeni ürünler; sepetteki ürünler çıkar, en çok 4; kartlar `railCards` (fiyat, stok kovası, hızlı ekle); ödeme bağlantısının sepetinde yok |
| `OrderPageView.progress?` | `OrderStepView[] \| null` (`placed`, `paid`, `packed`, `shipped`, `delivered`; `done`/`current`/`ahead`, tarih) | siparişin `payment_status`, `fulfillment_status` ve `orders/:id/shipments` (`shipped_at`, `delivered_at`); kapıda ödemede `paid` yok; iptal edilen siparişte null (`lib/views/order-progress.ts`, saf) |
| `OrderPageView.payment?` | `string \| null` | ödeme oturumlarının sağlayıcısı → "Kredi / banka kartı", "Havale / EFT", "Kapıda ödeme" |
| `OrderPageView.guest?` | `boolean` | müşteri oturum çerezi yok: sayfa hesap teklif eder |
| `AuthPageView.carriers?` | `LinkView[]` | `/siparis`: `storefront.marks.carriers` (bağlı kargo hesapları) → taşıyıcının kendi herkese açık takip sayfası (`lib/views/carrier-pages.ts`; Aras, Yurtiçi; bilinmeyen anahtar çıkar) |

- **Taban temadan ödünç (geçici):** `@qticaret/theme-base` artık `AddonEditor`, `GiftRecipient`, `OrderReturns`, `OrderGift`'i de dışa verir; Atölye sepette ek seçimi ve hediye alıcısı formunu, siparişte iade talebini kendi çizene kadar bunlarla gösterir. `AuthPage`'in giriş, kayıt, doğrulama ve şifre kipleri taban temanındır; Atölye yalnız `lookup`'ı çizer.
- **Kapsam dışı (backend gerekir):** misafirin kurumsal faturası (vergi no; e-fatura bugün yalnız üyenin fatura profilini okur), mağaza içinde kargo takip numarasıyla sorgu.

## Ek (2026-11-05, hesap): giriş ve hesap sayfalarının istediği isteğe bağlı alanlar (otonom, gözden geçir)

Atölye giriş, kayıt, şifre sıfırlama, doğrulama ve hesap sayfalarını kendisi çizdi (`design.md` § Hesap). Alanlar **isteğe bağlı ve eklemelidir**: alanı vermeyen vitrin ya da taban tema aynı sayfayı çizer.

| Alan | Şekli | Kaynak |
| --- | --- | --- |
| `AuthPageView.privacyPath?` | `string \| null` | `/hesap/kayit`: KVKK aydınlatma metni yayımlanmışsa (`legal/privacy_notice`) `/yasal/kvkk-aydinlatma-metni`; kayıt formunun altında bağlantı |
| `AccountPageView.nav[].section?` | `AccountSection` | vitrinin bölüm listesi; tema her bölüme simge verir |
| `AccountOrderView.images?` | `ImageView[]` (en çok 3) | `GET /store/orders` aynı çağrıda `items.title`, `items.thumbnail` |
| `AccountOrderView.progress?` | `OrderStepView[] \| null` | aynı çağrıda `+fulfillment_status` ve `*payment_collections.payment_sessions`; sipariş sayfasının `orderProgress`'i koli tarihleri olmadan (kapıda ödemede ödeme adımı yok, iptalde `null`); alan gelmezse yok |
| `AccountPageView.favorites[].card?` | `ProductCardView \| null` | favorilerin ürünleri `products?id[]=` ve rafların `railCards`'ı (fiyat, stok kovası); satışta olmayan ya da katalog yanıt vermezse `null` |
| `AccountPageView.categories?` | `CategoryCardView[]` | ana sayfanın `categoryTiles([])`'i; yalnız boş listede (sipariş ya da favori yok), katalog yanıt vermezse boş |

- **Atölye:** `AuthPage`'in bütün kipleri (sipariş takibi dahil) ve `AccountPage` artık temanın; satın alma ekinin "giriş kipleri taban temanın" notu kapandı. `checkout/AddressForm` `withEmail` aldı (hesabın adres defteri e-postasız), `order/Progress` "sırada ne var" sözlerini (`NEXT`) dışa verir.
- **Kapsam dışı (sözleşmede yok, çizilmez):** sosyal giriş (backend'de `auth-apple` var, `AuthActions`'ta yok), adres düzenleme (yalnız ekleme ve silme), hesapta ayrı iade talepleri listesi (talepler siparişin sayfasında), mağaza kredisi ve kayıtlı hediye kartları.

## Ek (2026-11-05, içerik sayfaları): mağazanın sayfaları, blog, yorumlar ve 404 için isteğe bağlı alanlar (otonom, gözden geçir)

Atölye mağazanın içerik sayfalarını, blogu ve yazıyı, `/yorumlar`'ı ve 404'ü kendisi çizdi (`design.md` § İçerik sayfaları). Alanlar **isteğe bağlı ve eklemelidir**: taban tema bugünkü gibi çizer; `html` her zaman metnin tamamıdır. Görünüm tipleri `packages/ui/src/content-views.ts`'te.

| Alan | Şekli | Kaynak |
| --- | --- | --- |
| `ContentPageView.image?` | `ImageView \| null` | içeriğin kapağı (`image_url`, medya kaydının boyu ve türevleri; `coverOf`, `lib/views/posts.ts`). Liste kartları da artık boy ve `srcset` taşır (`StoreContentSummary.image_width/height/derivatives`, backend zaten veriyordu) |
| `ContentPageView.outline?` | `OutlineItemView[]` | metnin `h2`'leri, `html`'de kimlikleriyle (`withOutline`, yasal metnin yardımcısı); soru-cevap sayfasında yok |
| `ContentPageView.post?` | `PostMetaView` (`date`, `dateTime`, `reading`, `author`) | yazının `published_at`, `reading_minutes`, `author_name`'i (`postMeta`) |
| `ContentPageView.related?` | `PostCardView[]` | aynı kategorinin en yeni yazıları, sonra blogun en yenileri; en çok 3, yazının kendisi hiç (`relatedPosts`) |
| `ContentPageView.products?` | `ProductCardView[]` | metnin ürün kısa kodları (`data-product-id`, adr/0019), sırayla en çok 8; `productsInOrder` + `railCards` |
| `ContentPageView.share?` | `SocialLinkView[]` | WhatsApp, X, Facebook, e-posta paylaşım adresleri; yalnız sayfanın kanonik adresi ve başlığı gider; kanonik adres yoksa boş |
| `ContentPageView.faq?` | `FaqView` (`intro`, `groups[]`: `id`, `title`, `lead`, `items[]` `{ question, html }`) | sayfanın HTML'i soru-cevap biçimindeyse (`lib/views/faq.ts`, saf): tamamı kalın ve "?" ile biten satırlar en az üçse sorular onlar, başlıklar grup; yoksa "?" ile biten başlıklar soru; daha azı sıradan sayfa. Yanıtlar backend'in HTML'i olduğu gibi |
| `ContentPageView.help?` | `ContactView` | soru-cevap sayfasında iletişim yolları (`contactOf`) |
| `ContentPageView.identity?` | `IdentityRowView[]` | iletişim sayfasında künye: unvan, adres, MERSİS, vergi dairesi/no, KEP, ETBİS; yalnız girilmiş olanlar (`identityRows`) |
| `ContentPageView.payments?` | `PaymentFactsView` (`marks`, `installments: InstallmentRatesView[]`, `maxInstallments`) | ödeme sayfasında `storefront.marks.payments` ve `GET /store/payment/installments` (en yeni ürünün ilk varyantı için; yalnız oranlar gösterilir, tutarlar değil: PayTR'de oran tutara bağlı değil); aile adı kartın yazdığı gibi (`familyName`) |
| `ContentPageView.shipping?` | `ShippingFactsView` (`carriers`, `promises`) | kargo sayfasında `storefront.marks.carriers` ve `storefront.trust_badges` |
| `ReviewsPageView.reviews[].product.image?` | `ImageView \| null` (`ReviewedProductView`) | sayfanın ürünleri tek çağrıda `products?id[]=`, ilk fotoğrafları |
| `NotFoundPage` `view?` | `NotFoundPageView` (`categories: CategoryCardView[]`) | `categoryTiles([])` (ana sayfanın reyon kartları); yanıt yoksa boş, 404 hiç düşmez |

- **Ödeme ve kargo sayfası hangisi:** bugün vitrin adrese bakar (`/odeme-secenekleri`, `/kargo-ve-teslimat`; `screens/content-data.ts` `INFO_PAGES`). İletişim sayfasının seçimi gibi (`storefront.contact_form_path`, adr/0047) bir ayar gelince o okunur; o zamana kadar başka adı olan sayfa bilgileri almaz, yalnız metnini gösterir.
- **Tablolar:** tema metnin tablolarını kendi kaydırma kutusuna alır (`withTableBoxes`, adlı tek sekme durağı, docs/19 §6.9); backend'in HTML'inde başka hiçbir şey değişmez.
- **Kapsam dışı (backend gerekir):** `/yorumlar`'da yıldıza göre süzme (`GET /store/reviews` `rating` süzgeci almıyor; eklenince vitrin `?puan=` ile geçirir), temalı 410 sayfası (vekilin kısa sayfası), yazılara yorum.

## Ek (2026-11-05, cila): yorum süzgeci, temalı 410 ve hata sayfası, ödeme ve kargo sayfalarının ayarı (otonom, gözden geçir)

Önceki ekin "kapsam dışı" bıraktıkları ve sabit adresleri. Alanlar yine **isteğe bağlı**; taban tema bugünkü gibi çizer.

| Sözleşme | Şekli | Not |
| --- | --- | --- |
| `ReviewsPageView.filter?` | `ReviewFilterView` (`options[]`: `stars`, `count`, `path \| null`, `label`, `active`; `active`, `activeLabel`, `clearPath`) | `/yorumlar?puan=5`; sayılar mağaza genelinin dağılımından (`lib/views/review-filter.ts`); backend `GET /store/reviews?rating=` (adr/0037 Ek 2026-11-05). Süzülmüş sayfa `noindex,follow`, canonical `/yorumlar` |
| `StorefrontTheme.GonePage?` | `NotFoundPage` ile aynı (`t`, `view?: NotFoundPageView`) | yoksa vitrin `NotFoundPage`'i çizer |
| `ThemeErrorPage` | `ComponentType<{ t; retry }>` | istemci bileşeni, temanın ayrı `/error` girişi (`@qticaret/theme-*/error`); vitrin onu `@qticaret/storefront-theme-error` takma adıyla yükler (`src/themes/<tema>-error.ts`, `next.config.ts`, `vitest.config.ts`) |

- **410:** vekil `gone` yanıtında artık kendi HTML'ini yazmaz; isteği `NextResponse.rewrite(…, { status: 410 })` ile `/_kaldirildi` sayfasına yeniden yazar (Next 16.4.2'de durum kodu yeniden yazmada korunuyor: geliştirme ve üretim derlemesinde denendi). Adres tarayıcıda aynı kalır; istek başlıkları (nonce, CSP, `x-qt-url`) ve yalnız vekilin koyduğu `x-qt-gone` sayfaya gider, ziyaretçinin gönderdiği `x-qt-gone` silinir. Alt çizgi hiçbir slug'da olmadığından (docs/13 §2.1) `/_kaldirildi` bir kaydın yolu olamaz; doğrudan istenirse 404. Sayfa kök düzenin içinde, yani mağazanın çerçevesiyle çizilir; `robots: noindex` ve başlık önceki kısa sayfadakiyle aynı.
- **Hata sayfası:** `error.tsx` (çerçeve ayaktayken) ve yeni `global-error.tsx` (kök düzen kurulamazsa, ör. backend kapalı: çerçevesiz, `<html>`/`<body>` ve temanın stil dosyası kendisinde) temanın `ErrorPage`'ini çizer; veri almaz, kategori karosu ve arama yok. "Tekrar dene" Next'in `unstable_retry`'ını (sunucuya yeniden sorar), yoksa `reset`'i çağırır. Durum kodu 500 (Next'in).
- **Ödeme ve kargo sayfaları:** `storefront` ayar bölümünde `payment_info_path`, `shipping_info_path` (`contact_form_path`'in kuralı: mağaza yolu, ana sayfa değil, küçük harfe çevrilir; `null` = hiçbiri; varsayılan `/odeme-secenekleri`, `/kargo-ve-teslimat`), `GET /store/storefront` verir, vitrin `infoPageOf(yol, ayar)` ile karar verir (alanı vermeyen eski backend: eski sabit adresler). Panel: Vitrin > Tercihler > "Ödeme ve kargo sayfaları" sekmesi (boş alan = hiçbiri).
- **Testler:** vitrin `lib/seo/__tests__/gone.spec.ts`, `app/__tests__/gone-page.spec.ts`, `lib/__tests__/error-page-theme.spec.ts`, `atolye-reviews-theme.spec.ts`, `themes/__tests__/choice.spec.ts`, `lib/views/__tests__/content-extras.spec.ts`; backend `storefront-section.unit.spec.ts`, HTTP `storefront-frame.spec.ts`; panel `preferences-info-pages.spec.tsx`.

## Ek (2026-11-05, ödeme çerçevesi): ödeme sayfalarının sade çerçevesi (otonom, gözden geçir)

UX denetimi 2026-11-05 (`docs/tema/ux-denetim-2026-11-05-sayfalar.md` § 4): ödeme, kart ve sonuç sayfaları mağazanın tam başlığıyla (arama, reyon satırı, duyuru) çiziliyordu. Tema hangi sayfada olduğunu bilmediğinden çerçeve görünümüne bir alan eklendi; **isteğe bağlı ve eklemelidir**, alanı okumayan taban tema bugünkü çerçeveyi çizer.

| Alan | Şekli | Kaynak |
| --- | --- | --- |
| `ShopView.checkout?` | `boolean` | vekilin `x-qt-url`'i `/odeme` ya da `/odeme/…` (`lib/views/bottom-nav.ts` `isCheckoutPage`); sepet (`/sepet`) ve ödeme bağlantısının sayfası (`/ode/…`) hayır |

- Atölye bu sayfalarda sade başlık ve yalnız küçük yazılı alt bilgi çizer (`design.md` § Satın alma sayfaları, "Ödeme çerçevesi"); alt gezinme zaten yoktu (`bottomNav: null`).

## Ek (2026-11-06, ürün sayfası): "Kargo ve Teslimat" kartının teslim süresi ve aynı gün kargo saati (otonom, gözden geçir)

Kart teslim sözünü mağazanın rozet satırlarından (kamyon ve saat simgeli `trust_badges`) kuruyordu; `GET /store/storefront` teslim süresini ve aynı gün kargo saatini ayrı alan olarak vermiyordu. Hepsi artık Ayarlar > Kargo ve teslimat > Seçenekler ve ücretler > "Teslim süresi" kartında (mağaza sahibi saati Pazarlama'da değil Kargo'da arar):

- **Kargoya verme ve taşıma günleri:** `shipping.handling_days_min/max`, `shipping.transit_days_min/max` (zaten vardı; ürünlerin `shippingDetails`'i ve `kargo_cümlesi` aynılarını söyler).
- **Aynı gün kargo saati:** yeni `shipping.same_day_cutoff_hour` (1–23 ya da `null`, varsayılan `null`). Ayar bölümü JSON olduğundan şema migration'ı yok. Eskiden `marketing.feed_same_day_cutoff_hour` (Pazarlama > Ürün akışları > "Feed kuralları") idi; o alan okunabilir kalır ve veri taşınmaz: okuyanlar (`lib/shipping/same-day.ts` `sameDayCutoffHour`: vitrinin `delivery`'si, Akakçe'nin `expressDeliveryTime`'ı) önce Kargo'nunkini, o `null` ise eski alanı okur. Panel saati yalnız "Teslim süresi"nde sorar, eski alan doluysa onu gösterir; mağaza kartı kaydedince saat Kargo'ya yazılır ve eski alan `null`'a çekilir (yoksa "Aynı gün kargo yok" seçimi eski saati geri getirirdi). "Feed kuralları" saati artık sormaz; açıklaması saatin Kargo > Teslim süresi'nden alındığını söyler.

| Alan | Şekli | Kaynak |
| --- | --- | --- |
| `StorefrontAnswer.delivery?` (`@qticaret/types`) | `StoreDelivery` (`handling_days: { min, max }`, `transit_days: { min, max }`, `same_day_cutoff_hour: number \| null`) | `GET /store/storefront` `delivery` (`workflows/storefront/delivery.ts`, saf); alanı vermeyen eski backend: kart rozet satırlarını söyler |

- **Vitrin:** `productShipping` `delivery` alır (`lib/views/product-shipping.ts`, `deliveryFacts`): kamyonla "1–2 iş gününde kargoda" (0–0: "Aynı gün kargoda"), altında "Tahmini teslimat 2–5 iş günü" (kargoya verme + taşıma); saat ayarlıysa saatle "Saat 15:00'e kadar verilen siparişler aynı gün kargoda" (yönelme eki saatin okunuşuna göre: 'a, 'e, 'ye, 'ya). Sıra: ücretsiz kargo, teslim, aynı gün, iade. Ayar gelince mağazanın kamyon ve saat simgeli satırları kartta söylenmez (ücretsiz kargo eşiğini adıyla anan satırı yine ücretsiz kargo olgusudur). Geri sayım, hafta sonu ve tatil kuralı yok: mağazanın kargo sayfası söyler.
- **Atölye:** kart varken satın alma sütunu kamyon, saat ve iade simgeli rozetleri hiç göstermez (önceden yalnız kartta aynen geçenleri çıkarıyordu); kartsız ürün bugünkü gibi.
- **Testler:** backend `workflows/storefront/__tests__/delivery.unit.spec.ts` (eski alana düşüş dahil), `shipping-section.unit.spec.ts`, HTTP `storefront-frame.spec.ts` (eski saat, Kargo'nunkinin önceliği, 24'ün reddi) ve `marketing-feeds.spec.ts` (eski alandan `expressDeliveryTime`); vitrin `lib/views/__tests__/product-shipping.spec.ts`, `lib/__tests__/atolye-product-theme.spec.ts`; panel `delivery-card.spec.tsx`, `feed-rules-card.spec.tsx`.

## Ek (2026-11-06, blog yazarları): yazar sayfası, yazının yazar satırı ve yazar kutusu (otonom, gözden geçir)

Blog yazısının yazarı artık serbest metin değil, mağazanın yönettiği bir kayıt (adr/0060): adı, sayfası (`/blog/yazar/{handle}`), unvanı, kısa biyografisi, fotoğrafı ve kendi profilleri (web sitesi, LinkedIn, Instagram, X). Alanlar **isteğe bağlı ve eklemelidir**: okumayan tema bugünkü gibi çizer (`post.author` adı taşımaya devam eder). Store tipleri `packages/types/src/store/storefront.ts`'te, görünüm tipleri `packages/ui/src/content-views.ts`'te.

| Alan | Şekli | Kaynak |
| --- | --- | --- |
| `StoreContentSummary.author?` (`@qticaret/types`) | `StoreContentAuthor` (`id`, `name`, `handle`, `path`, `job_title`) \| `null` | `GET /store/content` listesi; `author_name` kalır: bağlı yazarın adı, yoksa eski serbest metin |
| `GET /store/content/:id` `entry.author` | `StoreContentAuthorDetail` (yukarıdakiler + `bio` düz metin, `image_url`/`image_width`/`image_height`/`image_derivatives`, `links: { kind: "website" \| "linkedin" \| "instagram" \| "x"; url }[]`) \| `null` | yazının seçili yazarı |
| `GET /store/content/authors/:id` | `{ author: StoreContentAuthorPage }` (detay + `post_count`) | yazar sayfası; `storePublicGet` (terimler gibi paylaşılan önbellek) |
| `GET /store/content?kind=post&author={handle}` | liste | yazarın canlı yazıları, en yeni önce |
| `EntityType` `"post_author"` | resolve | `/blog/yazar/{handle}`; `seo.jsonLd` backend'in (`ProfilePage` + `Person`, `BreadcrumbList`); canlı yazısı olmayan yazar `noindex,follow` |
| `PostMetaView.authorPath?` | `string \| null` | seçili yazarın sayfası; yazar satırı bağlantı olur. Yazar seçilmemiş eski yazıda ad bağlantısız (`postMeta`) |
| `ContentPageView.author?` | `AuthorView` \| `null` | yazının sonundaki yazar kutusu (`authorView`, `lib/views/authors.ts`) |
| `BlogIndexPageView.activeAuthor?` | `AuthorView` \| `null` | yazar sayfasının başı; yalnız yazar sayfasında dolu |
| `AuthorView` | `{ name, path, jobTitle: string \| null, bio: string[], image: ImageView \| null, links: SocialLinkView[] }` | biyografi boş satırlarla paragraflara bölünür; fotoğrafın alt metni yazarın adı; profiller sabit sırada (web sitesi, LinkedIn, Instagram, X), sözcükler vitrinin (`blog.author_link_*`), web adresi olmayan atlanır |

- **Vitrin:** `BlogAuthorScreen` (`screens/blog.tsx`) arşivlerle aynı listeyi kurar: sayfa başına 12 yazı, `?sayfa=` (1 → çıplak adrese 301, sondan sonrası ve sayı olmayan 404), sonraki sayfa kendi başlığı ve kanoniğiyle (`pagedSeo`). Yazarın başı her sayfada; biyografi, arşivin kendi metni gibi yalnız ilk sayfada. Canlı yazısı olmayan yazar için liste hiç istenmez (boş). Kategori çubuğu arşivlerdeki gibi üstte.
- **Atölye:** yazar satırı "Yazan: {ad}" adı yazar sayfasına bağlar; makalenin sonunda, etiket ve paylaşım haplarından sonra yazar kutusu (`content/Author.tsx`); yazar sayfasında `BlogIndexPage` başlığın yerine yazarın başını çizer (`AuthorHead`, tek `h1`). Taban tema yazar sayfasında unvanı ve biyografiyi başlığın altına yazar; yazıda yazar çizmediği için bağlantısı yok.
- **Testler:** vitrin `lib/views/__tests__/authors.spec.ts`, `content-extras.spec.ts` (`postMeta`), `screens/__tests__/blog-author.spec.ts`, `lib/__tests__/atolye-author-theme.spec.ts`.

## Ek (2026-11-06, dönüşüm olayları): GA4 ve Meta olaylarının tamamlanması, sepetin kendi bakışı (otonom, gözden geçir)

D9'un "dönüşüm olayları (F10.9) açık" kalemi. Tema sözleşmesine yeni alan yok: hepsi vitrinde (`apps/storefront/src/lib/analytics`), hangi tema çizerse çizsin aynı.

- **Olay listesi (GA4 önerilen e-ticaret olayları):** `page_view`, `view_item_list`, `select_item` (yeni), `view_item`, `search`, `add_to_cart`, `remove_from_cart` (yeni), `view_cart` (yeni), `begin_checkout`, `add_shipping_info` (yeni), `add_payment_info`, `purchase`, `sign_up`. Meta'da karşılığı olanlar: `ViewContent`, `Search`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Purchase`, `CompleteRegistration`, `PageView`; diğerleri yalnız GA4'e gider.
- **Sepete ekleme/çıkarma sepetin kendi bakışıyla:** çerçeve (`layout.tsx`) başlığın sepetini (`headerCart`, istek başına bir kez, React `cache`) yalnız bir etikete izin veren ziyaretçiye `CartSnapshot` olarak verir (varyant başına adet, satırın sunucu toplamı / adet). Tarayıcı (`watchCart`) önceki bakışla karşılaştırır: artan adet `add_to_cart` (bugünkü fiyatla), azalan `remove_from_cart` (önceki fiyatla). Böylece ürün sayfası, kartın hızlı eklemesi, çekmecenin +/−'sı, sepet sayfası, öneriler hangi temadan gelirse gelsin sayılır. Temanın `add_to_cart` sinyali (`emitShopEvent`) artık sayılmaz (çift sayım olurdu); sözleşmede kalır, zararsız. Sayfanın bağlamı (`items`) satıra marka/kategori ekler.
  - **Yanlış "ekleme" yok:** ilk bakış yalnız taban olur; başka sepete geçiş (geri dönen sepet, oturum değişimi) taban olur; ödeme bağlantısının kilitli sepeti (adr/0051) hiç sayılmaz; sipariş sonrası boşalan sepet `remove_from_cart` değildir. Yalnız *bu sayfada* "sepet yok" görülmüşken açılan yeni sepet eklemedir.
  - **Sekmeler arası:** son bakış `localStorage`'da (`qt_cart_seen`); aynı sepete başka sekmenin daha yeni bakışı esas alınır, değişiklik iki kez söylenmez.
- **`select_item`:** liste sayfası (`screens/listing.tsx`) bağlama kartların yol → öğe haritasını koyar (`listContext`, listedeki sırasıyla `index`); çerçeve belgeye yakalama evresinde tek tıklama dinleyicisi takar, aynı köken ve haritadaki yol ise olay. Tema bir şey yapmaz.
- **`view_cart`:** sepet sayfasında, sepet başına sayfa açılışında bir kez (`TrackEvents` `sendOn`); satır değişince tekrar gitmez.
- **`add_shipping_info`:** kargo seçilince ödeme adımı açılır; sayfa seçili yöntemin adını `shipping_tier` olarak, sepet ve seçenek başına bir kez gönderir.
- **Bir kezlik olaylar tarayıcı başına:** `once` anahtarları (`purchase:{order}`, `begin_checkout:{cart}`, `add_shipping_info:{cart}:{option}`, `sign_up`) `sessionStorage` yerine `localStorage`'da: yenileme de, siparişin adresini başka sekmede açmak da satın almayı yeniden saymaz. Depolama reddedilirse sayfanın belleği sayar. Ziyaretçi bütün izinleri geri alınca tutulanlar (`qt_event:*`, `qt_cart_seen`) silinir; izin yokken hiçbir şey yazılmaz.
- **Performans:** yükleyiciler (`loaders.ts`) kuyruğu hemen kurar, betikleri sayfa `load` olduktan sonra `requestIdleCallback` (en geç 4 sn) ile ekler: LCP ile yarışmaz, hiçbir şey çizmez (CLS 0).
- **Tekilleştirme (değişmedi, doğrulandı):** backend'in sunucu olayları (`workflows/conversions/send.ts`) sipariş kimliğini kullanır: Meta CAPI `event_id = order.id`, GA4 MP `transaction_id = order.id`. Tarayıcı aynısını gönderir (`eventID`, `transaction_id`). Misafir siparişinin adresi `?token=` taşıdığından Meta pikseli orada susar; satın alma Meta'ya yalnız sunucudan gider. GA4 `purchase` tarayıcıdan bir kez ve sunucudan aynı `transaction_id` ile gider.
- **Testler:** `lib/analytics/__tests__/cart.spec.ts` (fark hesabı, sepet görüntüsü, sekmeler arası, `select_item`), `client.spec.ts` (yüklemenin `load`'u beklemesi, tarayıcı başına bir kez, izin geri alınınca silme), `events.spec.ts`, `payloads.spec.ts` (`listContext`); sahte tarayıcı `src/test/fake-browser.ts`.
