# 04 — Güvenlik

> Güvenlik bu platformda birinci önceliktir. Bu yüzden güvenlik işleri F15'e bırakılmaz:
> **taban** F0–F2'de kurulur (bkz. "Zamanlama"), sonraki her faz bu tabanı hazır bulur,
> F15 yalnızca doğrulama (pentest, yük, fraud) fazıdır.

## Tehdit modeli (özet)
| Varlık | Tehdit | Önlem |
|---|---|---|
| Ödeme akışı | Tutar manipülasyonu, sahte callback, replay, open redirect | Sunucu tarafı tutar, imza doğrulama, idempotency, dönüş URL allowlist |
| Tenant secret'ları | Sızıntı (log, repo, hata mesajı, CI çıktısı) | Secret manager, redaksiyon, secret scanning, CI maskeleme |
| Müşteri verisi (KVKK) | Yetkisiz erişim, aşırı veri, okuma izi yokluğu | RBAC, maskeleme, minimizasyon, saklama süreleri, okuma denetimi |
| Admin hesapları | Credential stuffing, oturum çalma, CSRF | 2FA, rate limit, httpOnly/secure cookie, CSRF token, oturum süresi |
| Müşteri hesapları | Credential stuffing, hesap ele geçirme, sahte kayıt | Rate limit, e-posta doğrulama, şifre sıfırlama tek kullanımlık token |
| Webhook endpoint'leri | Sahte istek, DoS | İmza/HMAC, IP allowlist (varsa), rate limit, hızlı 200 + kuyruk |
| Dosya yükleme / dışa aktarma | SVG-XSS, MIME sahteciliği, EXIF sızıntısı, CSV formül enjeksiyonu, XXE, zip bomb | Tür doğrulama, yeniden kodlama, EXIF temizleme, hücre kaçışlama, güvenli XML parser |
| Sunucu taraflı istekler | SSRF (webhook, geçişte görsel indirme, feed, LLM/entegrasyon URL'leri) | `lib/security/safe-fetch`: iç IP aralıkları ve DNS rebinding reddi |
| Mesajlaşma | SMS pumping (OTP/şifre sıfırlama ile fatura şişirme; checkout'ta yazılan numaraya sipariş SMS'i) | Telefon + IP + hesap başına SMS kotası, captcha eşiği; IP başına saatte 10'dan fazla tamamlanan sepetin SMS'i tutulur (adr/0037 M9) |
| Mesajlaşma | Uydurma adreslere giden e-postaların geri dönmesi, gönderici itibarının düşmesi | E-posta alan adının MX denetimi (kayıt, misafir sepeti, stok bildirimi), mağazanın günlük e-posta sınırı (adr/0037 M9) |
| Tenant alan adları | Subdomain takeover, yanlış tenant'a yönlenme | Kapatmada DNS temizliği doğrulaması, sahiplik kanıtı |
| Bağımlılıklar | Supply-chain saldırısı | Lockfile, Renovate bekleme süresi, audit, SBOM, imaj taraması |
| Tenant izolasyonu | Yanlış tenant'a erişim, kaynak çalma | Instance-per-tenant, ayrı DB kullanıcıları, ağ izolasyonu |

## Zamanlama: güvenlik tabanı önce
| Ne | Faz | Not |
|---|---|---|
| gitleaks, `pnpm audit`, SAST (Semgrep veya CodeQL), Trivy imaj taraması, SBOM | F0.7 | CI'da; kritik bulgu build'i kırar |
| Env şeması (Zod), açılışta doğrulama | F0.6 | |
| `lib/security`: safe-fetch (SSRF), timing-safe compare, upload validator, CSV kaçışlama, güvenli XML | F2.9 | Tüm fazlar bu kütüphaneyi kullanır |
| Rate limit middleware (Redis), güvenlik header'ları, CORS, hata sanitizasyonu, pino redaksiyon | F2.10 | Route eklenmeden önce hazır |
| Audit log (mutasyon + hassas veri okuma) | F2.5 | |
| Admin 2FA (TOTP), rol tabanlı yetki | F12.6 + ADR | Canlı öncesi hazır; ekip için zorunluluk sahibin anahtarı (varsayılan açık) |
| Pentest, yük testi, fraud-guard, WAF | F15 | Doğrulama |

## Zorunlu kurallar

### Ödeme
- Kart verisi sisteme **hiç** girmez: iyzico Checkout Form / PayTR iFrame (hosted). PCI kapsamı SAQ-A seviyesinde kalır.
- Tutar, para birimi, sepet kalemleri **her zaman** sunucudaki sepetten üretilir.
- Callback geldiğinde sonuç, sağlayıcı API'sinden **tekrar sorgulanır**; callback gövdesine güvenilmez.
- `conversationId` / `merchant_oid` = Medusa payment session ID; eşleşmezse reddet.
- Webhook'lar için `processed_webhooks` tablosu (sağlayıcı + event ID unique) → idempotency.
- Kapıda ödeme ek ücreti, kupon indirimi, kargo ücreti dahil hiçbir tutar istemciden alınmaz.
- Ödeme sonrası dönüş URL'leri (başarı/başarısız) tenant'ın storefront origin allowlist'iyle sınırlı; açık yönlendirme yok.
- Ters ibraz (chargeback): sağlayıcı bildirimi siparişi işaretler, belge paketi (fatura, kargo teslim kanıtı, onay kaydı) tek tıkla üretilir (F6.7).
- Dolandırıcılık (`fraud-guard`, F15.6, ADR-0044): dış servissiz iş kanıtı doğrulaması (kayıt, müşteri girişi, siparişimi bul, stok bildirimi ve ödeme başlatmada eşik aşılınca 428); ödeme başlatmada sayılan hız kuralları (her ödeme yolu, kartla ödeme dahil; IP'de engel uzak, doğrulama yakın: CGNAT; e-posta yalnızca doğrulama ister); şüpheli sipariş puanı ve Siparişler > İnceleme (bekleyen ya da reddedilen sipariş kargoya verilemez); kara liste (e-posta ve telefon yalnızca anahtarlı özetle; kayıt, hesap ve ödemede 403, girişte yanlış şifre yanıtı, siparişte kancayla bir kez daha).

### Promosyon ve stok
- Kupon kullanım limiti ve stok rezervasyonu eşzamanlı isteklerde kilit/atomik işlemle korunur (yarış durumu testli).
- Kupon kodu denemesine rate limit; tek kullanımlık kodlar tahmin edilemez üretilir.

### Dosya yükleme ve dışa aktarma
- Görsel yükleme: izinli türler (jpeg, png, webp, avif); SVG varsayılan kapalı, açılırsa sanitize edilir.
  Tür, uzantıdan değil içerikten (magic bytes) doğrulanır. Görsel worker'da yeniden kodlanır (EXIF/konum verisi silinir).
- Boyut ve piksel sınırı; sınır aşımı açıklayıcı hata.
- Uygulama (F2 S5, `lib/security/upload`, `src/api/http/upload-validator.ts`):
  - `POST /admin/uploads`'ta her dosya baytlarından okunur. Kabul edilen dosya, içeriğinin türüne göre yeniden adlandırılır (`<slug>.<png|jpg|webp|avif|csv>`) ve MIME türü yeniden yazılır. Gerekçe: depolama dosyayı uzantısına göre servis eder; PNG başlıklı ama `.html` adlı bir dosya backend origin'inde stored XSS olurdu.
  - İstek başına en fazla 20 dosya. Bir dosya reddedilirse hiçbir dosya saklanmaz.
  - Medusa'nın `/static` dosyaları bizim header'larımızı almaz. F16'da proxy `/static` için nosniff ve `Content-Security-Policy: default-src 'none'; sandbox` ekler; uzun vadede yüklemeler cookie'siz ayrı bir origin'den servis edilir.
  - `POST /admin/uploads/presigned-urls` (file-s3 ile çalışır hâle gelir) bu doğrulamadan geçmediği için F3.9'un kontrollü içe aktarma yolu gelene kadar kapalıdır (F2 S13). Medusa'nın `GET/DELETE /admin/uploads/:id` uçları iş sonucu dosyalarını göstermez.
- CSV/Excel dışa aktarımda `=`, `+`, `-`, `@`, tab, CR (ve tam genişlik biçimleri) ile başlayan metinler kaçışlanır (formül enjeksiyonu). Türkçe Excel satırı `;` ile böldüğü için hücre içinde `,`, `;` ya da tab'dan sonra başlayan formüller de kaçışlanır. Dışa aktarımın ayırıcısı ve BOM'u ilk dışa aktarım işiyle (S13) kararlaştırılır.
- XML okuma (geçiş, feed, UBL): DTD ve external entity kapalı, boyut sınırı (5 MB), iç içe derinlik sınırı (64), değerler metin olarak kalır (`06100` posta kodudur). Zip çıkarmada toplam boyut, dosya sayısı ve sıkıştırma oranı sınırı; yol aşımı, symlink, kontrol karakteri ve aynı ada (büyük/küçük harf ve Unicode biçimi dahil) sahip girdiler reddedilir.
- İçe aktarma dosyaları işlenmeden önce virüs taraması (ClamAV, worker'da) — hosting kararıyla birlikte (ADR-0003).
- Fatura, etiket ve rapor PDF'leri kişisel veri içerir: obje depolamada private; erişim kısa süreli presigned URL + rol kontrolüyle; URL'ler loglanmaz.
- Uygulama (F2 S13, adr/0014): iş sonuçları `access: private` ve tahmin edilemez adla saklanır; indirme 5 dakikalık imzalı bağlantıdır, kişisel veri içeren sonuçta okuma kaydı yazılır (yazılamazsa 503). Dev SeaweedFS bucket'ı anonim okumaya açıktır (adr/0006): private dosyalar orada yalnızca adlarıyla korunur. Prod'da private bucket ya da anonim okumasız politika F16 şartıdır.

### Sunucu taraflı istekler (SSRF)
- Kullanıcı/tenant kontrollü her URL (`tenant-webhooks`, geçişte görsel indirme, feed kaynakları, muhasebe/LLM uç noktaları)
  `lib/security/safe-fetch` üzerinden gider: DNS çözümü sonrası özel/iç/link-local aralıklar reddedilir, yönlendirmeler yeniden doğrulanır,
  yalnızca http/https, zaman aşımı ve yanıt boyutu sınırı. Uygulama (F2 S4):
  - **Adres:** IPv4'te IANA özel aralıkları reddedilir. IPv6'da yalnızca `2000::/3` kabul edilir ve onun içindeki özel aralıklar (Teredo, 6to4, dokümantasyon) da reddedilir. IPv4-mapped adresler her zaman reddedilir.
  - **Rebinding:** Host bir kez çözülür; tek bir yasaklı yanıt bile isteği reddettirir. Bağlantı doğrulanan IP'ye sabitlenir (`lookup`, `agent: false`), TLS doğrulaması ve SNI hostname'le yapılır.
  - **DNS:** `dns.lookup` değil c-ares kullanılır. getaddrinfo libuv thread havuzunu bloke ederdi; c-ares sorgusu zaman aşımında iptal edilir.
  - **Yönlendirme:**
    - Varsayılan mod `same-origin`. `follow` modunda başka origin'e yalnızca `accept`, `accept-language` ve `user-agent` taşınır. Webhook teslimi `error` modunu kullanır.
    - https→http inişi ve başka origin'e giden 307/308 gövdesi reddedilir.
  - **Hata nedenleri:** `dns_failed` ile `address_not_allowed` farkı iç DNS'i sızdırır. Kullanıcıya gösterirken tek bir i18n anahtarına indirgenir.
  - **Test kancası:** `createSafeFetch` (DNS ve adres kuralı enjekte edilir) kütüphaneden export edilmez; yalnızca testler kullanır.
  - **Karşılaştırma:** Secret karşılaştırması `lib/security` `safeEqual` ile yapılır. Boş beklenen değer hiçbir zaman eşleşmez.

### Giden entegrasyonlar
- Tenant API anahtarları yalnızca oluşturulurken bir kez gösterilir, hash'li saklanır (çekirdek davranışı doğrulanır).
- Destek erişimi (break-glass) süreli, gerekçeli ve audit log'lu (F16.10).
- LLM/AI sağlayıcısına (adr/0005) kişisel veri gönderilmez; yalnızca ürün/içerik verisi; sağlayıcı sözleşmesi `docs/12`.

### Secret yönetimi
- Secret'lar: geliştirmede `.env` (git'e girmez), prod'da secret manager / Docker secrets.
- Control plane secret deposu: KMS destekli envelope encryption, anahtar döndürme planı (F17 ADR'ında ayrıntı).
- Mağazanın sağlayıcı hesapları (PayTR, iyzico, ...) panelden girilir ve `integration-credentials` modülünde AES-256-GCM ile şifreli durur (adr/0027):
  - Anahtar `CREDENTIALS_ENCRYPTION_KEY`; PII anahtarlarından ayrıdır ve canlıda zorunludur.
  - Blok sağlayıcıya bağlıdır (AAD). Anahtar değişirse kayıt "yeniden girilmeli" olur.
  - Gizli alanlar yalnızca yazılır: yanıt, log ve denetim kaydında değer ya da parçası yer almaz; denetimde yalnızca sürüm numarası görünür.
  - Workflow girdisi ve adımları yalnızca şifreli bloğu taşır.
  - Uçlar personele açık (secret API anahtarı reddedilir) ve sağlayıcıyı çağıran kayıt ile test uçları `provider_check` hız profilinde. Hesabı yalnızca sahip (owner) değiştirir (adr/0040); bağlantı testi yöneticiye de açık.
- Açılışta Zod ile env doğrulama; secret değerleri asla loglanmaz (`src/lib/logging` redaksiyonu, kurallar docs/10 "Loglama").
- Repo'da gitleaks (pre-commit + CI). CI loglarında secret maskeleme.
- Claude Code `.env*` dosyalarını okuyamaz (`.claude/settings.json` deny).

### Kimlik doğrulama ve yetki
- Medusa auth modülü kullanılır; kendi auth sistemi yazılmaz.
- Store API kimlik modeli (cookie session mı, bearer JWT mi) `adr/0004` ile karara bağlanır; karar F1'de verilir, F10.1 uygular.
- Admin: 2FA (TOTP), Medusa 2.21'in yerleşik MFA'sıyla (adr/0040). Ekip için zorunluluk sahibin Ayarlar > Güvenlik'teki anahtarıdır (varsayılan açık; kullanıcı kararı 2026-10-29). Kodu bu oturumda geçmemiş kişi yalnızca kendini görür (`staff.mfa_required`); kurulumdan sonra kodla yeniden girilir. `AUTH_MFA_ENCRYPTION_KEY` canlıda zorunlu; `ADMIN_MFA=off` yalnızca yerelde. API anahtarlarından 2FA istenmez (kendi kapsamları var).
- Rol bazlı yetki: owner / admin / operasyon / salt-okunur; her admin route'unda rol kontrolü middleware'de (adr/0040).
- Yeniden doğrulama: hassas işlemler istekte kanıt ister: 2FA varsa uygulama kodu ya da kurtarma kodu, yoksa şifre (`X-Reauth-Method`/`X-Reauth-Secret`, yüzde kodlamalı). İşlemler: sağlayıcı ve banka hesapları, API anahtarı ve web kancası açma, ekibe davet, sahiplik, ekip 2FA'sını kapatma, 2FA sıfırlama, kendi 2FA'sını kurma (şifre) ve kapatma, kurtarma kodu üretme, tam vergi numarasını görme. Kanıt yoksa ya da yanlışsa 428; yalnızca yanlışlar sayılır, 15 dakikada 10 ya da günde 30 yanlışta 429. Kabul edilen TOTP kodu 2 dakika boyunca ikinci kez kabul edilmez; girişin ikinci adımı da aynı sayacı kullanır, girişte kullanılan kod ne ikinci girişte ne yeniden doğrulamada geçer (401 `staff.mfa_code_used`, F15.1). Medusa'nın kullanıcı silme ve davet uçları kimseye açık değil; aynı işler `/admin/staff` altında (adr/0040 §3).
  - Genel `/admin/*` koruması (`api/http/staff-guard.ts`) API anahtarı korumasından sonra, Express'in yönlendirdiği yolu küçük harfle okuyup `lib/staff/permissions.ts` tablosundan karar verir. Yasaklayan listeler yolu çözülmüş haliyle de denetler: Express rota parametresini çözer (`/admin/platform-settings/bank%5Ftransfer` aynı bölümdür). Rol her istekte okunur, değişiklik en geç bir saniyede bütün süreçlerde geçerlidir.
  - Sahibe ayrılanlar: sağlayıcı hesapları, API anahtarları, giden webhook'lar, muhasebe programı seçimi, havale IBAN'ı, Google bağlantısı, personel ve davetler.
  - Operasyon ve salt-okunur personel denetim kaydını, hesapları, webhook'ları, personel listesini ve iş akışı kayıtlarını okuyamaz. Operasyon yalnızca listedeki operasyon uçlarına yazar (sipariş gönderimi, iade talebi kabulü, stok, moderasyon); para hareketi (iade, iptal, havale onayı), katalog ve ayarlar kapalıdır. Yeni bir uç bu iki rol için kapalı gelir; kendi yazma uçlarımızın her biri için operasyon kararı birim testinde kayıtlıdır.
  - Rolü olmayan kullanıcı hiçbir yere erişemez (ekipten çıkarılanın açık oturumu dahil); personeli hiç olmayan mağazada ilk kullanıcı sahip olur; son sahip rolünü bırakamaz.
  - Davet: rol davetin metadata'sında, kabul kendi ucumuzda; giriş kaydı davet edilen adrese ait olmalı; davetle sahip verilmez.
  - Kişisel veri içeren iş sonucunu (muhasebe paketi, denetim kaydı dışa aktarımı) yalnızca isteyen kişi ve sahip indirir.
- Oturum token'ları httpOnly + Secure + SameSite cookie. localStorage'da token yok. Cookie oturumu kullanılan her yerde CSRF token.
- Müşteri kaydında e-posta doğrulama; doğrulanmamış hesap yorum, stok bildirimi ve favori gibi yazma işlemleri yapamaz.
  - Kod, adresi yalnızca onu isteyen kimliğin oturumunda doğrular (`POST /auth/verification/confirm` o kimliğin token'ıyla; F15.1). Medusa kodu tek başına kabul ediyordu: birinin adresiyle kayıt açan, adres sahibine e-postadaki bağlantıyı açtırarak adresi kendi hesabına doğrulatabilirdi. Oturumsuz onay 401, başka kimliğin kodu bilinmeyen kod gibi 400 alır. Vitrin doğrulama sayfası, oturum yoksa önce girişi ister (doğrulanmamış hesabın girişi `verification_required` ve kimliksiz bir token döner; onay onunla yapılır).
  - Şifre değişince (sıfırlama bağlantısı) önceki token'lar yenilenmez: `/auth/token/refresh`, `/auth/session` ve `POST /store/customers` değişimden önce verilmiş token'a 401 verir (`api/http/password-change.ts`, F15.1). Kayıtta alınan kimliksiz token, adres sahibi şifreyi sıfırladıktan sonra hesaba çevrilemez. Kimliği olan eski token kendi ömrü dolana kadar (1 gün), açık oturum 10 saat geçerli kalır; ikisi de yenilenemez.
- Başarısız giriş denemelerinde artan gecikme + kilit (admin ve müşteri). Şifre sıfırlama token'ı tek kullanımlık, kısa ömürlü.
- Şifre politikası (ADR-0043, F15.1; `api/http/password-policy.ts`): kayıtta ve sıfırlama bağlantısıyla şifre değişiminde, personel ve müşteri için sunucuda uygulanır. Uzunluk odaklı: 10–256 karakter, karakter sınıfı kuralı yok. Yaygın şifreler, tekrar eden karakter, ardışık rakam ve e-posta adının kendisi reddedilir. Sızmış şifre denetimi Have I Been Pwned aralık API'siyle yapılır (k-anonimlik: yalnızca SHA-1 özetinin ilk 5 karakteri gider, yanıt dolgulu). Bu denetim dış servis olduğu için kullanıcı onayına kadar kapalı (`PASSWORD_BREACH_CHECK=on` açar); açıkken servise ulaşılamazsa şifre geçer ve uyarı loglanır. Yanıt 400 `auth.password_<sorun>`.

### API
- Tüm girdiler Zod ile doğrulanır (`validateAndTransformBody`, `validateAndTransformQuery`).
- Rate limiting: Redis tabanlı; login, kayıt, şifre sıfırlama, checkout, taksit sorgusu, kupon denemesi, SMS tetikleyen uçlar, webhook için ayrı limitler. Uygulama (F2 S3, `lib/security/rate-limit`, `src/api/http/rate-limit.ts`):
  - Profiller `RATE_LIMIT_PROFILES`'ta tanımlı. Her profilin IP başına ve (IP + kimlik) başına sınırı olabilir. Kimlik, e-posta ya da telefonun `PII_HASH_KEY` ile HMAC'idir; düz değer ya da sözlükle çözülebilecek düz özet saklanmaz.
  - IP doğrulanır; IPv6 istemci /64 ağıyla, IPv4-mapped adres IPv4 olarak sayılır. Böylece bir istemci adres değiştirerek limitleri aşamaz.
  - Yol, Express'in rotaladığı biçimde değerlendirilir (`routePath`: küçük harf, sondaki `/` yok, absolute-form hedefin yolu). `/AUTH/customer/emailpass/` login limitine takılır. `/auth` altında tanınmayan yol en sıkı profili (login) alır.
  - Kimlik, rotanın okuduğu alandan alınır: login ve kayıtta `email`, şifre sıfırlamada `identifier`.
  - Bağlı profiller: login, kayıt, şifre sıfırlama, token yenileme, varsayılan auth/store/admin; F4'te kupon (promosyon kodu gönderen sepet istekleri, hediye kartı kodu deneme, sorgu ve kredi alma; ADR-0024, ADR-0025). Checkout, taksit, SMS ve webhook profilleri tanımlı; uçları kendi fazlarında bağlanır.
  - Sabit pencere sayacı kullanılır: Redis'te atomik Lua script'i (EVALSHA), REDIS_URL yoksa bellek (LRU, 50 bin anahtar). Yerel ortam dışında REDIS_URL yoksa uyarı loglanır. Anahtarlar veritabanı sunucusu ve adıyla ad alanına ayrılır; Redis'i paylaşan tenant'lar ve dev/test birbirini saymaz. Medusa'nın test çalıştırıcısı DATABASE_URL'i değiştirmediği için test çalıştırmaları (`NODE_ENV=test`) ayrıca `/test` ekiyle ayrılır (`lib/redis/namespace.ts`).
  - Limit aşılınca 429 ve `Retry-After` döner. Redis hata verirse sayım 30 saniye boyunca süreç belleğine geçer (limitler instance başına sürer) ve hata dakikada bir loglanır; logda yalnızca hata adı ve mesajı vardır (komut argümanlarındaki IP yazılmaz). Sayaç tamamen çalışmazsa istek geçer (fail open).
  - Güven modeli: `trust proxy = 1`, yani `req.ip` X-Forwarded-For'un son girdisidir. Önde XFF ekleyen tam bir proxy olmalıdır (F16 şartı, docs/08). Proxy'siz açılan bir ortamda istemci IP'sini kendisi yazabilir; iki hop'ta (CDN + LB) herkes edge IP'sini paylaşır. F16'da `TRUSTED_PROXY_HOPS` değerlendirilir. F18'de sunucudan login proxy'leyen storefront için imzalı istemci-IP header'ı ADR'si gerekir.
  - Tek hesaba çok adresten (botnet) deneme, IP'den bağımsız kimlik sınırı ve hesap kilidiyle (yukarıdaki "artan gecikme + kilit") ele alınır; henüz yok.
  - `RATE_LIMIT_RELAXED=1` yalnızca `NODE_ENV=test`'te IP başına sınırları 100 kat büyütür (entegrasyon testleri tek IP'den çok hesap açar).
- CSRF (F2 S3, `src/api/http/csrf.ts`, adr/0004):
  - Kapsam: session cookie (`connect.sid`) taşıyan, GET/HEAD/OPTIONS dışındaki her istek. Alan `routePath` ile belirlenir (`/ADMIN/...` admin sayılır).
  - Origin ilgili CORS listesinde olmalıdır; değilse 403 döner. Referer yalnızca Origin header'ı hiç yoksa kullanılır; `Origin: null` reddedilir (redirect ve sandbox'lı iframe durumları).
  - `/store`, `/auth`, `/admin` dışındaki bir yolda cookie'li mutasyon, üç CORS listesinden birindeki origin'den gelmelidir.
  - Admin'de gövde JSON olmalıdır. Multipart yalnızca upload ve ürün içe aktarma yollarında kabul edilir.
  - Store'da Medusa `x-publishable-api-key` header'ını zaten zorunlu tuttuğu için ayrıca header şartı yoktur.
- İstek sınırları: `/store/*`'da `limit` yalnızca rakam ve en fazla 100 (`1000abc` ya da `-1` 400 döner; Medusa `parseInt` ile okur). Multipart her istekte multer öncesi bildirilen boyut en fazla 25 MB; uzunluk yoksa 411. Bu kontrol yola değil içerik türüne bağlıdır. `/admin/*`'da `limit` en fazla 9999 (dashboard ürün oluşturma, fiyat, stok ve kategori ekranlarında bütün listeyi 9999 ile ister; 1000 bu ekranları bozuyordu). Kilit alınamayan kayıt 503 + `Retry-After` alır, kilit anahtarı yanıta ve loga girmez.
- Özellik bayrağı kapalıyken uç (`requireFeature`), Express'in bilinmeyen route sayfasının aynısını döner; kapalı bir özelliğin varlığı sızmaz (adr/0012). Ayar bölümleri strict şemalıdır, serbest alan ve secret tutulmaz. robots.txt yalnızca bilinen direktifleri kabul eder.
- Store API'de ürün özellik değerleri `allowFields` ile açılır: değer kolonları ve tanımın `key`, `label`, `type`, `unit`, `rank`, `is_seo_highlight` alanları; tanımın geri kalanı yalnızca admin'dedir (adr/0013).
- CORS: sadece tenant'ın storefront ve admin origin'leri.
- Güvenlik header'ları: HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, CSP (admin), Permissions-Policy.
  - API yanıtlarında `src/api/http/security-headers.ts` uygulanır: `default-src 'none'; frame-ancestors 'none'`, nosniff, DENY, `no-referrer`, Permissions-Policy, yerel ortam dışında HSTS. `X-Powered-By` kaldırılır.
  - Medusa'nın bizim middleware'lerimizden önce yazdığı yanıtlar (admin auth 401, CORS preflight, `/app` ve `/static` dosyaları) bu header'ları alamaz. Admin CSP dahil hepsi F16'da reverse proxy'de eklenir.
  - Panelin kendi HTML'i (`apps/panel`, giriş, 2FA kurulumu, yeniden doğrulama penceresi, ekip ekranları) de API başlıklarını almaz. F16'da vekil sunucu panele `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` ve panel CSP'si ekler; e2e bir denetim bunu doğrular (F12 Y13 incelemesi).
  - Medusa, store preflight'ında da publishable key ister; izinli origin bile 400 alır ve allow header'ı dönmez. Tarayıcıdan doğrudan store çağrısı yapacak storefront (F18) için bu doğrulanıp çözülmelidir.
- Hata yanıtları iç detay sızdırmaz (stack trace, SQL, sağlayıcı ham yanıtı).
- Toplu sorgularda sayfalama limiti zorunlu (max 100). Store API'de `fields` ile hassas alan sızdırmama testi.

### Veri ve KVKK
- TCKN, telefon, adres: loglarda maskeli; admin listelerinde maskeli, detayda yetkiye bağlı açık.
- Hassas veri **okuma** da audit log'a düşer: kim, hangi müşteri kaydı, ne zaman (TCKN/adres görüntüleme, dışa aktarma).
  - Uygulama (F2 S8, adr/0011, `modules/audit-log`, `src/api/http/audit/`):
    - `/admin/*` mutasyonları yanıt bittikten sonra yazılır: actor (`user` ya da `api-key`), route deseni, kaynak kimliği, durum kodu. Kayıt defterindeki kaynaklarda (varyant ve price list fiyatları) alan bazında önce/sonra yazılır. Diğer route'larda yalnızca gövdedeki alan adları yazılır, değerler yazılmaz.
    - Kişisel veri dönen admin GET route'larında (`SENSITIVE_READS`: müşteri ve sipariş listeleri/detayları, adresler, fatura profili, draft order, iade, claim, exchange, bildirim, müşteri grubu, denetim kaydı) kayıt yanıttan önce yazılır. Yazılamazsa 503 döner (fail closed). Liste okumasında istenen `fields` ve sayfalama yazılır; filtre değerleri yazılmaz.
    - Admin'de `fields` ile fatura profili/vergi kimliği genişletilemez (400). Denetim kaydını yalnızca admin kullanıcıları okur.
    - Mutasyon kaydı handler yanıtı bitirdiğinde yazılır; istemcinin bağlantıyı koparması kaydı engellemez. `\\` ya da `#` içeren istek hedefleri 400 alır.
    - Tablo yalnızca ekleme kabul eder: servis güncelleme/silme metotlarını kapatır. DB seviyesinde UPDATE/DELETE yetkisinin kaldırılması F16'da.
    - IP ve user agent kişisel veridir; saklama süresi docs/12, silme işi F13.
- Hassas alanlar için DB seviyesinde şifreleme gerekirse (TCKN) uygulama katmanında AES-256-GCM.
- Saklama süreleri job'u: süresi dolan kişisel veriler anonimleştirilir (muhasebe kayıtları korunur).
- Veri işleme envanteri ve saklama süreleri: `docs/kvkk-envanter.md` (F13.5); gecelik `compliance-retention` işi.
- **Veri ihlali müdahalesi:** KVKK'ya göre ihlal, öğrenildikten sonra 72 saat içinde Kurul'a bildirilir; ilgili kişilere de bildirim gerekir
  (kesin yükümlülük KVKK danışmanıyla doğrulanır). Kılavuz: `docs/runbooks/veri-ihlali.md` (tespit → sınırlama → etki analizi →
  mağazaya bildirim → Kurul bildirimi → ilgili kişilere bildirim → olay sonrası rapor); tatbikatlar `docs/runbooks/tatbikatlar/`.
  Tenant veri sorumlusu, platform veri işleyen olduğundan bildirim sorumluluğu sözleşmede netleşir.

### Altyapı
- Container'lar non-root, salt-okunur dosya sistemi (mümkün olduğunca).
- DB kullanıcısı en az yetki; migration kullanıcısı ayrı. DB ve Redis yalnızca iç ağdan erişilir, bağlantılar TLS, Redis auth zorunlu.
- Tenant'lar arası ağ izolasyonu; DB'ler ayrı.
- Yedekler şifreli, farklı lokasyonda; geri yükleme düzenli test edilir.
- Özel domain bağlama: sahiplik doğrulaması (DNS TXT); tenant kapanınca DNS/sertifika kayıtları temizlenir ve subdomain takeover kontrolü yapılır.
- Varsayılan `<slug>.<platform-domain>` adresi, tenant kendi domain'ini bağladığında ona 301 ile yönlenir (hem güvenlik hem SEO).

### Bağımlılıklar ve supply chain
- `pnpm` lockfile zorunlu, `--frozen-lockfile` CI'da.
- Renovate: haftalık; güvenlik yamaları hemen.
- Yeni yayımlanmış paket sürümlerini (son 14 gün) otomatik alma; Renovate `minimumReleaseAge`.
- `pnpm audit` CI'da; kritik bulgu build'i kırar. SAST (Semgrep/CodeQL) ve Trivy imaj taraması CI'da; SBOM (CycloneDX) her sürümde üretilir.
- Postinstall script'leri kapalı (`pnpm` ayarı); istisna açıkça listelenir.
- **14 günden yeni güvenlik yaması:** Renovate güvenlik PR'ını hemen açar, ama pnpm'in `minimumReleaseAge` kuralı
  kurulumu reddeder. Karar etkiye göre verilir:
  - Canlıda etkilenen bir yol varsa: `pnpm-workspace.yaml` → `minimumReleaseAgeExclude`'a o paket ve sürüm için
    gerekçe ve bitiş tarihiyle bir istisna eklenir.
  - Yoksa yama 14 gün dolana kadar beklenir ve takip ADR'de tutulur (örnek: adr/0001 "Bilinen açıklar").
- Geçişli bağımlılık açıkları `pnpm-workspace.yaml` → `overrides` ile yamalanır. Her kayıt advisory'yi ve
  kaldırılma koşulunu yazar.
- CI tarayıcıları ve imajları commit SHA / digest / checksum ile sabitlenir; tag'e güvenilmez
  (Mart 2026 trivy-action tag ele geçirme olayı, CVE-2026-33634).

## Review süreci
- Her faz sonunda `/guvenlik-review` çalıştırılır. Ödeme/kargo/fatura/auth/webhook/upload PR'larında `security-reviewer` ajanı zorunlu.
- Her PR şablonunda "Güvenlik etkisi" alanı doldurulur (yok / var: açıklama).
- F15'te dış pentest; bulgular kapatılmadan canlıya çıkılmaz. Sorumlu açıklama politikası (`/.well-known/security.txt`) yayımlanır.
