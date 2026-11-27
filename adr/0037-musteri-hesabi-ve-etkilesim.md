# ADR-0037: Müşteri hesabı, misafir sipariş erişimi ve etkileşim modülleri

- **Durum:** Kabul edildi (önerildi 2026-10-28, otonom uygulandı; kullanıcı 2026-10-30 bütün otonom kararları kabul etti)
- **Tarih:** 2026-10-28
- **İlgili:** F10.1–F10.6, F10.10, F10.12; ADR-0004 (Store API kimlik modeli), ADR-0036 (bildirimler ve izin), ADR-0027 (hesaplar panelden), docs/13 §5 (JSON-LD), docs/04

## Bağlam

F10 vitrinin müşteri tarafını kuruyor: hesap, e-posta doğrulama, sosyal giriş, misafir siparişe erişim, yorum, soru-cevap, favori ve stok bildirimi. Bunların hepsi müşterinin yazdığı içerik ya da kişisel veriyle çalışır. Kötüye kullanım ve hesap ele geçirme riski bu fazın ana konusudur.

**Medusa 2.21.2'de doğrulananlar** (v2.21.2 kaynağı ve docs.medusajs.com, 2026-10-28):
- **E-posta doğrulama:**
  - Ayar: `projectConfig.http.authVerificationsPerActor: { customer: [{ entity_type: "email", auth_provider: "emailpass" }] }`, 2.16'dan beri.
  - Açıkken `POST /auth/customer/emailpass`, `/callback` ve kimliksiz token'la `/auth/token/refresh` doğrulanmamış hesaba giriş vermez. Yanıt 200 döner: `{ verification_required: true, token }`. Token'ın `actor_id`'si boştur.
  - Uçlar: `POST /auth/verification/request` (`entity_id`, `entity_type`) ve `POST /auth/verification/confirm` (`code`).
  - Kod 32 baytlık rastgele değerdir (base64url, 43 karakter), tek kullanımlıktır, 15 dakika geçerlidir ve yalnızca SHA-256 özeti saklanır; tahminle bulunamaz. Doğrulama `auth_identity.verifications[].verified_at` alanında tutulur; müşteride bir "doğrulandı" alanı yok.
  - Giriş doğrulamayı yalnızca bildirir, kod göndermez. Vitrin `verification_required` alınca `/auth/verification/request` çağırır.
- **Açıklar (çekirdekte, bizim kapatmamız gereken):**
  - `request` ucu, `entity_id`'nin isteyen kimliğin kendi adresi olup olmadığına bakmaz. F9'daki abonemiz (`account-messages`) kodu `entity_id`'ye gönderiyor. Kayıt token'ı alan herkes mağaza adına herhangi bir adrese kod yollatabiliyor.
  - Kayıt token'ı `POST /store/customers`'a doğrulamadan önce gidebilir. Gövdedeki `email` kimliğin adresine bağlı değildir; başkasının adresiyle müşteri kaydı açılabilir.
- **Sipariş uçları:**
  - `GET /store/orders` yalnızca oturumdaki müşterinin siparişlerini döner.
  - `GET /store/orders/:id` tasarım gereği kimlik istemez; sipariş kimliği anahtar sayılır. Medusa'nın kendi rehberi ("secure order retrieval") bunu sahiplik denetimiyle kapatmayı önerir.
  - Misafir için e-postayla sipariş arama çekirdekte yok.
- **Sosyal giriş:**
  - `@medusajs/medusa/auth-google` (`clientId`, `clientSecret`, `callbackUrl`, açılışta okunur). Google `email_verified` false ise girişi reddeder.
  - Hesap otomatik bağlanmaz. Aynı e-postada kayıtlı müşteri varsa yeni müşteri açılamaz (DUPLICATE_ERROR).
  - Apple için resmî sağlayıcı yok. Taban sınıf `AbstractAuthModuleProvider`; zorunlu metot yalnızca `authenticate`, geri dönüşte `validateCallback`.
  - `http.authMethodsPerActor` ile müşterinin kullanabileceği yöntemler açıkça sayılmalı.
- **Store uçları:** 2.21.0'dan beri her Store ucunda katı `allowed` alan listesi var; listede olmayan alanlar sessizce düşer. Müşteri `metadata`'sına müşteri yazabilir; güvenilen bir bayrak oraya konmaz.
- **Stok olayları:**
  - `inventory-level.updated {id}` ve `reservation-item.created|updated|deleted {id}`.
  - Satılabilir miktar `getVariantAvailability` ile okunur. `manage_inventory` false ise 0 döner; bu durum ayrıca ele alınır.
- **Müşteri grupları:** Promosyon kuralı ve fiyat listesi kuralı `customer.groups.id`. Grup üyeliği `linkCustomersToCustomerGroupWorkflow` ile değişir.

## Karar

1. **E-posta doğrulama açılır** (`authVerificationsPerActor`, yalnızca `emailpass`). Doğrulanmamış hesap giriş yapamaz; Medusa reddeder. Bizim eklediklerimiz:
   - Doğrulama kodu yalnızca isteyen kimliğin kendi `emailpass` adresine gider. Abone kimliğin `provider_identities` kaydına bakar; başka adrese kod gitmez. Bu, F9 kodundaki açığı kapatır ve ilk iş olarak yapılır.
   - `POST /store/customers`: gövdedeki e-posta, token'daki kimliğin adresiyle zorla değiştirilir. Başkasının adresiyle müşteri açılamaz.
   - `POST /auth/verification/request` hem IP başına hem kimlik başına hız sınırına girer.
   - Hesap doğrulanınca aynı e-postayla verilmiş misafir siparişleri bu hesaba bağlanır. Adresin sahipliği kanıtlanmıştır.
2. **Misafir sipariş erişimi imzalı bağlantıyla.**
   - `GET /store/orders/:id` yalnızca iki durumda açılır: siparişin sahibi olan oturumlu müşteri ya da geçerli bir sipariş token'ı. Token, `PII_HASH_KEY`'den türetilmiş anahtarla HMAC'tir; sipariş kimliği, e-posta özeti ve süreyi (30 gün) bağlar.
   - Sipariş e-postasındaki "siparişini görüntüle" bağlantısı bu token'ı taşır (şablonlardaki `orderUrl`).
   - Misafir iptali (F7 K7'den ertelenen) ve iade talebi aynı token'la yapılır.
   - Ödeme bitince vitrin token'ı tamamlanan sepetten alır. Sepet kimliği misafirin anahtarıdır ve yalnızca kısa süre işe yarar.
   - "Siparişimi bul" (sipariş no + e-posta) siparişi doğrudan göstermez. Bağlantıyı o adrese e-postayla yollar ve hız sınırlıdır; böylece e-posta tahminiyle başkasının siparişi açılamaz.
3. **Sosyal giriş.**
   - Google, Medusa'nın resmî sağlayıcısıyla çalışır. Yeni bağımlılık değil; `@medusajs/medusa` içinde.
   - Apple için kendi sağlayıcımız yazılır (`AbstractAuthModuleProvider`). İstemci sırrı ES256 imzalı JWT'dir; `id_token`, Apple'ın JWKS'iyle `node:crypto` kullanılarak doğrulanır. Bağımlılık eklenmez. Sahte Apple sunucusuyla test edilir.
   - OAuth istemcileri mağaza örneği başına kurulumda açılır ve ortamdan okunur (`GOOGLE_AUTH_*`, `APPLE_AUTH_*`). Onay ekranında mağazanın adı görünmeli. Yönlendirme adresi vitrinin alan adına bağlıdır, mağaza sahibinin Google Cloud kurması beklenmez. ADR-0027'nin "panelden" kuralına bilinçli istisnadır.
   - **Hesap bağlama:** Aynı e-postada kayıtlı müşteri varsa, sağlayıcı e-postayı doğrulanmış diyorsa ve bizim hesabın e-postası da doğrulanmışsa yeni kimlik var olan müşteriye bağlanır. Başka her durumda bağlanmaz. Müşteri önce şifresiyle girip bağlamayı hesap sayfasından yapar.
   - `authMethodsPerActor`: `customer: ["emailpass", "google", "apple"]`, `user: ["emailpass"]`.
4. **Etkileşim modülleri ayrı ve sektörden bağımsız.**
   - Modüller: `product-reviews`, `product-qa`, `wishlist`, `back-in-stock`. Her biri ürün, varyant ve müşteriye salt okunur link (`defineLink`, `readOnly`) kullanır.
   - Müşterinin yazdığı her içerik `pending → approved | rejected` durumundan geçer. Store API yalnızca `approved` olanı döner.
   - **Yorum:**
     - Yalnızca doğrulanmış hesap ve "doğrulanmış alıcı" yazabilir. Doğrulanmış alıcı, iptal edilmemiş bir siparişte ürünün bir varyantı teslim edilmiş müşteridir.
     - Ürün başına bir yorum (düzenlenebilir). Puan 1–5 tam sayı, metin uzunluğu sınırlı.
     - Görsel ikinci adımda gelir: mevcut yükleme kapısından (F2) geçer ve onaylanmadan görünmez.
     - Onayda ortalama puan ve sayı ürün özetine yazılır. JSON-LD `aggregateRating` yalnızca onaylı yorum sayfada görünüyorsa üretilir.
   - **Soru-Cevap:**
     - Yalnızca doğrulanmış hesap soru sorar. Cevabı mağaza (panel) ya da o ürünü almış doğrulanmış müşteri verir. Hepsi moderasyondan geçer.
     - `QAPage` JSON-LD, Google'ın kuralı gereği yalnızca tek sorunun kendi sayfasında üretilir; çok soru gösteren ürün sayfasında üretilmez. Store API bu sayfanın yükünü verir; sayfa F18'de.
   - **Favori:** Yalnızca oturumlu müşteri. Misafir favorileri vitrinde tutulur, girişte hesaba aktarılır (F18).
   - **Stok bildirimi:**
     - Oturumlu doğrulanmış müşteri doğrudan abone olur. Misafir e-postayla abone olur ama onay bağlantısına tıklamadan abonelik açılmaz; başkasının adresine ileti yollatılamasın diye (çift onay).
     - Stok olayları (`inventory-level.updated`, `reservation-item.*`) satılabilir miktar sıfırdan yukarı çıkınca aboneyi kuyruğa alır. Her abonelik tek bir ileti alır, sonra kapanır.
     - İleti alıcının istediği bir hizmet iletisi sayılır ve işlemsel gider. Çift onay ve abonelik kaydı kanıt olarak tutulur. Gözden geçir: avukat görüşüyle ticari sayılırsa izin denetimine geçer.
5. **Kötüye kullanım koruması (F10.12).**
   - Yorum, soru ve abonelik için müşteri ve IP başına hız sınırı profilleri.
   - Bağlantı ya da e-posta biçiminde metin içeren içerik otomatik onaylanmaz.
   - Uzunluk ve tekrar sınırları uygulanır.
   - F15'teki captcha için "challenge" işareti ucun yanıtında hazır bekler.
   - F9'dan devredilenler bu işle gelir: vitrinin tetiklediği SMS'te IP sayacı (sipariş anında IP özeti saklanır), misafir adreslerine mağaza başına günlük e-posta sınırı ve MX denetimi.
6. **Müşteri segmentleri (F10.3).**
   - Elle oluşturulan gruplar Medusa'nın müşteri gruplarıdır.
   - Kurallı segmentler kendi modülümüzde tanımlanır; bir iş onları Medusa gruplarına yazar. Örnek kurallar: toplam harcama, son sipariş tarihi, sipariş sayısı, izin durumu.
   - Promosyon ve fiyat listesi hedeflemesi `customer.groups.id` ile çalışır; ek bir hedefleme motoru yazılmaz.

## Uygulama notları (M1–M2, 2026-10-28)
- Sipariş anahtarı API'ye yalnızca `x-order-token` başlığıyla gelir; API adreslerinde ve loglarda görünmez. E-postadaki bağlantı vitrinin `/siparis/<id>?token=` sayfasıdır; vitrin anahtarı başlığa taşır. Bu sayfada F18'de `Referrer-Policy: strict-origin-when-cross-origin` olmalı, anahtar başka siteye sızmasın.
- Anahtar biçimi: `<bitiş, saniye, 36 tabanı>.<HMAC-SHA256, base64url>`. HMAC sipariş kimliğini, küçük harfe çevrilmiş e-postayı ve bitişi bağlar; anahtar `PII_HASH_KEY`, bağlam `order-access:v1`. Hiçbir şey saklanmaz; anahtarı geri almak için `PII_HASH_KEY` döndürülür.
- Sipariş kapısı yetkisiz isteğe 404 döner, 401 değil. Böylece sipariş kimliğinin var olup olmadığı anlaşılmaz. Kapı `GET /store/orders/:id`'de, iptalde ve iade talebinde çalışır.
- `POST /store/carts/:id/order-access`: tamamlanmış sepet, ödemeden sonraki 24 saat boyunca siparişin anahtarını verir.
- `POST /store/order-lookup` (sipariş no + e-posta):
  - Her durumda aynı 202 yanıtını döner. E-posta yanıttan sonra gönderilir, bu yüzden süre farkı da bilgi vermez.
  - Hız sınırı IP başına 15 dakikada 10, adres başına saatte 3.
  - Aynı sipariş için 10 dakikada en fazla bir e-posta gider.
- Misafir siparişlerinin hesaba bağlanması:
  - Doğrulama tamamlandığında Medusa olay yayımlamıyor. Bu yüzden bağlama, oturumlu müşterinin kendi hesabını ya da siparişlerini okuduğu ilk istekte yapılır (`GET /store/customers/me`, `GET /store/orders`). Oturum, adresin kanıtıdır.
  - Aynı e-postalı misafir kayıtlarının siparişleri hesaba taşınır. `ILIKE`'ta `_` ve `%` kaçışlanır.
  - Misafir kayıtları silinmez.
  - **Ek 2026-11-15 (#73 güvenlik incelemesi):** oturum ve `has_account` kanıt sayılmaz; bağlama yalnız `provenCustomer` doğruysa yapılır (girişin kendi adresi kendi oturumunda doğrulanmış ya da sosyal sağlayıcı kefil; `workflows/orders/attach-guest-orders.ts`). Kanıtsız hesap hiçbir şey almaz; adres kanıtlandıktan sonraki ilk okumada bağlanır. Hesaptan e-posta izni ve oturumlu stok bildirimi de aynı kanıtla hemen kaydolur, yoksa çift onaya düşer. İnceleme takibi (aynı gün): sosyal girişin bağlanacağı hesapta doğrulama, hesabın kendi e-posta girişinin kendi oturumunda yapılmış olmalı (`confirmedByOwnLogin`; başka kimliğin aynı adres için onayladığı kod sayılmaz); kefil sağlayıcılar yalnız `google` ve `apple` (`ADDRESS_VOUCHING_PROVIDERS`), adres büyük-küçük harf gözetmeden karşılaştırılır; kanıtsız hesabın e-posta izni yanıtta gösterilmez, bekleyen onay 10 dakika içinde yeniden gönderilmez, kendi kaydı olan izni hemen geri alır; KVKK silmede müşterinin bütün giriş kimlikleri ve adresin doğrulama kayıtları silinir; doğrulanmamış girişi sıfırlama bağlantısıyla alan sahip, hesaba yazılmış ad ve telefonu devralmaz (silinir).

## Uygulama notları (M4, sosyal giriş, 2026-10-28)
- Apple'ın REST API'si resmî belgeden doğrulandı:
  - `GET /auth/authorize`: `response_mode=form_post`, `scope=name email`, `state`, `nonce`.
  - `POST /auth/token`: form gövdesi, ES256 istemci sırrı (`iss` takım, `sub` Services ID, `aud` `https://appleid.apple.com`, `kid` anahtar).
  - `GET /auth/keys` (JWKS, RS256).
- Kendi sağlayıcımız `auth-apple`:
  - İstemci sırrı her token isteğinde 5 dakikalık üretilir.
  - Kimlik token'ında şunlar doğrulanır: imza (`kid` ile anahtar; bilinmeyen `kid` görülünce anahtar listesi yeniden okunur, aksi halde saatte bir), `iss`, `aud`, `exp`, girişin `nonce`'u ve `email_verified`.
  - Ad, yalnızca ilk girişte gelen `user` alanından alınır; iki kısa düz metin olarak, denetim karakterleri ve `<`/`>` atılarak saklanır.
  - Yönlendirme adresi hiçbir zaman istekten alınmaz.
  - Zaman aşımı 5 saniye, en çok 2 deneme: müşteri giriş sayfasında bekliyor.
- Google için Medusa'nın resmî sağlayıcısı kullanılıyor. Bilinen bir kusuru var: kod değişiminde istemci sırrını ve kodu POST gövdesinde değil URL sorgusunda gönderiyor. Bağlantı TLS üzerinde ve log'u bizde değil; yine de gözden geçir: istemci sırrı mağaza başına ve yalnızca bu iş için. Sorun olursa Apple'ınki gibi kendi sağlayıcımıza geçilir.
- Sağlayıcıların açılıp kapanması:
  - Her sağlayıcı yalnızca ortam değişkenlerinin hepsi doluysa kaydolur (`lib/auth/providers.ts`).
  - `authMethodsPerActor`: personel yalnızca e-posta; müşteri e-posta ve kurulmuş sosyal sağlayıcılar.
  - Kurulmamış sağlayıcıya istek reddedilir (testli).
- Hesap bağlama: Sosyal kimliğin ilk `POST /store/customers` isteğinde aynı adresle `has_account` bir müşteri varsa ve o adresin e-posta doğrulaması tamamlanmışsa (`auth_verification.verified_at`), yeni hesap açılmaz; kimlik var olan müşteriye bağlanır (`app_metadata.customer_id`, telafili workflow). Doğrulanmamış hesaba bağlanmaz; Medusa'nın "zaten hesabı var" hatası döner. Sosyalden sosyale bağlama yok.

## Uygulama notları (M5, segmentler, 2026-10-28)
- `customer-segments` modülü:
  - Segment satırı adını, kurallarını, kendi Medusa grubunu, üye sayısını ve son güncelleme zamanını tutar.
  - Grup, `metadata.managed_by = "segment"` ile işaretlenir; panel bu grubun üyelerini elle değiştirmeye izin vermez.
- Kurallar (`lib/customers/segments.ts`, hepsi birlikte uygulanır): en az harcama (kuruş), en az sipariş, son N günde sipariş, N gündür sipariş yok (daha önce sipariş vermiş olmak şartıyla), üye ya da misafir, kampanya e-postası izni.
- Doldurma:
  - Gece 03:00 UTC'de çalışan iş ya da "Şimdi güncelle" doldurur.
  - Müşteriler ve siparişler 1000'lik sayfalarla okunur, en fazla 200.000 kayıt; aşılırsa log yazılır.
  - Harcama, iptal ve taslak dışındaki siparişlerin `total`'ıdır. İadeler düşülmez; F11 raporlarıyla birlikte gözden geçir.
  - Grup üyeliği Medusa'nın `linkCustomersToCustomerGroupWorkflow`'u ile değişir, telafisiyle birlikte.
- Segment silinince grubu da silinir; o gruba bağlı kampanyalar ve fiyat listeleri artık kimseye uygulanmaz (panel bunu onay penceresinde söyler).
- Hata yanıtı: Medusa'nın gövde doğrulaması kuralın anahtarını `Invalid request: <anahtar>` diye sarıyordu. Mesaj yalnızca tek bir anahtar taşıyorsa hata işleyici artık anahtarı tek başına döndürüyor; panel diğer anahtarlar gibi çevirir. Bu, önceki kuralların hepsine de yarar (izin kanıtı, ayar bölümleri).

## Uygulama notları (M6, favori ve stok bildirimi, 2026-10-28)
- **`wishlist`:**
  - Ürün ya da varyant düzeyinde tutulur; ürün düzeyindeki kayıtta `variant_id` boş metindir, böylece tekillik kuralı NULL'a takılmaz.
  - Müşteri başına en çok 200 kayıt.
  - Yalnızca yayındaki ürün eklenir; satıştan kalkan ürün listede görünmez.
  - Başkasının kaydını silme isteği "silinmedi" döner.
- **`back-in-stock`:**
  - Adres şifreli (`PII_ENCRYPTION_KEY`), anahtarlı özet (`PII_HASH_KEY`) ve maskeli olarak tutulur. Tekillik varyant ve özet çiftine göredir.
  - Onay token'ı yalnızca SHA-256 özetiyle saklanır ve 24 saat geçerlidir. Süresi dolmuş bekleyen istek yeniden istenince yeni bağlantı gider.
  - Misafire her durumda aynı yanıt (202 `pending`) döner.
  - Takip edilmeyen ya da stokta olan varyanta abonelik açılmaz.
  - Hız sınırı IP başına 15 dakikada 10, adres başına saatte 5.
- Onay sayfası:
  - `GET` önce sorar (posta tarayıcısı açınca bir şey olmaz), `POST` açar.
  - Sayfa yardımcısı çıkış sayfasıyla ortak (`api/http/simple-page.ts`).
- Bildirim:
  - `inventory-level.created/updated` ve `reservation-item.updated/deleted` olaylarında, stok kaleminin varyantlarından bekleyen aboneliği olanlara bakılır.
  - Varsayılan satış kanalında satılabilir miktar sıfırın üstündeyse her aktif aboneliğe `stock.back_in_stock` gider.
  - Abonelik yalnızca ileti gitmişse (`sent`/`duplicate`) kapanır; gidemeyen sonraki değişikliği bekler.
  - Varyant başına kilit ve Medusa'nın tekrar anahtarı (abonelik kimliği) aynı anda gelen iki olayda tek ileti sağlar (KK2 testli).
- Panelde ürün sayfasında "Müşteri ilgisi" kartı: favorisine ekleyen ve stok bekleyen sayıları; kişi yok, yalnızca sayı.

## Uygulama notları (M7, yorumlar, 2026-10-28)
- `product-reviews` modülü: yorum ve ürün başına toplam (onaylı sayısı ve puan toplamı). Ortalama, bir ondalıkla.
- Yorum yazmak için kanıt: müşterinin iptal edilmemiş bir siparişinde o ürünün bir kalemi teslim edilmiş olmalı (`items.detail.delivered_quantity > 0`); yorum bu siparişe bağlanır.
- Müşteri başına ürüne bir yorum. Değiştirilen yorum yeniden onay bekler; o arada yıldızlardan düşer.
- Yazar vitrinde "Ad S." biçiminde görünür.
- Bağlantı ya da adres gibi okunan metin `has_link` ile işaretlenir; panelde uyarı rozetiyle görünür.
- Puan 1–5 tam sayı. Metin 10–2000 karakter, başlık en çok 100; denetim karakterleri atılır.
- Hız sınırı: IP başına saatte 20, müşteri başına saatte 10.
- Doğrulanmamış e-posta zaten oturum açamadığı için yorum yazamaz (KK6). Kayıt token'ıyla yapılan istek 401 alır (testli).
- JSON-LD:
  - Onaylı yorum varsa tek varyantlı `Product`'a, çok varyantlıda `ProductGroup`'a `aggregateRating` (ratingValue, reviewCount, bestRating 5, worstRating 1) eklenir; varyantlara tekrarlanmaz.
  - Mağazanın alan adı yoksa JSON-LD hiç üretilmez (mevcut kural).
  - Onay ya da ret, vitrinin önbellekteki yanıtlarını hemen unutturur.
- Panel: Katalog > Yorumlar.
  - Bekleyen, onaylanan ve reddedilen sekmeleri; bekleyenler eskiden yeniye.
  - Satır başına onay ya da ret, işaretleyerek toplu işlem.
  - Yıldızlar ekran okuyucuya "5 üzerinden N" diye okunur.

## Uygulama notları (M8, soru-cevap, 2026-10-28)
- `product-qa` modülü: soru ve cevap. Sorudaki `answer_count` onaylı cevap sayısıdır.
- Soru: doğrulanmış hesaptan, yayındaki ürüne, 10–1000 karakter; onay bekler.
- Cevap:
  - Mağazanın cevabı mağaza adıyla verilir, hemen yayımlanır ve soruyu da onaylar.
  - Müşteri cevabı yalnızca ürünü teslim almış müşteriden gelir (`questions.answer_purchasers_only`) ve onay bekler.
- Hız sınırı: yorumla ortak bütçe (müşteri başına saatte 10, IP başına 20).
- `QAPage` (Google'ın kuralları resmî belgeden doğrulandı):
  - Yalnızca tek sorunun kendi sayfasında üretilir: `GET /store/product-questions/:id`; yol `<ürün yolu>/sorular/<id>` ve sayfayı F18 kurar.
  - En az bir onaylı cevap ve mağazanın alan adı gerekir.
  - Mağazanın cevabı `acceptedAnswer` (yazarı `Organization`), müşterilerinki `suggestedAnswer` olur.
  - Sorunun `name` alanı ilk cümlesidir.
  - Ürün sayfası (birden çok soru) hiçbir zaman `QAPage` taşımaz (testli).
- Panel:
  - Yorumlar ekranı "Yorumlar ve sorular" oldu; Sorular sekmesi eklendi.
  - "Bakılacaklar" görünümü yeni soruları ve onay bekleyen cevabı olan soruları birlikte gösterir.
  - Satır başına onay ya da ret ve mağaza adına cevap kutusu.

## Uygulama notları (M9, kötüye kullanım, 2026-10-28)
- **Yorum, soru ve abonelik:**
  - Hız profilleri M6–M8'de kuruldu: `review_write`, `stock_alert`, `order_lookup`.
  - Bağlantı içeren yorum, soru ve cevaplar M7–M8'den beri onaysız yayımlanmaz.
- **Günlük e-posta sınırı (`notifications.email_daily_limit`):**
  - Varsayılan 5000; 100 ile 200 000 arasında; panelde Ayarlar > Bildirimler.
  - Mağazanın günlük sayacı Redis'te tutulur. %80'de personel zilde bir kez uyarılır (`messaging.email_daily_limit`).
  - Sınır aşılınca o gün hiçbir e-posta gitmez: sipariş, sıfırlama ve personel uyarıları dahil. Kayıtta `over_quota` olarak görünür.
- **Alan adı denetimi (`requireMailDomain`):**
  - Hangi uçlarda: kayıt (`/auth/customer/emailpass/register`), misafir sepeti (`POST /store/carts` ve `/store/carts/:id`), stok bildirimi.
  - Ne yapar: e-posta alan adının posta alıp almadığına bakar.
    - MX kaydı varsa alır.
    - MX yoksa alan adının kendi adresine bakılır (RFC 5321).
    - "null MX" (RFC 7505), olmayan alan adı ve ayrılmış adlar reddedilir: `.invalid`, `.test`, `.localhost`, `.example`, `.local`.
  - Hata anahtarı: `messaging.email_domain_refuses`.
  - DNS'e 2 saniye süre verilir. Yavaş ya da hatalı DNS adresi geçirir; yalnızca net "yok" cevabı reddeder.
  - Önbellek süreç içinde tutulur: "alır" cevabı 24 saat, "almaz" cevabı 1 saat.
  - `EMAIL_DOMAIN_CHECK=off` denetimi kapatır. `NODE_ENV=test` altında varsayılan olarak kapalıdır, çünkü testlerin adresleri uydurmadır.
- **Checkout'ta SMS şişirme:**
  - "Siparişiniz alındı" SMS'i, alışverişçinin yazdığı herhangi bir numaraya gider.
  - Bir IP (IPv6'da /64) bir saatte 10'dan fazla sepet tamamlarsa o sepetlere `qt_sms_held` işareti konur. Bu siparişlerin SMS'i gönderilmez (`over_quota`), e-postası gider.
  - IP adresi hiçbir yerde saklanmaz.
  - `qt_` önekli metadata yalnızca sunucunundur. Vitrin bunu artık sepetin kendisinde de yazamaz; önceden yalnızca satırlarda engelleniyordu.
  - Sayaç hata verirse checkout durmaz.
- **Captcha işareti:** `smsAllowance` bir IP saatte 3 istekten fazlasını yaptığında `challenge` döndürür. Captcha sağlayıcısını ve vitrinde gösterimini F15 seçer. Captcha'nın gerekeceği uçlar: kayıt, stok bildirimi, siparişimi bul, yorum ve soru.
- **Gözden geçir:**
  - Sınır aşılınca işlemsel e-postalar da duruyor. Ayrı bir işlemsel kota gerekebilir.
  - Mobil operatörlerin ortak IP'si (CGNAT) arkasındaki alışverişçiler yoğun saatte sipariş SMS'ini kaybedebilir; e-posta yine gider.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| Doğrulamayı kendi ara katmanımızla zorlamak | Tam denetim | Medusa zaten yapıyor; iki yol tutarsızlaşır |
| `GET /store/orders/:id`'yi olduğu gibi bırakmak | Sıfır iş | Sipariş kimliği bağlantıda, logda, Referer'da sızınca adres ve e-posta açılır |
| Google'ı kendi sağlayıcımızla yazmak (panelden hesap) | ADR-0027'ye uyar | OAuth istemcisi vitrinin alan adına bağlı, mağaza sahibinden Google Cloud kurmasını beklemek gerçekçi değil |
| Apple için `auth-oidc` | Hazır | Apple'ın ES256 istemci sırrı ve `form_post` yanıtı doğrulanmadı |
| Tek "ugc" modülü (yorum + soru) | Az kod | Farklı yaşam döngüleri ve şema çıktıları; birinin değişikliği ötekini bozar |

## Sonuçlar

- Doğrulama açılınca test yardımcıları (müşteri kaydı) kodu sahte posta kutusundan okuyup onaylar.
- Vitrin (F18) giriş yanıtında `verification_required`'ı ve sipariş sayfasında token'ı ele alır. Sözleşme `packages/types`'a yazılır.
- Kurulumda (F16) mağaza başına Google ve Apple OAuth istemcisi açılır. Apple Developer hesabı kod dışı gereksinimdir (docs/12).
- Panel: yorum ve soru moderasyonu ekranları, müşteri grupları ve segmentler, müşteri sayfasında favori ve abonelik sayıları.

## Ek (2026-10-31, F15.1): doğrulama kodu yalnızca kendi oturumunda

F14 kapanış incelemesi, Medusa 2.21.2'nin `POST /auth/verification/confirm` ucunun kodu tek başına kabul ettiğini gösterdi (kaynak: `providers/verification/token.ts`; `auth_identity_id` denetlenmiyor, rota oturumsuz isteğe açık). Birinin adresiyle kayıt açan, adres sahibine e-postadaki doğrulama bağlantısını açtırarak adresi kendi hesabına doğrulatabilir ve o adresle verilmiş misafir siparişlerini (§1) alabilirdi.

Karar: onay, kodu isteyen kimliğin token'ıyla yapılır (`api/http/verification.ts`). Oturum yoksa 401 (`account.verification_session_required`). Kod başka bir kimliğinse yanıt bilinmeyen kodunkiyle aynıdır (400), kod sahibinin kim olduğu sızmaz. Kod kaydı, Medusa'nın kendi sakladığı SHA-256 özetiyle bulunur. Vitrin (F18) doğrulama sayfasında oturum yoksa girişi ister. Test: `integration-tests/http/account-verification.spec.ts`.


## Ek (2026-10-31, F15.1): şifre değişince önceki token'lar yenilenmez

Medusa 2.21.2 her token'ı yeniler (`/auth/token/refresh`; kendi notu: "şifre değişince yenilemeyi kapatmak isteyebiliriz"). Birinin adresiyle kayıt açan, kaydın verdiği kimliksiz token'ı saklar. Adres sahibi şifreyi sıfırlayıp adresi doğruladıktan sonra bu token'ı yenileyerek hesaba girebilirdi.

Karar (`api/http/password-change.ts`):
- Sıfırlama bağlantısıyla şifre değişince (`POST /auth/:actor_type/emailpass/update`, yanıt 200) değişme anı kimliğin `app_metadata.password_changed_at` alanına yazılır. Adres sıfırlama token'ının `entity_id`'sinden okunur.
- Bu andan önce verilmiş (`iat`) bir token üç yerde 401 alır (`account.token_before_password_change`): `/auth/token/refresh`, `/auth/session` ve `POST /store/customers`. Aynı saniyede verilen token yeni girişindir.
- Sınır: kimliği olan eski bir token kendi ömrü dolana kadar (Medusa varsayılanı 1 gün), açık bir oturum da 10 saat geçerli kalır; ikisi de yenilenemez. Her istekte kimliği okumak yerine bu bilinçli olarak bırakıldı.
- Başlık Medusa'nın okuduğu gibi okunur: `Bearer` sonrasındaki ilk kelime, ardından ne gelirse gelsin. Okunamayan bir bearer token bu üç yerde 401 alır (`account.session_invalid`). Güvenlik incelemesi 2026-10-31: katı okuma `Bearer <token> x` başlığını denetimden kaçırıyordu.

Test: `integration-tests/http/account-verification.spec.ts`.

## Ek (2026-11-04): yorum fotoğrafları ve puan dağılımı (otonom, gözden geçir)

İkinci vitrin teması yorum kartında fotoğraf ve puan dağılımı istiyor (denetim 2026-11-04 §7); eski sitede yorum fotoğrafı vardı. Müşterinin fotoğraf ekleme yolu yoktu; eklendi.

- **Yükleme:** `POST /store/products/:id/reviews/photos`, gövde fotoğrafın baytları (JPEG, PNG, WebP, AVIF; en çok 10 MB). Yalnız oturum açmış ve ürünü teslim almış müşteri (yorumla aynı kanıt, `reviews.not_purchased`). Baytlarına göre denetlenir ve temizlenerek saklanır (docs/04, F3.3: EXIF/GPS yok). Yanıt `{ photo: { id } }`. İş akışı `review-photo-upload`: denetim → dosya (geri alınınca silinir) → kayıt (geri alınınca silinir).
- **Sınırlar:** yorum başına 3 fotoğraf (`reviews.photos_too_many`); müşteri başına bir ürün için yoruma bağlanmamış en çok 6 yükleme (`reviews.photo_uploads_full`); hız profili `review_photo` (IP başına saatte 30, müşteri başına 20). Vitrinin form eylemi en çok 10 MB gövde alır (`next.config` `serverActions.bodySizeLimit`).
- **Yoruma bağlama:** `POST /store/products/:id/reviews` `photo_ids` alır (sıralı; gönderilmezse yorumun fotoğrafları kalır). Fotoğraflar yazarın bu ürün için yüklediği ve başka yoruma bağlı olmayanlar olmalı (`reviews.photo_unknown`). Bağlama yorumun yazıldığı aynı işlemdedir: personel yorumu gördüğü sürümüyle onaylar (`updated_at` kuralı), fotoğraflar da o sürümle gider. Listeden çıkarılan fotoğraflar kaydıyla silinir, dosyaları işlem bitince kaldırılır.
- **Moderasyon:** fotoğraf yorumla birlikte onaylanır ya da reddedilir; onaylanmamış yorumun fotoğrafı vitrinde hiçbir yerde görünmez. Panel bekleyen yorumda fotoğrafları gösterir (`GET /admin/product-reviews` satırında `photos`).
- **Okuma:** `GET /store/products/:id/reviews` ve `GET /store/reviews` her yorumda `photos: { id, url, width, height }[]`; ürün yanıtında `rating.distribution` (`{ "5": n, "4": n, "3": n, "2": n, "1": n }`, onaylı yorumlar üzerinde tek gruplu sayım). `GET /store/reviews/photos?limit=` (1–24, varsayılan 12): görünür ürünlerin onaylı yorumlarındaki en yeni fotoğraflar, yorumun yıldızı, yazarı ve ürünüyle (ana sayfanın müşteri fotoğrafları).
- **KVKK:** fotoğraf kişisel veridir (kişiyi ya da evini gösterebilir). Yoruma bağlanmayan yükleme 1 gün sonra dosyasıyla silinir (`review-photo-sweep`, her gece 04:15). Müşteri silindiğinde (L9) yorum metni "Anonim" adıyla kalır, fotoğrafları dosyalarıyla silinir. Veri kopyasında `yorum_fotoğrafları`. docs/kvkk-envanter.md §3.
- **Migration:** `Migration20261104210345` (`product_review_photo`). Servis yöntemleri `listReviewImages` vb. (Medusa "Photo"yu "Photoes" diye çoğullaştırdığı için model `ReviewImage` adıyla kayıtlı; tablo `product_review_photo`).
- **Testler:** `modules/product-reviews/__tests__/photos.unit.spec.ts`, `integration-tests/http/review-photos.spec.ts`, `product-reviews.spec.ts` (dağılım).

## Ek (2026-11-05): mağaza yorumlarında yıldıza göre süzme (otonom, gözden geçir)

`/yorumlar` sayfasında ziyaretçi yalnız belli puandaki yorumları görmek istiyor (adr/0046 Ek 2026-11-05'te kapsam dışı bırakılmıştı: uç süzgeç almıyordu).

- **Uç:** `GET /store/reviews?rating=` isteğe bağlı, **tek değer** 1–5 tam sayı (Zod, `StoreGetShopReviews`); başka değer 400. Liste değil, çünkü vitrin süzgeci tek seçimdir (`?puan=5`) ve çoklu seçim bir arayüz gerektirmeden önbellek anahtarlarını çoğaltırdı; gerekirse sonra `rating[]` eklenebilir. Ürünün kendi yorum ucu (`/store/products/:id/reviews`) değişmedi.
- **Sayım:** yanıttaki `count` süzülmüş yorumların sayısıdır (sayfalama için). Mağaza geneli ortalama ve 5→1 dağılım `GET /store/reviews/summary`'de kalır; vitrin süzgecin bağlantılarındaki sayıları oradan alır, sayfaya göre küçülmez.
- **Önbellek:** uç önceki gibi görünür ürün listesini (yayında ve anahtarın satış kanalında) kanal kümesi başına 30 sn tutar; süzgeç yalnız sorguya eklenir.
- **Vitrin:** `?puan=` 1–5 dışı her şey 404 (sayfa numarası gibi); sayfa bağlantıları süzgeci korur; süzülmüş sayfa `noindex,follow`, canonical `/yorumlar` (liste süzgeçlerinin kuralı, docs/13 §7). Tema sözleşmesinde isteğe bağlı `ReviewsPageView.filter` (`options`: puan, sayı, bağlantı, seçili mi; `active`, `clearPath`); taban tema çizmez.
- **Testler:** `integration-tests/http/product-reviews.spec.ts` (4 ve 5 yıldız, 6 ve sözcük 400), vitrin `lib/views/__tests__/review-filter.spec.ts`, `atolye-reviews-theme.spec.ts`.

## Ek (2026-11-10): mağazanın yoruma yanıtı (otonom, gözden geçir)

Mağaza Google yorumlarına panelden yanıt verebiliyordu (adr/0058 Ek 2026-11-06), kendi ürün yorumlarına veremiyordu. Ürün sorusuna mağaza cevabı (M8) örnek alındı.

- **Veri:** `product_review` üzerinde `reply` (düz metin), `replied_by` (personel), `replied_at`; ayrı tablo yok, yorum başına bir yanıt. Migration `Migration20261110183000`.
- **Uç:** `POST /admin/product-reviews/:id/reply` `{ body }` (yazar ya da değiştirir), `DELETE` (kaldırır); ikisi de `product-review-reply` iş akışı (geri alınınca önceki yanıt yerine konur). Metin soru cevabının kuralıyla temizlenir (`plainText`: satır sonu dışındaki denetim karakterleri atılır, kırpılır; yarım vekil karakter `reviews.reply_invalid`), en çok 1.000 karakter (`reviews.reply_required`, `reviews.reply_too_long`). Yanıt **yalnız onaylı yoruma** yazılır (`reviews.reply_not_approved`; soru cevabı da yalnız yayındaki soruda görünür); kaldırmak her durumda olur, yanıt yoksa `reviews.reply_missing`.
- **Yazar değiştirirse:** yorum yeniden onay bekler, yanıt silinmez; yeniden onaylanınca yanıtıyla görünür, mağaza pencereden günceller ya da siler.
- **Yetki:** soruya cevap gibi: sahip, yönetici ve operasyon yazar; salt okunur yazamaz (`permission-rules`).
- **Denetim:** `product_review` kaynağı; yanıt var mı, uzunluğu, kim, ne zaman (önce/sonra). Metnin kendisi kayda girmez.
- **Bildirim yok:** soru cevabı da müşteriye ileti göndermiyor; yanıt için de kanal ya da şablon açılmadı.
- **KVKK:** yanıt mağazanın metnidir, müşterinin kişisel verisi değildir; müşteri silinince yorum "Anonim" adıyla kaldığı gibi yanıt da kalır (mağaza cevapları gibi). Müşterinin veri kopyasına girmez.
- **Okuma:** `GET /admin/product-reviews` her satırda `reply`, `replied_at`; `replied=false|true` süzgeci (panelin "Yanıtsız" sekmesi: onaylı ve yanıtsız). `GET /store/products/:id/reviews` ve `GET /store/reviews` her yorumda `reply: { body, author_name, created_at } | null`; `author_name` mağazanın adı (Medusa mağaza adı, okunurken).
- **Vitrin:** Atölye yorumun altında Google yanıtlarının kutusunda [2026-11-27: Google yorumları kaldırıldı, adr/0058; kutu kendi başına kalır] "Mağazanın yanıtı · mağaza adı · tarih" (`parts/ReviewReply`); ürün sayfası ve `/yorumlar`. Tema sözleşmesinde isteğe bağlı `ReviewView.reply`. **JSON-LD:** yanıt bir `Review` değildir, yapılandırılmış veriye girmez; ürün JSON-LD'si yalnız `aggregateRating` taşır, değişmedi.
- **Testler:** `workflows/customers/__tests__/review-reply.unit.spec.ts`, `integration-tests/http/product-review-replies.spec.ts`, panel `review-dialog.spec.tsx`, `reviews-page.spec.tsx`, vitrin `card-extras.spec.ts`, `atolye-product-theme.spec.ts`, `atolye-reviews-theme.spec.ts`.

## Ek (2026-11-27): soruların ve yorumların panelden yönetimi (sahip isteği)

Sahip ürün sayfasında eklediği soruları göremiyor, Yorumlar ve sorular ekranında düzenleyemiyor ve silemiyordu.

- **Sorular:** `GET /admin/product-questions?product_id=` ürünün bütün soruları (her durum, en yeni önce, 50). `POST /admin/product-questions` `{ product_id, question, answer }` mağaza adına elle soru + yanıt (SSS taslağının eklediği gibi hemen yayında; iş akışı `product-question-add-shop`). `POST /admin/product-questions/:id/edit` `{ body?, answer? }`: sorunun metni (müşterininki de: yazım hatası, kişisel bilgi) ve mağazanın kendi yanıtı (yazılır, değiştirilir, `null` kaldırır); bekleyen soruya yazılan yanıt soruyu da yayımlar (`answerAsShop` gibi), gizli soru gizli kalır. Müşteri yanıtı hiç yeniden yazılmaz, onaylanır ya da reddedilir. `DELETE /admin/product-questions/:id` soruyu yanıtlarıyla yumuşak siler; `POST /admin/product-questions/:id/restore` ("Geri al") birlikte silinen yanıtlarla geri getirir (`deleted_at` sorununkinden sonra olanlar; daha önce kaldırılan mağaza yanıtı dönmez). Ayrı `/edit` yolu: `POST /:id` eşleştiricisi `/moderate` gövdesini de doğrulardı. Hepsi iş akışında, her adımın geri alması var; metin `plainText` + `isCleanText`, 2–1.000 karakter.
- **Gizle/göster:** var olan `POST /admin/product-questions/moderate` (`rejected` = gizli, `approved` = yayında); yeni uç yok.
- **Yetki:** ekleme ve düzenleme sahip, yönetici, operasyon; silme ve geri alma sahip ve yönetici (iletişim mesajını silmek gibi). Salt okunur yalnız okur.
- **Denetim:** `product_question` kaynağı (düzenleme, silme, geri alma): durum, silinmiş mi, metin ve mağaza yanıtının uzunluğu, önce/sonra. Metnin kendisi kayda girmez.
- **Yorumlar:** müşterinin yorum metni ve puanı mağazaca **düzenlenmez ve silinmez** (doğrulanmış alıcının beyanı; puan ortalamasını ve JSON-LD'yi besler; kişisel veri silme KVKK yolundan, L9). Mağaza yorumu gizler (`rejected`) ya da yeniden yayımlar (`approved`, `updated_at` kuralıyla, var olan uç); kendi yanıtını düzenler ya da siler (Ek 2026-11-10). Panel satırında "Gizle"/"Yayımla".
- **Vitrin:** soru listesi vitrinde önbelleksiz okunur (`storeGet`, `no-store`; backend'de de önbellek yok): gizlenen ya da silinen soru bir sonraki sayfa açılışında görünmez.
- **Testler:** `workflows/customers/__tests__/question-admin.unit.spec.ts`, `integration-tests/http/product-qa-admin.spec.ts`, `lib/staff/__tests__/permissions.unit.spec.ts`, panel `faq-card.spec.tsx`, `reviews-page.spec.tsx`.
