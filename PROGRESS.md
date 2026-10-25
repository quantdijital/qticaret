# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F2 — Platform çekirdek modülleri + güvenlik tabanı** (devam; S1–S9 /13 bitti). Dal `f2-platform-core`, F1 merge edilmediği için `f1-tr-localization` üzerinden açıldı; henüz push edilmedi. F1 dalı push edildi; PR açılmadı.

## Son oturum özeti
**2026-10-24 gece oturumu (S3, S5; S8 başladı).** Kullanıcı döndü; dört karar verdi: bağımlılıklar onaylandı (ioredis 5.11.1, fast-xml-parser 5.11.2, yauzl 3.4.0, kendi görsel başlık okuyucumuz), ADR-0011..0014 kabul edildi, otonom devam, eski "Gözden geçir" maddeleri olduğu gibi kabul. Commit `54abc2a`.

2026-10-25 (F2 S9): F2.3a. `platform-settings` modülü, özellik bayrakları (adr/0012). Plan `/Users/deniz/.claude/plans/f2-s9-platform-settings.md`.
- **Bölümler:**
  - `store`: iletişim e-postası ve TR telefonu (E.164), saat dilimi, birimler.
  - `seo`: canonical host, URL stili (prefixed/flat), başlık ve açıklama şablonları (`lib/seo` token kontrolü), robots.txt (direktif allowlist'i), AI tarayıcı ön ayarı.
  - Şemalar strict; patch kısmi gelir, mevcut değerin üzerine bir seviye derin birleştirilir. Okumada bilinmeyen alan düşürülür, geçmeyen alan tek başına varsayılana döner.
- **Bayraklar:**
  - Kayıt defteri kodda. İş bayrağı yok; test bayrakları yalnızca `NODE_ENV=test`'te var.
  - Platform bayrağı admin'den değişmez (403) ve tenant override'ını okumaz.
  - `requireFeature` kapalıyken Express'in bilinmeyen route sayfasını bayt bayt üretir (testle karşılaştırılıyor). `assertFeatureEnabledStep` workflow'u ilk adımda durdurur.
- **Cache:** Süreç içi değer + Redis'te her yazımda yeni rastgele işaret. Kontrol en çok saniyede bir; 30 sn üst yaş; eşzamanlı yükleme tek uçuş; invalidate öncesi başlayan yükleme atılır; başarısız işaret yazımı yeniden denenir. Redis istemcisi tembel açılır. Ortak parçalar `lib/redis` ve `lib/cache`'e taşındı; rate limit de kullanıyor.
- **API:**
  - `GET/POST /admin/platform-settings/:section`, `GET /admin/features`, `POST /admin/features/:key`; workflow ve compensation'lı.
  - Mutasyonlar yalnızca admin kullanıcıları içindir (API key 403, F12'ye kadar).
  - Denetim kaydı alan bazında önce/sonra yazar; iletişim alanları maskeli.
- **İnceleme:** Güvenlik incelemesi yapıldı, yüksek bulgu yok. 3 orta bulgu düzeltildi: cache'in sınırsız eskimesi, yeniden yükleme fırtınası, platform bayrağında override'ın okunması. Düşüklerin çoğu da düzeltildi (`%73tore` doğrulama atlatması, gate hata yolu, 404 sayfa farkları, kontrol karakterleri).
- **KK:** "Feature flag kapalıyken ilgili endpoint/akış devreye girmiyor (testli)" karşılandı.

2026-10-25 (F2 S8): F2.5. `audit-log` modülü, mutasyon ve hassas okuma kaydı (adr/0011).
- **Modül:** `audit_entry`, yalnızca ekleme. Güncelleme/silme metotları parametresiz override ile kapalı; çağrı derlenmez, tiple aşılırsa hata fırlatır. Satır boyutu sınırlı (metin 256, UA 512, `changes` 16 KB üstü alan adlarına iner).
- **Mutasyon:** `/admin/*` POST/PUT/PATCH/DELETE yanıt bittikten sonra yazılır. Kayıt defteri (varyant fiyatı, ürün üzerinden fiyat, varyant batch, price list fiyat batch) önce/sonra fiyatlarını `variants.prices` ile okur. Diğer route'larda yalnızca alan adları yazılır.
- **Okuma:** Müşteri detayı/adresleri/fatura profili, sipariş detayı ve `GET /admin/audit-log` yanıttan önce kaydedilir; yazılamazsa 503.
- **İnceleme:** Güvenlik incelemesi yapıldı; 2 yüksek, 5 orta bulgu düzeltildi (ayrı commit; ayrıntı adr/0011 eki). Yüksekler: bağlantıyı koparan istemcinin mutasyonu kaydedilmiyordu (yazım `res.end`'e bağlandı); liste ve alt route'lardan kişisel veri ve `fields=*billing_profile` ile şifreli vergi kimliği kayıtsız çekilebiliyordu. Açık kalanlar adr/0011 ekinde.
- **Bulunan hata:** `routePath` küçük harfe çevirdiği için ID'ler (`prod_01JABC`) bozuluyordu. Birim testi yakaladı; denetim katmanı `routePathKeepingCase` kullanıyor.
- **KK:** "Ürün fiyatı değişikliği audit log'da görünüyor; müşteri TCKN görüntüleme okuma kaydı düşüyor" karşılandı (HTTP testi: fiyat 1000 → 1250 önce/sonra; fatura profili görüntüleme `sensitive_read`; secret API key actor'ı `api-key`).

2026-10-24 (gece, F2 S5): F2.9b. Upload validator, CSV kaçışlama, güvenli XML, zip sınırları.
- **Upload:** Tür baytlardan okunuyor (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X, AVIF ispe); başlık baytlarının ve boyut alanlarının tutarlı olması şart. Kabul edilen dosya `<slug>.<gerçek uzantı>` adıyla ve gerçek MIME ile saklanıyor; istek başına en fazla 20 dosya; multer'ın latin1 okuduğu UTF-8 dosya adı onarılıyor.
- **CSV / XML / zip:** Türkçe Excel `;` ile böldüğü için hücre içi formül başlangıçları da kaçışlanıyor. XML'de derinlik sınırı 64 ve değerler metin; `__proto__`/`constructor` etiketleri reddediliyor. Zip'te aynı ad (büyük/küçük harf, Unicode biçimi dahil) ve kontrol karakteri reddediliyor.
- **İnceleme:** Güvenlik incelemesi yapıldı. Yüksek bulgu: PNG başlıklı ama `.html` adlı dosya `/static`'ten HTML olarak servis edilirdi (stored XSS; dev sunucuda `/static`'in bizim header'larımızı almadığı doğrulandı). Bu, 1 orta ve 11 düşük bulgu düzeltildi.
- **KK:** "SVG ve sahte MIME yükleme reddediliyor" karşılandı (S4 kısmıyla birlikte satır kapandı).

2026-10-24 (gece, F2 S3): F2.10b. Rate limit, güvenlik header'ları, CSRF, istek sınırları.
- **Rate limit:** Redis'te atomik sabit pencere (EVALSHA); Redis düşerse 30 sn bellek store'u. Kimlik `PII_HASH_KEY` HMAC'i, IPv6 /64 kovası, anahtarlar DB sunucusu + adıyla ad alanında.
- **Yol eşleme:** Kurallar Express'in rotaladığı yola göre seçiliyor (`routePath`). İnceleme `/auth/customer/emailpass/` ile login limitinin, `/ADMIN/...` ile admin CSRF'nin atlandığını buldu; ikisi de testle kapatıldı.
- **CSRF:** `Origin: null` reddediliyor; alan dışı cookie'li mutasyon üç CORS listesinden birini istiyor. Upload boyut kapısı içerik türüne bağlı.
- **İnceleme:** Güvenlik incelemesi yapıldı; 2 yüksek, 4 orta ve 7 düşük bulgu düzeltildi ya da docs/04'e (güven modeli, F16/F18 notları) yazıldı.
- **KK:** "Login ucunda limit aşımı 429; header'lar tüm yanıtlarda" karşılandı. Medusa'nın önce yazdığı yanıtlar F16'da proxy'de.

**2026-10-24 akşamı otonom oturum (S2, S4, S7, S6).** Kullanıcı dışarıdayken açık yetkiyle yürütüldü: plan onayı beklenmedi, belirsizlikte muhafazakâr seçenek uygulanıp aşağıdaki "Gözden geçir" maddesine yazıldı. Planlar `/Users/deniz/.claude/plans/` altında (`f2-s4-safe-fetch.md`, `f2-s6-http-client-health.md`; S2 ve S7 bu dosyanın görev ayrıntılarında). Her görev bağımsız kod ve/veya güvenlik incelemesinden geçti; bulgular düzeltildi. Son durum: 647 birim, 74 HTTP, 47 modül testi; lint ve typecheck temiz. Push yapılmadı.

2026-10-24 (akşam, F2 S6): F2.1 + F2.6. Sağlayıcı HTTP istemcisi ve `/admin/integrations/health`. Plan `/Users/deniz/.claude/plans/f2-s6-http-client-health.md`.
- **`lib/clients`:**
  - Timeout; yeni bağımlılık yok.
  - Yeniden deneme: idempotent isteklerde tam jitter'lı geri çekilme.
  - POST yalnızca gönderilmediği kesinse tekrarlanır (bağlantı reddi, DNS, TLS).
  - Sonucu belirsiz hata (gönderildikten sonra timeout, 500/502/504) `outcome_unknown` döner ve denenmez; ödemede çift tahsilat olmaz.
  - `Retry-After` jitter'la uygulanır; `ProviderError.retryAfterMs` üzerinden taşınır ve bizim yanıtımızda 300 sn ile sınırlanır.
  - Devre kesici izin nesneleriyle çalışır; sağlayıcıya ulaşmayan deneme yarı açık durumu kilitlemez.
  - Path segmentleri tek tek kodlanır, nokta segmenti ve sorgu reddedilir. Header değerleri alıntılanmadan doğrulanır.
  - Log satırı sabit alanlıdır; `hidePaths` ve `logPath` desteklenir. Yanıt boyutu 5 MB ile sınırlı.
- **Health:** Kontroller paralel çalışır, her biri 5 sn ile sınırlı; sonuç 30 sn cache'lenir ve yalnızca durum ile neden kodu döner. İlk kontrol RESP üzerinden Redis (AUTH, PING; kütüphanesiz).
- **İnceleme:** Güvenlik incelemesi yapıldı. Yüksek bulgu, belirsiz sonuçların `retryable: true` işaretlenmesiydi (çift tahsilat riski). Bu ve 5 orta, 9 düşük bulgu düzeltildi.
- **KK:** "HTTP istemci logunda Authorization/API key görünmüyor" karşılandı. Test redaksiyonsuz bir casus logger'la yalnızca izinli alanların yazıldığını doğruluyor. Commit: `7a57ed3`.

2026-10-24 (akşam, F2 S7): F2.11. `lib/seo` ve `url-registry` modülü.
- **`toSlug`:**
  - Türkçe transliterasyon. NFKD ile ligatür ve üst simge ayrıştırılır.
  - 80 karakter, kelime sınırında kesim.
  - Harf kalmazsa `""` döner: sayısal slug olmaz.
- **Şablon motoru:**
  - Türkçe tokenlar; varlık türü başına token kataloğu (`SEO_TEMPLATE_TOKENS`).
  - Bilinmeyen token kaydederken reddedilir.
  - Boş token ayırıcısıyla birlikte düşer; güçlü ayırıcı kalır. Noktalama artıkları doğrusal sürede temizlenir.
- **Piksel genişliği:** Helvetica AFM metrikleri (Arial ve Liberation Sans aynı ölçüde), macOS Arial.ttf ile çapraz kontrol edildi. docs/14 karakter hedefleri de eklendi.
- **`url-registry`:**
  - `(locale, path)` unique.
  - `claimPath` path'i kaydın aktif path'i yapar ve eski aktif path'i rezerve eder. `unclaimPath` workflow compensation içindir. Ayrıca `releasePath`, `releasePathsOf` ve `freePath`.
- **Doğrulanan (Medusa 2.21.2):**
  - Servis içindeki `create` INSERT'i transaction commit edilirken flush ediliyor. Metot içindeki try/catch yarışı yakalamıyordu; 10 eşzamanlı claim testi bunu gösterdi.
  - Düzeltme: transaction iç metotta kapanıyor, hata dış metotta `seo.path_taken`'a çevriliyor. Medusa'nın duplicate metni `lib/errors` `uniqueViolationKeys`'te tek yerde okunuyor.
- **İnceleme:** Kod incelemesi yapıldı; 2 yüksek, 4 orta ve 12 düşük bulgu düzeltildi.
- **KK:** "Slug üretici transliterasyon tablosunu geçiyor; aynı path ikinci varlığa verilemiyor" karşılandı. Commit: `c3d1c80`.

2026-10-24 (akşam, F2 S4): F2.9a. `safe-fetch` (SSRF) ve timing-safe karşılaştırma. Aynı otonom oturum; plan `/Users/deniz/.claude/plans/f2-s4-safe-fetch.md`.
- **`lib/security/safe-fetch`:**
  - Yalnızca http/https; URL'de kimlik bilgisi yok; port allowlist 80/443.
  - Adres DNS'ten sonra kontrol edilir. IPv4'te IANA özel aralıkları; IPv6'da yalnızca `2000::/3` ve onun içindeki özel aralıklar hariç. Tek bir yasaklı DNS yanıtı isteği reddettirir.
  - Bağlantı `lookup` ile doğrulanan IP'ye sabitlenir (rebinding).
  - DNS c-ares ile yapılır ve iptal edilebilir; getaddrinfo libuv thread havuzunu bloke ederdi.
  - Yönlendirme modları `same-origin` (varsayılan), `follow` ve `error`. https→http inişi ve başka origin'e giden 307/308 gövdesi reddedilir.
  - Hatalar yalnızca bir neden kodu taşır, URL taşımaz.
- **`safeEqual`:** SHA-256 özetlerini sabit zamanda karşılaştırır; boş beklenen değer eşleşmez.
- **Doğrulanan (Node 24):**
  - `http.request` özel `lookup`'ı `all: true` ile çağırıyor.
  - WHATWG URL sayısal host biçimlerini normalize ediyor.
  - `net.BlockList` IPv4'ü IPv4-mapped biçimde karşılaştırıyor; `::ffff:0:0/96` ana listeye konursa her IPv4 adresi reddediliyor. Adres tablosu testi bunu yakaladı, kural ayrı listeye alındı.
- **İnceleme:** Güvenlik incelemesi yapıldı; kritik ya da yüksek bulgu yok. Düzeltilenler:
  - başka origin'e secret header taşınması
  - DNS'in thread havuzunu tüketmesi
  - eksik IPv6 aralıkları
  - NaN limitlerin sınırı kaldırması
  - `invalid_url` hatasının `cause`'unda URL'nin kalması
  - public API'de güvenliği kapatan test kancası
  - HEAD/204/304 yanıtları
- **Testler:** 118 birim testi, yerel HTTP ve TLS sunucularıyla; HTTPS'te SNI ve sabitleme testi `openssl` gerektiriyor, CI imajında var. Commit: `4e504f7`.
- **KK:** "safe-fetch iç IP'ye ve DNS rebinding'e giden isteği reddediyor" kısmı karşılandı; aynı satırdaki SVG ve MIME kısmı S5'te.

2026-10-24 (akşam, F2 S2): F2.10a. Pino logger, redaksiyon, istek ID'si, hata yanıtı sanitizasyonu. Kullanıcı dışarıdayken, açık yetkiyle plan onayı beklemeden yürütüldü (kapsam S2 → S4 → S7 → S6; belirsizlikte muhafazakâr seçenek + not).
- **`lib/logging`:**
  - Tek logger: pino 10.4.0, stdout'a JSON. `request_id` AsyncLocalStorage'dan geliyor.
  - `MedusaPinoLogger`, `defineConfig({ logger })` ile bağlandı; çekirdek, modüller ve script'ler aynı logger'ı kullanıyor (kök container testi var).
  - Redaksiyon serileştirmeden önce uygulanıyor, satır her zaman geçerli JSON:
    - anahtar kuralları her derinlikte, `cause` dahil
    - metin desenleri her string değerde ve mesajda
    - SQL öneki düz nesne hatalarda ve stack'te de siliniyor
  - Desenler doğrusal; 8 KB üstü metin kesiliyor. Ölçüm: eski regex 64 KB'ta 2,3 sn sürüyordu.
- **`api/http`:**
  - İstek ID'si doğrulanıyor, `X-Request-Id` yazılıyor.
  - `platformErrorHandler` bağlandı:
    - 5xx genel gövde
    - DB 4xx mesajları `/admin` dışında i18n anahtarı
    - body-parser hataları sabit gövde; gövde loga girmiyor
    - handler'ın kendi hatası genel 500 döner
  - `rejectRequest`: tr-address ve sensitive-fields doğrulamaları da `request_id` döndürüyor.
- **Doğrulanan (2.21.2):**
  - Logger modül container'larına paylaşılan container'dan geçiyor.
  - Medusa'nın ilk middleware'i `x-request-id`'yi doğrulamadan kopyalıyor.
  - `authenticate` 401'i doğrudan yazıyor; bu yanıt bizim middleware'imizden ve handler'dan geçmiyor.
  - Dev dışında morgan erişim logu logger'ı atlıyor.
  - `dbErrorMapper` export edilmiyor; gerçek metinleri entegrasyon testi modül servisi üzerinden üretiyor.
  - Store'da e-posta çakışmasını çekirdek önceden yakalıyor ("already has an account").
  - Mevcut log kanıtı testleri pino'nun fd yazıcısıyla boşa geçerdi. Logger hedefi `process.stdout`; `captureOutput` yoklama satırı görmezse hata veriyor.
- **İnceleme:** Kod ve güvenlik incelemeleri yapıldı.
  - Düzeltilen bulgular:
    - karesel regex'ler (ReDoS)
    - satır seviyesindeki maskelemenin JSON'u bozması ve kaçış dizisinden sonra değer kaçırması
    - SQL temizliğinin düz nesne hatalarda ve mesajda atlanması
    - body-parser hatasının ham gövdesi
    - anahtar listesindeki boşluklar (`address_1`, `gsmNumber`, `hashKey`, isimler)
    - Express'in ham stack basan fallback'i
    - `$&` replacement
    - ZodError dalının geniş olması
  - "Body-parser hatası 500'e düşer" iddiası kaynakla çelişiyordu; 400 döndüğü entegrasyon testiyle doğrulandı.
- **Testler:** 373 birim (+187), 72 HTTP (+10), 24 modül. Lint ve typecheck temiz. Commit'ler: `9e235db`, `a9354e5`, `1fb52dc`, `fa7c1e1`, `48d5180`.

2026-10-24 (gece): F2 planlandı (`/faz-baslat F2`).
- Medusa 2.21.2 API'leri üç araştırma ajanıyla doğrulandı (Context7 + v2.21.2 kaynağı): HTTP katmanı, modül/link/admin, asenkron iş/dosya/para. Planı değiştiren bulgular:
  - **HTTP katmanı:** Yerleşik rate limit, güvenlik header'ı ve `limit` üst sınırı yok. Varsayılan error handler unique/FK ihlalinde kolon ve değeri yanıta yazıyor. `/admin/uploads` multer'ı sınırsız ve bellek içi çalışıyor. `x-request-id` doğrulanmadan kabul ediliyor.
  - **Logger:** `defineConfig({ logger })` ile değiştirilebiliyor; arayüz yalnızca string mesaj alıyor.
  - **Event'ler:** Actor bilgisi taşımıyor. Fiyat değişimi için güvenilir workflow event'i yok, bu yüzden denetim kaydı HTTP sınırında tutulacak.
  - **Store API:** Bağlı veri `allowFields` middleware'iyle açılıyor (2.21.0+).
  - **Handle:** `toHandle` Türkçe karakterleri ASCII'ye çevirmiyor (`şef-bıçağı`).
  - **Background step:** Gövdesi `run()`'ı çağıran süreçte (server) koşuyor. In-memory engine restart'ta zamanlayıcıları kaybediyor. `file-local` imzasız ve herkese açık.
- ADR taslakları yazıldı (hepsi "Önerildi"): 0010 para/yuvarlama, 0011 denetim kaydı, 0012 ayarlar/bayraklar, 0013 ürün özellikleri, 0014 asenkron işler. ADR-0004'e CSRF için doğrulanan gerçekler eklendi.
- docs/12'ye iki kalem eklendi: denetim kaydı saklama süresi ve kuruş yuvarlama kuralı. docs/03'te F2.11 `url-registry` modül olarak netleştirildi.

Önceki oturumlar:
- **F2 S1 (2026-10-24 gece):** `lib/errors` + `lib/money` (F2.2 + F2.7), ADR-0010 kabul. 186 birim test. Commit'ler `c665bcb`, `4faf669`, `449ead7`.
- **F1 S1–S8 (2026-10-24 gece):** tenant bootstrap, demo seed, `tr-address`, admin i18n, `billing-profile`, auth cookie/session. ADR 0004, 0007, 0008, 0009 kabul edildi. Testler: 108 birim, 24 modül, 62 HTTP.
- **Daha önce:** F1 planlaması ve F0.2–F0.8 (2026-10-24), F0.1 monorepo (2026-10-24 sabahı), SEO ve güvenlik dokümanları (2026-10-22).

## Sıradaki görev
1. **Kullanıcı:**
   - `f1-tr-localization` için PR açmak (dal push edildi; CI'da modül testleri ilk kez çalışacak). F1 merge edilince `f2-platform-core` `main`'e rebase edilir.
   - Yerel dev DB'deki doğrulama verisini isterse silmek: "Deneme Müşteri" ve demo seed. Ortam `pnpm db:down -v` ile sıfırlanabilir.
2. **Kalan F2 görevleri (kullanıcı: "F2'yi tamamlayalım"):** S9 → S10 → S11 → S12 → S13. Canlı turlar F2 bitince (proje haritası `docs/16` hazır).
3. Otonom oturumun "Gözden geçir" maddesine bak (Açık sorular).
4. **Yerel dev DB:** `url_entry` migrate edildi; `audit_entry` (S8) henüz edilmedi. Yeni modüllerden sonra `pnpm --filter backend medusa db:migrate` (onay ister); testler kendi DB'lerinde migrate ediyor.

### F2 görev planı (oturum büyüklüğünde, önerilen sıra)
| # | Görev | Kapsam | Bağımlılık | ADR |
|---|---|---|---|---|
| S1 ✅ | F2.2 + F2.7 | `lib/errors` ve `lib/money`. Birim testleri | — | 0010 ✅ |
| S2 ✅ | F2.10a | Pino logger, redaksiyon, istek ID'si, hata yanıtı sanitizasyonu | S1 | — |
| S3 ✅ | F2.10b | Güvenlik header'ları, Redis rate limit, CSRF, sayfalama sınırı, upload boyut kapısı. KK: login 429, header'lar | S2 | 0004 eki |
| S4 ✅ | F2.9a | `safe-fetch` (SSRF) + timing-safe yardımcıları. KK: iç IP / rebinding reddi | S1 | — |
| S5 ✅ | F2.9b | Upload validator + `/admin/uploads` kapısı, CSV kaçışlama, güvenli XML, zip sınırları. KK: SVG / sahte MIME reddi | S3, S4 | — |
| S6 ✅ | F2.1 + F2.6 | HTTP istemcisi + `/admin/integrations/health` deseni. KK: logda Authorization yok | S2, S4 | — |
| S7 ✅ | F2.11 | `lib/seo` + `url-registry` modülü. KK: slug tablosu, path tekilliği | S1 | — |
| S8 ✅ | F2.5 | `audit-log` modülü, mutasyon ve okuma kaydı. KK: fiyat değişimi, TCKN okuma | S3 | 0011 |
| S9 ✅ | F2.3a | `platform-settings` backend: bölümler, bayraklar, cache, uygulama noktaları. KK: kapalı bayrak | S7, S8 | 0012 |
| S10 | F2.3b | Admin: Ayarlar > Özellikler ve Ayarlar > SEO sayfaları | S9 | — |
| S11 | F2.4a | `product-attributes` backend: modül, link'ler, workflow'lar, admin/store API. KK: Store API'de değer | S8 | 0013 |
| S12 | F2.4b | Admin: ürün widget'ı + şablon yönetim sayfası | S11 | — |
| S13 | F2.8 | `async-job` modülü, file-s3, "İşler" sayfası; ilk tip denetim kaydı CSV dışa aktarma | S5, S8 | 0014 |

Görev ayrıntıları:
- **S1:** Tamamlandı (bkz. "Son oturum özeti" ve ADR-0010 "Uygulama").
- **S2:** Tamamlandı (bkz. "Son oturum özeti"). İlk plan:
  - errorHandler önce `lib/errors` `toHttpError`'ı uygular. Bizim tipimiz değilse sanitize edilmiş Medusa varsayılanına düşer; varsa `Retry-After` header'ını yazar.
  - Medusa logger'ı `defineConfig({ logger })` ile pino adaptörüne geçer. Modül container'larına da geçtiği doğrulanır.
  - `lib/logging`: `{ event, ... }` alanlı yapılandırılmış logger, docs/10 ve adr/0009 redaksiyon listesi (+ `cookie`, `set-cookie`), AsyncLocalStorage istek bağlamı.
  - İstek ID'si: gelen `x-request-id` biçim kontrolünden geçer; yoksa veya geçersizse UUID üretilir. Yanıta `X-Request-Id` yazılır.
  - errorHandler varsayılanı sarar:
    - DB kaynaklı mesajlar (unique/FK/not-null) genel mesajla değiştirilir.
    - 5xx yanıtı genel mesaj döner.
    - Yanıtta `request_id` bulunur.
    - Test: unique ihlali yanıtında değer görünmez.
  - Script logları (seed, bootstrap, import) yapılandırılmış loga geçer (F1'den devreden).
- **S3:**
  - **Header'lar:** Global `"/*"` middleware'i şunları ekler: HSTS (yerel değilse), `nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy. `X-Powered-By` kaldırılır. Admin `/app` statiklerinin bu middleware'den geçip geçmediği doğrulanır; geçmiyorsa admin CSP F16'da reverse proxy'de uygulanır.
  - **Rate limit:**
    - Medusa Redis istemcisini dışarı açmadığı için kendi ioredis bağlantımız kullanılır. `REDIS_URL` yoksa (dev/test) bellek içi store.
    - Profiller: login (`/auth/{customer,user}/emailpass`), kayıt, şifre sıfırlama, token yenileme, varsayılan store/admin.
    - Checkout, kupon, taksit, SMS ve webhook profilleri tanımlanır; uçları ilgili fazda bağlanır.
    - Anahtar: IP + hash'lenmiş kimlik. Yanıt: 429 + `Retry-After`.
    - Limit, admin auth ve publishable key kontrolünden sonra çalışır.
  - **CSRF:** ADR-0004 F2.10 ekindeki kurallar.
  - **Sayfalama:** `/store/*`'da `limit > 100` 400 döner. Admin dashboard'un kullandığı limitler Playwright ile ölçülür, ardından admin'e de uygulanır.
  - **Upload:** `/admin/uploads` için multer öncesi Content-Length üst sınırı.
  - **CORS:** Allowlist dışı origin için regresyon testi.
- **S4:** Tamamlandı (bkz. "Son oturum özeti"). İlk plan:
  - `node:http(s)` istekleri özel bir `lookup` ile yapılır. DNS çözümünden sonra adres `net.BlockList` ile kontrol edilir:
    - özel, loopback, link-local/metadata, CGNAT, multicast, ayrılmış aralıklar
    - IPv6 ULA, IPv4-mapped, NAT64
  - Bağlantı doğrulanan IP'ye gider, bu yüzden DNS rebinding işe yaramaz.
  - Yalnızca http/https ve port allowlist. Yönlendirmeler elle izlenir ve her adımda yeniden doğrulanır (en çok 5). Toplam süre ve yanıt boyutu sınırlıdır.
  - Yeni bağımlılık yok.
- **S5:**
  - **Upload validator:**
    - Tür magic bytes ile belirlenir (jpeg/png/webp/avif). SVG ve tanınmayan türler reddedilir.
    - Boyut ve piksel sınırı uygulanır.
    - Validator `/admin/uploads` POST'unda multer'dan sonra çalışır (aynı matcher + `methods`).
    - Yeniden kodlama ve EXIF temizleme F3.3'te.
  - **CSV:** `= + - @ \t \r` ile başlayan hücreler kaçışlanır; RFC 4180 tırnaklama.
  - **XML:** DOCTYPE içeren girdi reddedilir, entity işleme kapalı, boyut sınırı var.
  - **Zip:** Giriş sayısı, gerçek açılmış toplam boyut ve sıkıştırma oranı sınırlanır; path traversal ve symlink reddedilir. xlsx de zip olduğundan F3.9'da önce bu kontrolden geçer.
- **S6:** Tamamlandı (bkz. "Son oturum özeti"). İlk plan:
  - **İstemci:** Node `fetch`. Özellikleri:
    - istek başına timeout
    - üstel geri çekilme + jitter (yalnız idempotent ya da açıkça işaretli isteklerde; 429'da `Retry-After`'a uyulur)
    - süreç başına devre kesici
    - `x-request-id` korelasyonu, header/gövde redaksiyonu
    - Zod ile yanıt parse etme, `ProviderError` / `RetryableError`
    - Medusa'nın `retryExecution`'ında üstel geri çekilme yok, kullanılmaz.
    - Kullanıcı kontrollü URL'lerde transport olarak `safe-fetch` kullanılır.
    - Testler `node:http` sahte sunucusuyla yazılır.
  - **Sağlık:**
    - Arayüz: `IntegrationHealthCheck { id, kind, check(signal) }`.
    - Provider'lar izole olduğundan kontroller provider sınıfından ayrı bir kayıt defterinde tutulur; aynı istemci ve env yapılandırmasını kullanır.
    - `GET /admin/integrations/health`: kontroller paralel ve zaman sınırlı çalışır, sonuç 30 sn cache'lenir. Yanıtta secret veya ham hata olmaz.
    - İlk kontrol Redis'tir; dosya deposu S13'te eklenir.
    - Core `/health` her zaman 200 döner; readiness ucu F16'da.
- **S7:** Tamamlandı (bkz. "Son oturum özeti"). İlk plan:
  - **Slug:** docs/13 §2.1 kuralları. F3.1'de ürün handle'ı bu üreticiden verilir.
  - **Şablon motoru:** Tokenlar desteklenir. Bilinmeyen token kaydetme anında hata verir; boş token kalan ayırıcıları temizler.
  - **Piksel genişliği:** Tablo, Arial ile aynı metriklere sahip Liberation Sans'tan (OFL) üretilir. Sınırlar doc 14 ve `/seo-*` skill'leriyle doğrulanır.
  - **`url-registry` modülü:** `(locale, path)` unique; durum `active` | `reserved`; `claim` / `release` / `resolve`.
- **S8:** ADR-0011'e göre:
  - mutasyon middleware'i ve kaynak kayıt defteri (ilk giriş: varyant fiyatları)
  - okuma middleware'i: fatura profili, müşteri detayı ve adresleri, sipariş detayı
  - `GET /admin/audit-log`, `recordAuditEntryStep`
  - secret API key actor'ı testi
- **S9:** ADR-0012'ye göre:
  - `store` ve `seo` bölümleri. SEO bölümü canonical host, URL deseni, başlık şablonları (S7 motoruyla doğrulanır) ve robots şablonunu içerir.
  - Bayrak kayıt defteri, Redis sürüm sayaçlı cache, `requireFeature`, `assertFeatureEnabledStep`.
  - Admin API ve denetim kaydı girişleri.
  - KK testi bir test bayrağıyla yapılır.
- **S10:**
  - Sayfalar: `src/admin/routes/settings/features` ve `settings/seo`; SEO sayfasında şablon önizlemesi var.
  - Admin'e JS SDK (`sdk.client.fetch`) eklenir.
  - Kurallar: `@medusajs/ui`, i18n, yükleniyor/boş/hata durumları, Playwright smoke.
- **S11:** ADR-0013'e göre:
  - modül ve link'ler
  - şablon ve değer workflow'ları (ürün başına kilitli upsert)
  - Store'da `allowFields`; matcher hem `/store/products` hem `/store/products/:id`
  - facet indeksleri, denetim kaydı girişi
- **S12:** `product.details` widget'ı (şablon seçimi + dinamik form) ve `settings/attribute-templates` sayfası.
- **S13:** ADR-0014'e göre:
  - modül, iş tipi kayıt defteri, enqueue workflow'u ve subscriber
  - heartbeat, süpürücü ve saklama job'ları
  - file-s3 (SeaweedFS) bağlantısı ve env şeması, sonuç indirme ucu, "İşler" sayfası

Paralel zincirler:
- S1 → S2 → S3 → S8 → S9 → S10
- S8 → S11 → S12
- S1 → S4 → S5 ve S6
- S1 → S7 → S9
- S13 en son (S5 ve S8'den sonra)

Önerilen sıra, güvenlik tabanını (S1–S3) yeni route'lardan önce kurar (docs/04 "Route eklenmeden önce hazır").

## Açık sorular / bloklayıcılar
- [x] **Gözden geçir: otonom oturumda S4, S7 ve S6 için verilen muhafazakâr kararlar:** Kullanıcı 2026-10-24 akşamı olduğu gibi kabul etti.
  - **S4:**
    - `safeFetch` varsayılan yönlendirme modu `same-origin`. Başka origin'e gitmek için `follow` açıkça istenmeli; webhook'larda `error`.
    - DNS c-ares ile yapılıyor; /etc/hosts okunmuyor.
  - **S7 piksel tablosu ve SERP sınırları:**
    - Tablo, Liberation Sans dosyası yerine Helvetica AFM değerlerinden kuruldu: Liberation yerelde yoktu, ağdan font indirilmedi. Değerler aynı.
    - SERP sınırları (başlık 600 px / 20 px, açıklama 920 px / 14 px) tahmindir; yalnızca uyarı üretmeli.
  - **S7 slug ve `url-registry`:**
    - `toSlug` sayısal sonuçta `""` dönüyor; F3.1 başka bir kaynak metin seçmeli.
    - Registry yalnızca iki harfli locale kabul ediyor (F19'a kadar). Path'in her segmenti geçerli slug olmalı.
    - `seo.path_taken` 400 dönüyor; 409 da düşünülebilir.
  - **S7, düz URL deseni:** Düz desen (`/{slug}`) için sistem yolları (`/arama`, `/sepet`, `/blog`) henüz rezerve değil; F3'te ele alınmalı.
  - **S6 istemci kapsamı:**
    - PUT ve DELETE varsayılan olarak yeniden deneniyor (REST semantiğine güven).
    - İstemci yalnızca JSON konuşuyor. PayTR form-encoded, e-fatura entegratörleri SOAP/XML olabilir; ilgili fazda genişletilir.
  - **S6 health:**
    - Kontroller provider'ın kendi `healthCheck()`'i yerine ayrı bir kayıt defterinde tutuluyor (modül izolasyonu; docs/03 F2.6 metninden sapma).
    - Redis kontrolü elle yazılmış bir RESP istemcisiyle yapılıyor; ioredis gelince değiştirilebilir.
  - **S6, HTTPS testi:** `openssl` gerektiriyor; CI imajında var.
  - **S7 migration:** `url-registry` migration'ı `db:generate` ile üretildi. `/yeni-modul` komutu "üretmeden önce sor" diyor; kullanıcının "izin isteme" talimatıyla soruldu sayıldı. DB'ye dokunan `db:migrate` çalıştırılmadı.
  - **Yeni i18n anahtarları:** `seo.template_invalid`, `seo.path_taken`, `seo.path_not_owned`, `seo.path_invalid`, `seo.locale_invalid`, `seo.entity_type_invalid`, `seo.entity_id_invalid`.
- [x] **Gözden geçir: F2 S2 muhafazakâr kararları:** Kullanıcı 2026-10-24 akşamı olduğu gibi kabul etti.
  - Loglarda ad, soyad, unvan ve posta kodu anahtarları da maskeleniyor; docs/04 yalnızca TCKN, telefon ve adresi sayıyor.
  - `body` anahtarı tamamen redakte ediliyor. Sağlayıcı yanıt gövdeleri loga girmiyor; S6 istemcisi hata ayıklama için `providerCode` gibi alanları ayrıca yazmalı.
  - Kodun fırlattığı ham ZodError 400 ve genel `errors.invalid_data` dönüyor. Medusa'nın davranışı issue metinlerini göndermekti.
  - Yeni i18n anahtarları: `errors.duplicate`, `errors.invalid_reference`, `errors.request_too_large`, `errors.invalid_request`. F18'de kataloğa girecek.
- [ ] **Renovate GitHub App kurulumu (kullanıcı):** github.com/apps/renovate → `denizcanmaya/eticaret-platform`. Kurulunca onboarding PR'ı kontrol edilecek.
- [ ] **Takip edilen açıklar** (adr/0001 "Bilinen açıklar"):
  - zod → 4.6.6: 2026-10-25'ten itibaren uygun; doğrudan bağımlılık + admin-sdk override.
  - body-parser → 1.20.9 ve multer → 2.5.0: 2026-11-05'ten itibaren uygun.
  - @graphql-tools/utils 10.x: kabul edilmiş risk (yalnızca build sırasında).
- [ ] Medusa 2.22.x yükseltmesi: en erken 2026-11-06 (2.22.1 için 14 gün); ayrı PR.
- [ ] **F2 kararları** (ilgili oturumda onaylanacak; ADR-0010 S1'de kabul edildi):
  - ADR-0011 (S8): denetim kaydı HTTP sınırında; okuma kaydı yazılamazsa istek reddedilir (fail closed).
  - ADR-0012 (S9): bayraklar kodda tanımlı, DB'de yalnızca farklar; kapalı bayrakta 404.
  - ADR-0013 (S11): tipli EAV satırları ve ürün ↔ şablon/değer link'leri.
  - ADR-0014 (S13): iş kaydı modülü, event → subscriber → workflow; file-s3 F3.3'ten öne çekilir.
- [ ] **F2 yeni bağımlılıkları** (her biri kendi oturumunda `pnpm add` onayıyla; exact sürüm, ≥14 gün):
  - `pino` (S2) ✅ 10.4.0
  - `ioredis` (S3; framework'ün opsiyonel peer aralığı ^5.4.1)
  - `fast-xml-parser` ve `yauzl` (S5)
  - Görsel boyutu için kendi başlık okuyucumuz ya da `image-size` (S5'te karar)
  - S4, S6 ve S7 yeni bağımlılık getirmez.
- [ ] **F2 S4/S6/S7'den devreden işler:**
  - **F3.1:** Ürün, kategori ve koleksiyon workflow'ları `claimPath` çağırmalı ve compensation'da `unclaimPath` kullanmalı. Silmede `releasePathsOf`, redirect kalkınca `freePath`. Slug `""` gelirse başka bir kaynak metin seçilmeli.
  - **Ödeme fazları (F5, F6):** `outcome_unknown` gelirse yeniden denemeden önce sağlayıcıda durum sorgusu (conversationId) zorunlu.
  - **F11.7 tenant webhook'ları:** `safeTransport` + `hidePaths` + `redirect: "error"`.
  - **F16:** NAT64 kendi önekiyle kullanılıyorsa önek `address-policy`'ye eklenmeli. Egress proxy gelirse `safe-fetch`'in adres sabitlemesi yeniden düşünülmeli (proxy kendi DNS'ini yapar).
- [ ] **F2 S2'den devreden işler:**
  - **Erişim logu (F16, OAuth fazı):** Dev dışında Medusa'nın morgan logu logger'ı atlayıp stdout'a JSON yazıyor. Satırda tam URL (sorgu dizesi dahil), `client_ip`, user agent ve referrer var. Riskli içerik: admin aramalarındaki `?q=` (telefon, e-posta) ve ileride OAuth `code`/`state`. Reverse proxy log politikasıyla ya da Medusa'nın logunu kapatıp kendi erişim logumuzla çözülecek.
  - **Bizim katmanımızdan önce biten yanıtlar:** `authenticate`'in 401'i ve CORS reddi `X-Request-Id` taşımıyor; morgan satırında ham `x-request-id` kalıyor (JSON escape'li). Body parser ve auth aşamasında yazılan loglarda request context yok.
  - **İstek ID'sine güven (F16):** İnternetten gelen geçerli biçimli ID'ler kabul ediliyor, bu da korelasyonun taklit edilebilmesi demek. Edge proxy geldiğinde yalnızca proxy'den gelen ID'ye güvenilmeli.
  - **NODE_ENV (F16):** Express, tanımsız NODE_ENV'i development sayıyor; bizim handler'ımız dışına düşen hatalarda stack HTML'de görünebilir. Üretim imajında NODE_ENV zorunlu olmalı (F1'den devreden maddeyle birlikte).
  - **test-utils logları:** DB kurulumu Medusa'nın varsayılan winston reporter'ıyla yazıyor; yalnızca testte.
- [ ] **F2 planlamasında çıkan, sonraki fazlara devreden işler:**
  - **Redis modülleri (F16):** Prod için Redis event bus, workflow engine, locking ve caching modülleri gerekli. Bunlar olmadan server/worker ayrımı, restart sonrası iş devamı ve tek instance'ta zamanlanmış iş garantisi yok (ADR-0014).
  - **trust proxy (F16):** Medusa `trust proxy = 1` ayarlıyor. Rate limit IP'si doğru olsun diye prod'da tam bir reverse proxy katmanı olmalı.
  - **Handle (F3.1):** Ürün, kategori ve koleksiyon handle'ları `lib/seo` slug üreticisinden verilir; Medusa'nın `toHandle`'ı Türkçe karakterleri ASCII'ye çevirmiyor.
  - **İçe aktarma (F3.9):** Medusa'nın ürün içe aktarması dosyayı presigned URL ile doğrudan depoya yükleyebiliyor. Bu yol `/admin/uploads` doğrulamasından geçmez; F3.9'da ele alınacak.
  - **Kısmi iade dağıtımı (F4.7, F6):** `allocateKurus` her çağrıda bağımsız yuvarlar. Ardışık kısmi iadelerde bir satırın iadesi o satırın payını aşabilir. Satır başına kalan tutarı tavan alan bir dağıtım ve docs/07 testi gerekir (ADR-0010 "Sonuçlar").
  - **S3/S5'ten devreden (F16, F18, S13):**
    - CI'a Redis servisi: `TEST_REDIS_URL` testleri (Lua script) CI'da atlanıyor.
    - F16 proxy: `/static`, `/app`, 401 ve preflight yanıtlarına güvenlik header'ları; `/static` için `sandbox` CSP; tek hop XFF şartı ya da `TRUSTED_PROXY_HOPS`.
    - F18: Medusa store preflight'ında publishable key istiyor (izinli origin de 400 alıyor). Tarayıcıdan doğrudan store çağrısı için çözülmeli. Sunucudan login proxy'leyen storefront için imzalı istemci-IP ADR'si.
    - S13: `presigned-urls` yolu için uzantı/MIME allowlist'i ve worker'da doğrulama; CSV dışa aktarımın ayırıcısı ve BOM'u.
    - Hesap kilidi ve IP'den bağımsız kimlik sınırı (docs/04 "artan gecikme + kilit"); admin `limit` üst sınırı ölçülünce.
    - Admin, çekirdek dashboard'un çevirmediği `errors.too_many_requests` gibi anahtarları ham gösteriyor.
  - **S9'dan devreden:**
    - `canonical_host` alan adı sahiplik doğrulaması (F16/F18).
    - JSON-LD ve meta çıktısında kaçışlama (docs/13, F18).
    - İyimser kilit (eşzamanlı iki admin kaydı; F12.4).
    - Store bölümü için admin sayfası (S10 kapsamı features + SEO).
    - Medusa modül kapanış kancası belgelenmediği için Redis istemcisi tembel açılıyor ama kapatılmıyor; bayrak okuyan bir `medusa exec` script'inin çıkışı izlenmeli.
  - **Storefront hata anahtarları (F18):** `errors.*`, `billing_profile.*`, `tr_address.*` gibi i18n anahtarları henüz bir çeviri kataloğunda değil. Storefront'la birlikte `packages/types`'a taşınır.
- [ ] **F1'den devreden işler:**
  - Kargo KDV oranı için `shipping_option` vergi kuralı, mali müşavir onayından sonra (docs/12).
  - Soft-delete edilmiş fatura profillerini kalıcı silme / KVKK imha işi (F13).
  - Locking modülünün Redis sağlayıcısına geçmesi ve üretim imajında `NODE_ENV=production` (F16).
  - Telefon E.164 normalizasyonu yalnızca Store API yolunda yapılıyor; workflow ile yazılan sepet adresi ham telefonu saklar (doğrulama iki yolda da var).
  - `tr-address` ve fatura profili Store API sözleşme tipleri `packages/types`'a (F18).
  - Tam vergi kimliğini gösterme: yetki (F12) ve okuma audit log'u (F2.5).
- [ ] Çok dilli içerik: Medusa Translation modülü feature flag arkasında, şimdilik kapalı. Ana içerik Türkçe; çok dil F19.
- [x] Medusa'da CSRF koruması yok → F2 S3'te Origin kontrolü + JSON gövde şartı (ADR-0004 F2.10 eki).
- [ ] Trivy imaj taraması: üretim Dockerfile'ı ile birlikte F16'da.
- [ ] GitHub Actions dakikaları: private repo, ücretsiz kota 2000 dk/ay; ilk ayda izlenecek.
- [ ] `adr/0003` hosting ve veri yerleşimi kararı (en geç F15 öncesi; KVKK danışmanı görüşü gerekli)
- [ ] Kod dışı gereksinimler takibi: `docs/12-kod-disi-gereksinimler.md` (avukat, mali müşavir, sağlayıcı anlaşmaları)
- [ ] `adr/0005` içerik önerileri: kural motoru + opsiyonel LLM (kabul bekliyor; LLM sağlayıcı seçimi F10.13 öncesi)
- [ ] Admin 2FA yöntemi ADR (F12.6 öncesi; Medusa'da yerleşik mi doğrulanacak)
- [ ] docs/15 açık doğrulamalar: ikas headless/API, Shopify B2B changelog, Google TR ücretsiz listeleme (tenant hesabında)

## Faz durumu
| Faz | Durum |
|---|---|
| F0 Repo & araçlar | ✅ |
| F1 Medusa çekirdek + TR lokalizasyon | ✅ |
| F2 Platform çekirdek modülleri | ⏳ |
| F3 Katalog, SEO motoru ve stok | ⬜ |
| F4 Fiyatlandırma ve promosyon | ⬜ |
| F5 Ödeme: iyzico | ⬜ |
| F6 Ödeme: PayTR + havale/EFT + kapıda ödeme + yönlendirici + ters ibraz | ⬜ |
| F7 Kargo, sipariş operasyonu, iade ve değişim | ⬜ |
| F8 E-fatura | ⬜ |
| F9 Bildirimler (e-posta/SMS) | ⬜ |
| F10 Müşteri hesabı, etkileşim, pazarlama ve SEO ölçümü | ⬜ |
| F11 Raporlama, muhasebe ve dış API | ⬜ |
| F12 Admin genişletmeleri | ⬜ |
| F13 Uyum & yasal özellikler | ⬜ |
| F14 Veri taşıma ve geçiş araçları | ⬜ |
| F15 Sertleştirme (güvenlik/dolandırıcılık/yük) | ⬜ |
| F16 Dağıtım & tenant işletimi | ⬜ |
| F17 Control plane | ⬜ |
| F18 Storefront & temalar (sonraki aşama) | ⬜ |
| F19 Genişleme: pazaryeri, B2B, yurt dışı, ajan ticareti (sonraki aşama) | ⬜ |

Durum: ⬜ başlamadı · ⏳ devam · ✅ bitti · ⛔ bloklu
