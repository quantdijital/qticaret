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
