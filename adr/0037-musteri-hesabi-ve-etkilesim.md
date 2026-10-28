# ADR-0037: Müşteri hesabı, misafir sipariş erişimi ve etkileşim modülleri

- **Durum:** Önerildi (2026-10-28; kullanıcının "önerileni uygula" kuralıyla otonom kabul edilir, PROGRESS "Gözden geçir"de)
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
