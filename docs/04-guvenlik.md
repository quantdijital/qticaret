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
| Mesajlaşma | SMS pumping (OTP/şifre sıfırlama ile fatura şişirme) | Telefon + IP + hesap başına SMS kotası, captcha eşiği |
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
| Admin 2FA (TOTP), rol tabanlı yetki | F12.6 + ADR | Canlı öncesi zorunlu |
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
- Dolandırıcılık: captcha, velocity kuralları, şüpheli sipariş kuyruğu (`fraud-guard`, F15.6).

### Promosyon ve stok
- Kupon kullanım limiti ve stok rezervasyonu eşzamanlı isteklerde kilit/atomik işlemle korunur (yarış durumu testli).
- Kupon kodu denemesine rate limit; tek kullanımlık kodlar tahmin edilemez üretilir.

### Dosya yükleme ve dışa aktarma
- Görsel yükleme: izinli türler (jpeg, png, webp, avif); SVG varsayılan kapalı, açılırsa sanitize edilir.
  Tür, uzantıdan değil içerikten (magic bytes) doğrulanır. Görsel worker'da yeniden kodlanır (EXIF/konum verisi silinir).
- Boyut ve piksel sınırı; sınır aşımı açıklayıcı hata.
- CSV/Excel dışa aktarımda `=`, `+`, `-`, `@`, tab, CR ile başlayan hücreler kaçışlanır (formül enjeksiyonu).
- XML okuma (geçiş, feed, UBL): DTD ve external entity kapalı, boyut sınırı, zip çıkarmada toplam boyut ve dosya sayısı sınırı.
- İçe aktarma dosyaları işlenmeden önce virüs taraması (ClamAV, worker'da) — hosting kararıyla birlikte (ADR-0003).
- Fatura, etiket ve rapor PDF'leri kişisel veri içerir: obje depolamada private; erişim kısa süreli presigned URL + rol kontrolüyle; URL'ler loglanmaz.

### Sunucu taraflı istekler (SSRF)
- Kullanıcı/tenant kontrollü her URL (`tenant-webhooks`, geçişte görsel indirme, feed kaynakları, muhasebe/LLM uç noktaları)
  `lib/security/safe-fetch` üzerinden gider: DNS çözümü sonrası özel/iç/link-local aralıklar reddedilir, yönlendirmeler yeniden doğrulanır,
  yalnızca http/https, zaman aşımı ve yanıt boyutu sınırı.

### Giden entegrasyonlar
- Tenant API anahtarları yalnızca oluşturulurken bir kez gösterilir, hash'li saklanır (çekirdek davranışı doğrulanır).
- Destek erişimi (break-glass) süreli, gerekçeli ve audit log'lu (F16.10).
- LLM/AI sağlayıcısına (adr/0005) kişisel veri gönderilmez; yalnızca ürün/içerik verisi; sağlayıcı sözleşmesi `docs/12`.

### Secret yönetimi
- Secret'lar: geliştirmede `.env` (git'e girmez), prod'da secret manager / Docker secrets.
- Control plane secret deposu: KMS destekli envelope encryption, anahtar döndürme planı (F17 ADR'ında ayrıntı).
- Açılışta Zod ile env doğrulama; secret değerleri asla loglanmaz (`src/lib/logging` redaksiyonu, kurallar docs/10 "Loglama").
- Repo'da gitleaks (pre-commit + CI). CI loglarında secret maskeleme.
- Claude Code `.env*` dosyalarını okuyamaz (`.claude/settings.json` deny).

### Kimlik doğrulama ve yetki
- Medusa auth modülü kullanılır; kendi auth sistemi yazılmaz.
- Store API kimlik modeli (cookie session mı, bearer JWT mi) `adr/0004` ile karara bağlanır; karar F1'de verilir, F10.1 uygular.
- Admin: 2FA (TOTP) — Medusa'da yerleşik değilse auth provider/middleware ile eklenir (ADR).
- Rol bazlı yetki: owner / admin / operasyon / salt-okunur; her admin route'unda rol kontrolü middleware'de.
- Oturum token'ları httpOnly + Secure + SameSite cookie. localStorage'da token yok. Cookie oturumu kullanılan her yerde CSRF token.
- Müşteri kaydında e-posta doğrulama; doğrulanmamış hesap yorum, stok bildirimi ve favori gibi yazma işlemleri yapamaz.
- Başarısız giriş denemelerinde artan gecikme + kilit (admin ve müşteri). Şifre sıfırlama token'ı tek kullanımlık, kısa ömürlü.
- Şifre politikası: uzunluk odaklı (min 10), sızmış şifre listesi kontrolü (k-anonymity API veya yerel liste; ADR-0003'e göre).

### API
- Tüm girdiler Zod ile doğrulanır (`validateAndTransformBody`, `validateAndTransformQuery`).
- Rate limiting: Redis tabanlı; login, kayıt, şifre sıfırlama, checkout, taksit sorgusu, kupon denemesi, SMS tetikleyen uçlar, webhook için ayrı limitler.
- CORS: sadece tenant'ın storefront ve admin origin'leri.
- Güvenlik header'ları: HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, CSP (admin), Permissions-Policy.
- Hata yanıtları iç detay sızdırmaz (stack trace, SQL, sağlayıcı ham yanıtı).
- Toplu sorgularda sayfalama limiti zorunlu (max 100). Store API'de `fields` ile hassas alan sızdırmama testi.

### Veri ve KVKK
- TCKN, telefon, adres: loglarda maskeli; admin listelerinde maskeli, detayda yetkiye bağlı açık.
- Hassas veri **okuma** da audit log'a düşer: kim, hangi müşteri kaydı, ne zaman (TCKN/adres görüntüleme, dışa aktarma).
- Hassas alanlar için DB seviyesinde şifreleme gerekirse (TCKN) uygulama katmanında AES-256-GCM.
- Saklama süreleri job'u: süresi dolan kişisel veriler anonimleştirilir (muhasebe kayıtları korunur).
- Veri işleme envanteri `docs/kvkk-envanter.md` (F13'te oluşturulur).
- **Veri ihlali müdahalesi:** KVKK'ya göre ihlal, öğrenildikten sonra 72 saat içinde Kurul'a bildirilir; ilgili kişilere de bildirim gerekir
  (kesin yükümlülük KVKK danışmanıyla doğrulanır). Runbook F13.10: tespit → sınırlama → etki analizi → tenant bilgilendirme şablonu →
  Kurul bildirimi → olay sonrası rapor. Tenant veri sorumlusu, platform veri işleyen olduğundan bildirim sorumluluğu sözleşmede netleşir.

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
