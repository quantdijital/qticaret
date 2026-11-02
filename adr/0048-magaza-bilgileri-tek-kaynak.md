# ADR-0048: Mağaza bilgileri tek kaynaktan

- **Durum:** Kabul (2026-11-02). Kullanıcı planı onayladı: "önerilerini beğendim uygulamaya başla".
- **Tarih:** 2026-11-02
- **İlgili:** adr/0041 (yasal metinler ve belirteçleri), adr/0046 (vitrin), adr/0047 (iletişim formu), adr/0012 (ayar bölümleri)

## Bağlam

Kullanıcı: "yasal metinler kısmını zaten firma bilgilerinden otomatik üretilecek şekilde ayarladık … ekstra neden içerik kısmında sayfa oluşturuluyor … bunun gibi seo içeriklerinin hepsini, iletişim bilgilerini vs oluşturduğumuz yapılardan çekelim."

2026-11-02 taraması:

1. **Yasal metin kopyaları:** mylarte profil betiği (`shop:profile`) eski sitenin 12 sayfasını adresleri değişmesin diye içerik sayfası yapmıştı. 8'i yasal metindi (satış sözleşmesi, KVKK, çerez, iade ve 4 toptan metni). Asıl yasal metinler yasal modülde firma bilgilerinden üretilip `/yasal/...`'da yayınlanıyor. Alt bilgide de kopya bağlantılar vardı.
2. **Elle yazılmış iletişim bilgisi:**
   - İletişim sayfası metninde adres, telefon, e-posta ve çalışma saatleri yazılıydı.
   - Duyuruda ve güven rozetinde ücretsiz kargo eşiği ("1500 TL") elle yazılıydı.
   - Aynı numara iki yerde girilmişti: Mağaza'da telefon, Vitrin'de WhatsApp.
   - Çalışma saatleri ve harita konumu hiçbir yapıda yoktu.
3. **Doğru olanlar:** alt bilgi, yasal metinlerin belirteçleri, yapısal veri ve e-postalar zaten ayarlardan okuyordu.

## Karar

1. **Yasal metinler yalnızca yasal modülden.**
   - İçerik sayfası olarak açılmaz.
   - Profil biçimine `retired_pages` eklendi: profilin artık istemediği sayfalar yüklemede (varsa) silinir; yolları 410 döner.
   - Eski sitenin adresleri geçiş günü `/yasal/...`'a 301 alır (`docs/gecis/mylarte/esleme.md` §3).
   - Eski site metinleri yalnız başvuru içindir: `docs/gecis/mylarte/eski-yasal-metinler/`.
   - Panelin İçerik ekranı yasal metinler için Ayarlar > Yasal'a yönlendirir; başlığı yasal metne benzeyen yeni sayfada uyarı gösterir (engellemez).
   - Toptan hukuk metinlerinin yasal modülde türü yok; toptan satış özelliği (D14) kararını bekler.
2. **Mağaza bilgileri `store` ve `legal` bölümlerinde.**
   - `store`'a eklenenler:
     - `whatsapp_phone`: `storefront` bölümünden taşındı; `store-whatsapp-phone` göç betiği değeri bir kez kopyalar.
     - `opening_hours`: ISO gün (1 Pazartesi) ve `HH:MM` aralıkları; günde birden çok aralık olabilir, çakışmaz; aralığı olmayan gün kapalıdır.
     - `map_url`: https.
   - Adres ve yasal kimlik `legal` bölümünde kalır.
   - `legalIdentity()` hepsini birleştiren tek okuma noktasıdır.
3. **Okuyanlar.**
   - `/store/legal-identity` artık `whatsapp`, `opening_hours` ve `map_url` da döner.
   - Vitrin bunlarla şu yerleri doldurur:
     - alt bilgi (saatler dahil);
     - ürün sayfasındaki ve ana sayfadaki WhatsApp düğmeleri;
     - iletişim sayfası (`contact_form_path`'teki sayfa): metnin altındaki "İletişim bilgileri" bloğu (telefon, e-posta, adres + harita bağlantısı, saatler, WhatsApp) ve iletişim formu. Sayfanın metni bu bilgileri tekrar etmez.
   - Ana sayfa yapısal verisinde `OnlineStore.contactPoint` (müşteri hizmetleri telefonu, e-postası, `hoursAvailable`).
   - Harita sayfaya gömülmez, bağlantı olarak açılır: CSP `frame-src` değişmez.
4. **Bilgi değişkenleri.** Panelde yazılan metin, mağaza bilgisini adıyla anar ve vitrin o anki değeri basar.
   - **Biçim ve adlar:** yasal metinlerin `{belirteç}` biçimi ve adlarıyla aynı (`{mağaza_adı}`, `{telefon}`, `{e_posta}`, `{adres}`, `{whatsapp}`). Yeni olan `{ücretsiz_kargo_eşiği}`; değeri `₺1.500` gibi basılır.
   - **Nerede:** duyurular, güven rozetleri, ana sayfa girişi; içerik sayfası, blog yazısı ve filtre sayfası metinleri.
   - **Kayıtta:** tanınmayan `{ad}` reddedilir (`platform_settings.token_unknown`, `content.token_unknown`). Yalnız `{harf_rakam}` biçimi sayılır, başka süslü parantez serbesttir.
   - **Gösterimde:** backend doldurur; değeri girilmemiş bilgi boş kalır:
     - `/store/storefront`;
     - içerik ve filtre sayfası HTML'i, başlıkları ve özeti;
     - SEO açıklaması.
   - **Panel:** `GET /admin/shop-tokens` (değişkenler ve şu anki değerleri) "Bilgi ekle" menüsüne ve "Vitrinde: …" önizlemesine kaynaklık eder.
5. **Denetim.** SEO danışmanına `A-DETAIL-01` kuralı eklendi (docs/14 §3.8). İçerik metninde mağazanın telefonu, WhatsApp'ı ya da e-postası elle yazılmışsa değişken önerilir.
6. **Panel: Ayarlar > Mağaza, "Mağaza profili".** Sekmeleri:
   - Genel: ad, logolar, saat dilimi ve birimler;
   - İletişim: e-posta, telefon, WhatsApp, adres, harita, çalışma saatleri;
   - Yasal kimlik;
   - Sosyal hesaplar.

   Vitrin ekranındaki WhatsApp kartı ve Görünüm ekranındaki logo kartı buraya taşındı. Alt alta uzayan kart yığını yerine sekmeler var (kullanıcı: "böyle aşağı doğru dolan bir yapı kurulmaz").

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **`store`/`legal` + değişkenler (seçilen)** | Tek kaynak; yasal metinlerle aynı belirteç dili; geçmiş metinler kendiliğinden güncel | Gösterimde doldurma maliyeti (ayarlar bellekte) |
| İletişim sayfasını sistem sayfası yapmak | Metin hiç yok | Mağaza kendi tanıtım metnini yazamaz; SEO metni yok |
| İçerik belgesine yeni "bilgi" düğümü | Düzenleyicide çip | Belge şeması, işleyici ve göç değişir; düz metin alanlarında (duyuru) yine düz biçim gerekir |
| Değişken yok, yalnız uyarı | Az kod | Her değişiklikte metinler elle düzeltilir |

## Sonuçlar

- **Backend:**
  - `lib/shop/hours.ts`, `lib/shop/tokens.ts`, `lib/shop/written-details.ts`, `lib/security/https-url.ts`;
  - `workflows/shop/info-values.ts`;
  - `migration-scripts/store-whatsapp-phone.ts`;
  - `api/admin/shop-tokens`;
  - HTTP testleri: `storefront-frame`, `legal-identity`, `content-saves` ve `shop-tokens`.
- **Vitrin ve tema:**
  - `ContactView.hours` ve `mapHref`;
  - `ContentPageView.contact`, temada `ContactDetails`;
  - `lib/views/hours.ts`.
- **mylarte profili:**
  - WhatsApp, saatler ve harita `store` bölümünde;
  - duyuru ve rozet `{ücretsiz_kargo_eşiği}` kullanıyor;
  - iletişim ve toptan metinlerinde elle yazılı bilgi yok (toptanın 08:00–17:00 saatleri mağaza saatlerinden farklı, kullanıcı kararı: esleme §5).

## Ek (2026-11-03): yayında hemen yansıma

adr/0049'daki "hemen yansıma" adımı. Vitrin mağaza geneli yanıtları süreç içinde 60 sn tutuyor (`lib/store-api/shared.ts`, `edge.ts`'teki site yanıtı; adr/0046 ek 2026-11-02). Yayın ya da ayar kaydı vitrine bu yüzden bir dakikaya kadar geç yansıyordu. Artık backend değişiklikten hemen sonra vitrine imzalı bir "yenile" sinyali gönderiyor. Sinyal ulaşmazsa eski davranış sürer: 60 sn.

**Backend (yapıldı):**

- **Gönderen:** `lib/storefront/refresh.ts` (`refreshStorefront(container, scopes)`). Tek deneme, 3 sn, `safe-fetch` ile, yönlendirme izlenmez. Hata çağırana hiç atılmaz.
  - Başarılı yanıt `storefront.refresh_sent` olarak loglanır. Başarısız yanıt `storefront.refresh_failed` olarak loglanır. Logda yalnız durum kodu (ya da `timeout` gibi neden) ve kapsamlar var; adres, başlık ve gövde yok.
- **Hedef:**
  1. `STOREFRONT_ORIGIN` (yeni, isteğe bağlı; yalnız köken; canlıda https). Geliştirmede ve testte boşsa `http://localhost:8000`. Geliştirici makinesi canlı mağazanın alan adına hiç gitmez.
  2. Canlıda o da boşsa mağazanın kanonik alan adı (`https://<canonical_host>`, `brandOf().storefrontUrl` ile aynı değer).
  3. İkisi de yoksa ya da `STOREFRONT_IP_SECRET` yoksa gönderilmez (debug log).
- **SSRF:** `safe-fetch` iç adresleri reddeder. Yalnız bu çağrı için, yalnız geliştirmede ve testte loopback (`127.0.0.0/8`, `::1`, `localhost`) ve hedefin kendi portu açıktır. Başka hiçbir yerde değişiklik yok.
- **Tetikleyiciler.** Hepsi iş akışı bittikten sonra ve ateşle-unut: kayıt vitrini beklemez. Ortak adım `refreshStorefrontStep(scopes)` (`workflows/storefront/steps/refresh-storefront.ts`); hata adımın içinde yakalanır, iş akışını düşürmez ya da geri almaz. Testlerde kapalıdır; bir test açabilir (`QT_TEST_STOREFRONT_REFRESH=1`, `RATE_LIMIT_RELAXED` gibi).

  | Olay | Kapsam |
  |---|---|
  | `storefront.layout_published` (abone `subscribers/storefront-refresh.ts`) | `layout` |
  | Ayar kaydı `storefront`, `theme`, `promotions`, `appearance` | `settings` |
  | Ayar kaydı `store`, `legal` | `settings`, `legal` |
  | Ayar kaydı `seo`, `maintenance` | `settings`, `site` |
  | Menü kaydı ya da silme | `menus` |
  | Yasal metin yayını (geri çekme yok) | `legal` |
  | İçerik sayfası, yazı ya da filtre sayfası kaydı (yalnız yayında olan ya da daha önce yayına çıkmış olan; taslak kaydı değil); bunların silinmesi; blog kategorisi ve etiketi kaydı ya da silme | `content` |

  `appearance` ve filtre sayfası görev listesinde yoktu. Logo vitrinin çerçevesinde (`/store/seo/site`) görünüyor, filtre sayfasına da menüden bağlantı verilebiliyor; bu yüzden eklendi.

**Sözleşme (backend → vitrin):**

- `POST <köken>/api/yenile`.
- Başlıklar:
  - `content-type: application/json`;
  - `x-qt-refresh-time`: Unix saniyesi;
  - `x-qt-refresh-signature`: HMAC-SHA256'nın onaltılık yazımı (64 karakter).
- Gövde: `{ "scopes": [...], "at": <aynı saniye>, "nonce": "<32 onaltılık karakter>" }`.
  - Kapsamlar şunlardan biri ya da birkaçıdır: `layout`, `settings`, `menus`, `legal`, `content`, `site`.
  - Her kapsam bir kez geçer. Sıra bu listedeki sıradır.
- İmzalanan metin `<time>.<nonce>.<scopes.join(",")>`. Anahtar `STOREFRONT_IP_SECRET`, iki sunucunun zaten paylaştığı sır (adr/0046 §5).

**Vitrin (sıradaki iş, vitrin ajanı):**

1. **Rota:** `app/api/yenile/route.ts`, yalnız POST, Node çalışma ortamı, gövde en çok 1 KB.
   - Vekil (`proxy.ts`) bu yolu kanonik alan adı 301'ine, normalizasyona, bakım kapısına ve resolve çağrısına sokmamalı. Backend yönlendirme izlemez; sinyal 301 alırsa başarısız sayılır.
2. **Denetim sırası.** Herhangi bir adım tutmazsa 401, gövdesiz ve `cache-control: no-store`:
   - IP başına hız sınırı (ör. dakikada 30), imza denetiminden önce;
   - `STOREFRONT_IP_SECRET` yoksa 404;
   - zaman başlığı `^\d{1,12}$` biçiminde ve en çok ±60 sn sapmalı; gövdedeki `at` başlıktakiyle aynı;
   - `nonce` `^[0-9a-f]{32}$` biçiminde;
   - `scopes` 1–6 bilinen değer içeriyor, tekrar yok;
   - imza `^[0-9a-f]{64}$` biçiminde ve `timingSafeEqual` ile tutuyor;
   - `nonce` son 2 dakikada görülmemiş. Süreç içi bir kümede tutulur, süresi geçenler budanır, üst sınırı vardır (ör. 1000). Küme yalnız imzası geçen istekle büyür.
   - Hepsi tutarsa önbellekler boşaltılır ve 204 döner.
3. **Kapsamın boşalttığı önbellekler.** `shared.ts` anahtarı `<yol>?<sorgu JSON>` biçiminde, yol önekiyle silinir. Hepsini boşaltmak da doğrudur; kapsamlar yalnız gereksiz yeniden okumayı azaltır.

   | Kapsam | Boşaltılan önbellek |
   |---|---|
   | `layout` | `/store/storefront-layout` (düzenin okunuşu) |
   | `settings` | `/store/storefront`, `/store/seo/site`, `/store/legal-identity` |
   | `menus` | `/store/storefront-menus` |
   | `legal` | `/store/legal/*`, `/store/legal-identity`, `/store/storefront-menus` (yasal metin bağlantısı yalnız yayındaysa görünür) |
   | `content` | `/store/content/terms*`, `/store/seo/paths*`, `/store/storefront-menus` |
   | `site` | `edge.ts`'teki `site` ve `/store/seo/site` |

4. **Dikkat: vekil ayrı paketlenir.** `proxy.ts` ile rota işleyicisi aynı modül örneğini görmeyebilir. Bu durumda `edge.ts`'teki `site` değişkeni rotadan silinemez. Önbellekleri `globalThis[Symbol.for("qticaret.store-cache")]` gibi süreç geneli bir kayıtta tutmak ya da her iki tarafın baktığı bir kuşak sayacı kullanmak gerekir. e2e'de doğrulanmalı: panelde kaydet, vitrin aynı saniyede göstersin.

**Bilinen sınırlar ve açık maddeler:**

- **Birden çok vitrin örneği (F16):** sinyal yük dengeleyicinin ardındaki tek bir örneğe düşer, öbürleri 60 sn'lik eski davranışta kalır. F16'da ya tek örnek çalışır ya da sinyal örneklere dağıtılır (ör. Redis yayın/abone).
- **İç ağdaki vitrin:** canlıda `safe-fetch` iç adresleri reddeder. `STOREFRONT_ORIGIN` iç ağdaki bir adres olursa sinyal `address_not_allowed` ile düşer. F16 vitrini iç ağdan çağıracaksa işletmecinin ayarladığı bu köken için ayrı ve dar bir izin gerekir.
- **Backend'in kendi önbellekleri:** yayındaki düzen backend'de sürüm numarasıyla bir dakika tutulur. İçerik değişince bu önbellek boşalmaz; düzendeki ürün ve kategori seçimleri bir dakikaya kadar eski kalabilir. Menü ve ayar yanıtları önbelleksizdir ya da ayar önbelleği kayıtta boşalır.
- **Aynı sır, iki iş:** IP imzası (`<zaman>.<adres>`) vitrinde üretilir, backend'de doğrulanır. Yenile imzası (`<zaman>.<nonce>.<kapsamlar>`) backend'de üretilir, vitrinde doğrulanır. Biçimler karışmaz: adres geçerli bir IP olmak zorunda, kapsam adları IP'de geçemez. İmzalar tarayıcıya hiç çıkmaz.
- **Testler:**
  - birim `lib/storefront/__tests__/refresh.unit.spec.ts`: imza, hedef seçimi, loopback'in yalnız yerelde açık olması, hatasız dönüş;
  - `lib/__tests__/env.unit.spec.ts`;
  - HTTP `storefront-refresh.spec.ts`: küçük bir alıcı. Yayın, vitrin ve SEO ayarı kaydı doğru kapsam ve geçerli imzayla geliyor. Alıcı 500 dönse de 3 sn'yi aşsa da yayın 200 ve kalıcı.
