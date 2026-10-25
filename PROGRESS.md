# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F3 — Katalog, SEO motoru ve stok: PLANLAMA** (kullanıcı kararı bekliyor; uygulama kodu yazılmadı). F2 bitti (S1–S13; KK'ların hepsi işaretli). Dal `f2-platform-core`, F1 merge edilmediği için `f1-tr-localization` üzerinden açıldı; henüz push edilmedi. F1 dalı push edildi; PR açılmadı.

## Son oturum özeti
**2026-10-24 gece oturumu (S3, S5; S8 başladı).** Kullanıcı döndü; dört karar verdi: bağımlılıklar onaylandı (ioredis 5.11.1, fast-xml-parser 5.11.2, yauzl 3.4.0, kendi görsel başlık okuyucumuz), ADR-0011..0014 kabul edildi, otonom devam, eski "Gözden geçir" maddeleri olduğu gibi kabul. Commit `54abc2a`.

2026-10-25 (F3 planlaması, kullanıcı dışarıdayken; `/faz-baslat`). Uygulama kodu yazılmadı.
- **Medusa 2.21.2 doğrulaması** (Context7 + v2.21.2 kaynağı, medusa-researcher ajanı): katalog alanları ve genişletme yolu, görseller, rezervasyon ve kilit, içe/dışa aktarma, olaylar, Store `seo` payload seçenekleri, admin bildirimleri. Bulgular ADR'lerin "Bağlam" bölümlerinde.
- **Kritik bulgu:** Locking modülü tanımlı değil; Medusa bellek içi sağlayıcıyla çalışıyor ve çok süreçte stok kilidi süreçler arası geçerli değil. Bu biliniyordu (F16'ya bırakılmıştı). F3'ün eşzamanlı checkout KK'sı buna bağlı olduğu için ADR-0020 öne çekmeyi öneriyor. Sağlayıcı `@medusajs/medusa` ile geliyor; yeni bağımlılık yok.
- **Önerilen ADR'ler, hepsi "Önerildi":**
  - 0015: SEO alanları ve Store `seo` payload
  - 0016: görsel işleme
  - 0017: yönlendirme motoru
  - 0018: xlsx
  - 0019: zengin metin
  - 0020: stok defteri, düşük stok, ön sipariş, kilit
- **F3 görev planı** aşağıda (T1–T16).

2026-10-25 (F2 sonrası, kullanıcı dışarıdayken): devreden işlerden onay gerektirmeyenler.
- Kilit alınamayan kayıt (aynı ürüne iki eşzamanlı kayıt, aynı iş tipine iki istek) artık 500 değil 503 + `Retry-After: 2` alıyor; tek satırlık bilgi logu yazılıyor, yığın izi ve kilit anahtarı yok. HTTP testli.
- `/admin/*` `limit` üst sınırı 1000. Dashboard'un dev'deki 593 isteğinde görülen en yüksek değer (seçim listeleri) bu.
- CI kalite işine Redis servisi eklendi (dev ile aynı sabit imaj); Lua sayaç testleri CI'da da çalışacak. Turbo `TEST_*` değişkenlerini geçiriyor.

2026-10-25 (F2 S13): F2.8. `async-job` modülü, iş tipleri, "İşler" sayfası (adr/0014). Plan `/Users/deniz/.claude/plans/f2-s13-async-jobs.md`.
- **Akış:** `POST /admin/async-jobs` → enqueue workflow'u (tip/girdi/bayrak, tip başına kilit, tekillik) → `async-job.queued` → subscriber → run workflow'u. Run workflow'unda iş başlar, sonuç akış hâlinde private dosyaya yazılır ve iş biter.
- **İlk tip:** denetim kaydı CSV (`;` + BOM, formül kaçışı). İndirme 5 dk imzalı bağlantı; okuma kaydı filtrelerle yazılıyor.
- **Zamanlanmış işler:** süpürücü (5 dk: `interrupted`/`not_started`) ve saklama (günlük: sonuç 7 gün, kayıt 90 gün).
- **Dosya deposu:**
  - Env'de `S3_*` ya hepsi ya hiçbiri; staging/production'da zorunlu ve https.
  - Testte file-local, dev'de file-s3. SeaweedFS ile imzalı bağlantı doğrulandı.
  - Dev bucket'ı anonim okunabilir; F16 şartı olarak adr/0014 ekinde.
- **İnceleme:** Güvenlik incelemesi yapıldı.
  - Yüksek 1: API dosya anahtarını veriyordu; Medusa'nın `/admin/uploads/:id` ucuyla kayıtsız indirme mümkündü. Anahtar gizlendi, uç kapatıldı.
  - Yüksek 2: `presigned-urls` S5 kontrollerini atlıyordu; F3.9'a kadar kapatıldı.
  - 3 orta bulgu düzeltildi: bellekte dışa aktarma, takılı `queued`, `NODE_ENV` tanımsızken yerel disk (uyarı). Düşüklerin çoğu düzeltildi (atomik geçişler, subscriber, saklama döngüsü, https).
- F2 bu görevle bitti.

2026-10-25 (F2 S12): F2.4b. Admin: ürün özellikleri widget'ı ve Ayarlar > Ürün özellikleri. Plan `/Users/deniz/.claude/plans/f2-s12-attribute-admin.md`.
- **Widget (`product.details.after`):** Şablon seçimi ve tipine göre alanlar (metin, sayı+birim, evet/hayır, tek ve çoklu seçim). Varyant özellikleri bilgi satırı olarak görünür. Değeri olan üründe şablon değişimi onay ister.
- **Şablon sayfası:**
  - Liste; oluştur/düzenle çekmecesi.
  - Tanım düzenleyici: seçenekler, bayraklar, kapsam, variesBy. Seçenek değeri etiketten üretilir.
  - Silinen özelliğin değerleri varsa onay istenip yeniden gönderilir. Kullanılan şablon silinemez.
  - "Değerler herkese görünür" uyarısı var.
- **Doğrulama:** Admin tip denetimi, lint, `medusa build` temiz. Playwright duman testi S10'daki devreden işe bağlı; kullanıcı gözle kontrol eder.

2026-10-25 (F2 S11): F2.4a. `product-attributes` backend (adr/0013). Plan `/Users/deniz/.claude/plans/f2-s11-product-attributes.md`.
- **Modül:** şablon, tanım ve değer (tipli kolonlar, facet indeksleri, GIN). Link'ler: ürün ↔ şablon (tek) ve ürün ↔ değerler (`deleteCascade`; ürün silinince değerler gidiyor, testli).
- **Workflow'lar:**
  - Şablon oluştur/güncelle/sil compensation'lı ve şablon kilitli.
  - Ürün değerleri ürün + şablon kilidiyle; plan → yaz → link adımları; yetim değerler temizleniyor.
  - Değer şeması tanımlardan üretiliyor.
- **API:** `/admin/attribute-templates` CRUD, `GET/POST /admin/products/:id/attributes`; Store'da değerler ve seçenek etiketleri.
- **`lib/errors`:** `ConflictError` (409, i18n anahtarı korunur). Medusa'nın CONFLICT yanıtı mesajı genel bir cümleyle değiştiriyordu.
- **İnceleme:** Güvenlik incelemesi yapıldı, yüksek bulgu yok. 5 orta bulgunun 4'ü düzeltildi:
  - Store `*`/ilişki geçişi guard'ı.
  - `constructor` anahtarı prototipten okunuyordu.
  - Şablon güncellemesi tüm değerleri belleğe yüklüyordu.
  - Seçenek etiketleri vitrine kapalıydı.
  - Görünürlük bayrağı ertelendi, admin'de uyarı var. Düşüklerin çoğu düzeltildi; kalanlar adr/0013 ekinde.
- **KK:** "Attribute şablonu tanımlayıp ürüne değer atanabiliyor, Store API'de görünüyor" karşılandı.

2026-10-25 (F2 S10): F2.3b. Admin: Ayarlar > Özellikler ve Ayarlar > SEO.
- **Bağımlılıklar** (kullanıcı onayı, exact, ≥14 gün): `@medusajs/js-sdk` 2.21.2, `react-hook-form` 7.89.0, `@hookform/resolvers` 5.9.1.
- **Özellikler:** Bayrak listesi; tenant bayrağı anahtarla açılıp kapanır. Platform bayrağı "Platform tarafından yönetilir" rozetiyle salt okunur. Kayıt defteri boşken yönlendirici boş durum gösterilir.
- **SEO:**
  - Alan adı ve URL stili.
  - Başlık/açıklama şablonları: kullanılabilir etiketler, örnek değerlerle önizleme ve "Google sonucuna sığar" rozeti (`lib/seo` tarayıcıda çalışıyor).
  - robots.txt ve yapay zekâ tarayıcı ön ayarı.
  - İstemci tarafı Zod doğrulaması sunucuyla aynı token kuralını uygular.
- **Genel:** Yükleniyor, boş ve hata durumları her ekranda var. Tüm metinler i18n anahtarı (tr/en). Sunucu hata anahtarı (`seo.template_invalid`) Türkçe metne çevrilir.
- **Doğrulama:** Admin tip denetimi, lint ve `medusa build` (frontend) temiz. Dev logunda dashboard POST'ları CSRF'ten geçiyor.
  - **Playwright duman testi yapılmadı:** MCP tarayıcısı kullanıcının profilini kullanıyor ve repoda `@playwright/test` yok. Sayfalar kullanıcının gözle kontrolüne bırakıldı.
  - Rota etiketi (`defineRouteConfig.label`) i18n anahtarı olarak verildi. Dashboard'un çevirip çevirmediği bu kontrolde görülecek; çevirmiyorsa sabit metne dönülür.
- **Bulunan sorun (S8 düzeltmesi):** Dashboard'un bildirim rozeti dakikada bir `fields=created_at` ile okuma yapıyor ve her biri denetim kaydı yazıyordu. Kişisel veri içermeyen alanlarla sınırlı okumalar artık kaydedilmiyor (`18a6390`).

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
   - **Push ve PR kararı:** F1 dalı push edildi, PR yok. F2 dalı (`f2-platform-core`) yerelde ve push edilmedi. F1 merge edilince F2 `main` üzerine rebase edilir.
   - **Admin'de gözle kontrol:** Ayarlar > Özellikler, SEO, Ürün özellikleri, İşler; ürün sayfasındaki özellik kutusu. Rota etiketleri Türkçe mi, ham anahtar mı?
   - **Canlı turlar:** `docs/16-proje-haritasi.md` sırasıyla (bölüm 9).
   - **Dev'deki geçici admin kullanıcısı:** `playwright-admin@example.com` silinsin mi?
2. **F3 kararları (kullanıcı):**
   - ADR-0015..0020: her biri ayrı ayrı kabul ya da ret.
   - Yeni bağımlılıklar: `sharp` (T6), `yazl` (T15), Tiptap paketleri (T13, yalnızca admin). Sürümler kendi oturumunda ≥14 gün kuralıyla seçilir.
   - Redis kilit sağlayıcısının F16'dan F3'e (T7) çekilmesi (ADR-0020).
   - Canonical host boşken mutlak URL'nin kaynağı (ADR-0015 açık sorusu).
   - Görev sırası ve kapsam (aşağıdaki tablo). Playwright e2e altyapısı (ayrı profil + `@playwright/test`) onay ister.
   - İlk uygulama oturumunda F3 dalı açılır (öneri: `f3-catalog-seo-stock`, `f2-platform-core` üzerinden).
3. **Yerel dev DB:** F2'nin tüm migration'ları uygulandı. Dev dosyaları artık SeaweedFS'e yazılıyor.

### F3 görev planı (oturum büyüklüğünde, önerilen sıra; kullanıcı onayı bekliyor)
| # | Görev | Kapsam | Bağımlılık | ADR |
|---|---|---|---|---|
| T1 | F3.1 + F3.2 | Katalog uzantısı: MPN, durum, birincil kategori, halef ürün (link'li modül + widget). Fiziksel üründe ölçü/ağırlık kuralı, fiziksel olmayan ürün bayrağı. Handle `lib/seo` slug'ından; ürün/kategori/koleksiyon hook'larında `claimPath`/`unclaimPath`. Düz desen için sistem yolları rezervi | — | 0013 deseni |
| T2 | F3.4a | `seo-meta` modülü ve link'ler, `PUT /admin/seo/:type/:id`, ürün/kategori widget'ı, denetim kaydı | — | 0015 |
| T3 | F3.5 | `seo-redirects`: kurallar, güvenli desen, zincir/döngü, slug ve halef değişiminde otomatik 301, `GET /store/seo/resolve`, 404 günlüğü + hedef önerisi, CSV içe/dışa. KK: 301 zinciri | T1 | 0017 |
| T4 | F3.4b | `lib/seo/resolve`, resolve yanıtında `seo` payload, versioned cache, URL deseni değişiminde toplu 301 (iş) | T2, T3 | 0015 |
| T5 | F3.11 | `brands` modülü, ürün ↔ marka, admin sayfası, Store marka ucu, SEO link'i | T2 | — |
| T6 | F3.3 | Görsel hattı: `image.process` işi, türevler, OG kırpma, alt metin, varyant görselleri. KK: EXIF temizleme | `sharp` onayı | 0016 |
| T7 | F3.7 | Stok: depo/seviye kurulumu, Redis kilit sağlayıcısı, iptal/iade geri dönüş testleri. KK: eşzamanlı checkout | — | 0020 |
| T8 | F3.8 | `stock-ledger`, düşük stok eşiği + `feed` uyarısı, ön sipariş bayrağı, uzlaştırma işi. KK: düşük stok uyarısı | T7 | 0020 |
| T9 | F3.12 | `lib/seo/jsonld`: ProductGroup/Product/Offer, BreadcrumbList, CollectionPage/ItemList, OnlineStore, Article; şema testleri. KK: payload + JSON-LD sözleşme testi | T1, T4 | — |
| T10 | F3.6 + F3.15 | Sitemap işi (debounce + günlük, 50.000'de bölme, görsel sitemap, S3), robots.txt üretimi ve AI ön ayarları, canonical host 301, staging `noindex`, imzalı önizleme, IndexNow. KK: sitemap/robots | T4, T5 | — |
| T11 | F3.13 | `seo-advisor`: kural motoru, skor, bulgular, tek tık düzeltme, widget + SERP önizleme, liste sütunu, yayın kapısı. KK: deterministik, p95 < 50 ms | T2, T9 | — |
| T12 | F3.14 | Mağaza geneli SEO denetim işi, 404 isabet listesi + "301 oluştur", mükerrer/öksüz/zincir listeleri. KK: 404 önerisi | T3, T11 | — |
| T13 | F3.16a | `content` modülü: sayfa ve blog, zengin metin (belge JSON + sunucu oluşturucu, Tiptap), kısa kodlar, Store API | T2, Tiptap onayı | 0019 |
| T14 | F3.16b + F3.17 | Facet landing sayfaları, özgünlük kapısı, facet parametre kuralları ve robots engelleri. KK: özgünlük < %30 | T10, T13 | — |
| T15 | F3.9 | xlsx okuyucu + `yazl` yazıcı, TR şablonu, `catalog.import`/`catalog.export` işleri, kontrollü yükleme yolu, satır hata raporu, advisor ön özeti. KK: 1000 satır, formül kaçışı | T1, T2, T5, T8, `yazl` onayı | 0018 |
| T16 | F3.10 | Toplu düzenleme: fiyat, stok, yayın durumu, kategori, SEO şablonu, alt metin | T8, T15 | — |

Paralel zincirler:
- T1 → T3 → T4 → T9 → T11 → T12
- T2 → T4; T2 → T5; T2 → T13 → T14
- T7 → T8 → T15 → T16
- T6 bağımsız (`sharp` onayından sonra).
- T10, T4 ve T5'ten sonra gelir; sayfa ve landing bölümleri T13 ve T14'te eklenir.

Devreden işlerin F3 görevlerine dağılımı:
- **T1:** `claimPath`/`unclaimPath` ve slug `""` durumu (S7), Türkçe handle (F2 planlaması), düz desen sistem yolları (S7). `additional_data`: admin ürün formu göndermiyor (2.21.2 doğrulandı), alanlar widget + kendi route'umuzla yazılır.
- **T5 ve T14:** özellik görünürlüğü (`is_public`) ve Store yanıt filtresi (S11).
- **T7:** Redis kilit sağlayıcısı (F1, F2'den F16'ya bırakılmıştı; ADR-0020 öneriyor).
- **T15:** `presigned-urls` yerine kontrollü yükleme yolu, iş iptal ucu (S13).

F2 görev planı (S1–S13, hepsi ✅) ve görev ayrıntıları git geçmişinde: `git show 118e835:PROGRESS.md`.

## Açık sorular / bloklayıcılar
- [ ] **F3 kararları** (2026-10-25 planlaması; ayrıntı "Sıradaki görev" ve "F3 görev planı"): ADR-0015..0020, yeni bağımlılıklar (`sharp`, `yazl`, Tiptap), kilit sağlayıcısının öne çekilmesi, canonical host kaynağı.
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
  - **Redis modülleri (F16):** Prod için Redis event bus, workflow engine, locking ve caching modülleri gerekli. Bunlar olmadan server/worker ayrımı, restart sonrası iş devamı ve tek instance'ta zamanlanmış iş garantisi yok (ADR-0014). ADR-0020 locking'i F3 T7'ye çekmeyi öneriyor.
  - **trust proxy (F16):** Medusa `trust proxy = 1` ayarlıyor. Rate limit IP'si doğru olsun diye prod'da tam bir reverse proxy katmanı olmalı.
  - **Handle (F3.1):** Ürün, kategori ve koleksiyon handle'ları `lib/seo` slug üreticisinden verilir; Medusa'nın `toHandle`'ı Türkçe karakterleri ASCII'ye çevirmiyor.
  - **İçe aktarma (F3.9):** Medusa'nın ürün içe aktarması dosyayı presigned URL ile doğrudan depoya yükleyebiliyor. Bu yol `/admin/uploads` doğrulamasından geçmez; F3.9'da ele alınacak.
  - **Kısmi iade dağıtımı (F4.7, F6):** `allocateKurus` her çağrıda bağımsız yuvarlar. Ardışık kısmi iadelerde bir satırın iadesi o satırın payını aşabilir. Satır başına kalan tutarı tavan alan bir dağıtım ve docs/07 testi gerekir (ADR-0010 "Sonuçlar").
  - **S3/S5'ten devreden (F16, F18, S13):**
    - F16 proxy: `/static`, `/app`, 401 ve preflight yanıtlarına güvenlik header'ları; `/static` için `sandbox` CSP; tek hop XFF şartı ya da `TRUSTED_PROXY_HOPS`.
    - F18: Medusa store preflight'ında publishable key istiyor (izinli origin de 400 alıyor). Tarayıcıdan doğrudan store çağrısı için çözülmeli. Sunucudan login proxy'leyen storefront için imzalı istemci-IP ADR'si.
    - S13: `presigned-urls` yolu için uzantı/MIME allowlist'i ve worker'da doğrulama; CSV dışa aktarımın ayırıcısı ve BOM'u.
    - Hesap kilidi ve IP'den bağımsız kimlik sınırı (docs/04 "artan gecikme + kilit").
    - Admin, çekirdek dashboard'un çevirmediği `errors.too_many_requests` gibi anahtarları ham gösteriyor.
  - **S13'ten devreden:**
    - F16: private bucket/politika ve kanarya testi, `NODE_ENV=production`, Redis event bus + workflow engine + locking (worker ayrımı, restart sonrası devam).
    - file-s3 `cache_control` varsayılanının private sonuçlara etkisi.
    - Yetim dosyalar için bucket lifecycle kuralı.
    - İptal ucu (F3.9).
    - İsteğe bağlı `TEST_S3_*` testi (private nesnenin imzasız 403'ü).
  - **S11'den devreden:**
    - Özellik görünürlüğü (`is_public`) ve Store yanıt filtresi.
    - (ürün, tanım) için DB tekillik indeksi.
    - `additional_data` ile ürün formundan kayıt (F3.9).
    - Şablon güncellemesinde soft-delete edilen değerlerin link satırları kalıyor (zararsız; temizlik işi F13).
  - **S10'dan devreden:** Playwright e2e altyapısı: ayrı bir tarayıcı profili ve `@playwright/test` (onay gerekir). docs/06 kontrol listesindeki duman testleri bununla eklenecek.
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
| F2 Platform çekirdek modülleri | ✅ |
| F3 Katalog, SEO motoru ve stok | ⏳ (planlama, karar bekliyor) |
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
