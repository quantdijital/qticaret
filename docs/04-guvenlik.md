# 04 — Güvenlik

## Tehdit modeli (özet)
| Varlık | Tehdit | Önlem |
|---|---|---|
| Ödeme akışı | Tutar manipülasyonu, sahte callback, replay | Sunucu tarafı tutar, imza doğrulama, idempotency |
| Tenant secret'ları | Sızıntı (log, repo, hata mesajı) | Secret manager, redaksiyon, secret scanning |
| Müşteri verisi (KVKK) | Yetkisiz erişim, aşırı veri | RBAC, maskeleme, minimizasyon, saklama süreleri |
| Admin hesapları | Credential stuffing, oturum çalma | 2FA, rate limit, httpOnly/secure cookie, oturum süresi |
| Webhook endpoint'leri | Sahte istek, DoS | İmza/HMAC, IP allowlist (varsa), rate limit, hızlı 200 + kuyruk |
| Bağımlılıklar | Supply-chain saldırısı | Lockfile, Renovate, audit, yeni sürümler için bekleme süresi |

## Zorunlu kurallar

### Ödeme
- Kart verisi sisteme **hiç** girmez: iyzico Checkout Form / PayTR iFrame (hosted). PCI kapsamı SAQ-A seviyesinde kalır.
- Tutar, para birimi, sepet kalemleri **her zaman** sunucudaki sepetten üretilir.
- Callback geldiğinde sonuç, sağlayıcı API'sinden **tekrar sorgulanır**; callback gövdesine güvenilmez.
- `conversationId` / `merchant_oid` = Medusa payment session ID; eşleşmezse reddet.
- Webhook'lar için `processed_webhooks` tablosu (sağlayıcı + event ID unique) → idempotency.

### Secret yönetimi
- Secret'lar: geliştirmede `.env` (git'e girmez), prod'da secret manager / Docker secrets.
- Açılışta Zod ile env doğrulama; secret değerleri asla loglanmaz (pino `redact` yolları tanımlı).
- Repo'da gitleaks (pre-commit + CI).
- Claude Code `.env*` dosyalarını okuyamaz (`.claude/settings.json` deny).

### Kimlik doğrulama ve yetki
- Medusa auth modülü kullanılır; kendi auth sistemi yazılmaz.
- Admin: 2FA (TOTP) — Medusa'da yerleşik değilse auth provider/middleware ile eklenir (ADR).
- Rol bazlı yetki: owner / admin / operasyon / salt-okunur; her admin route'unda rol kontrolü middleware'de.
- Oturum token'ları httpOnly + Secure + SameSite cookie. localStorage'da token yok.
- Başarısız giriş denemelerinde artan gecikme + kilit.

### API
- Tüm girdiler Zod ile doğrulanır (`validateAndTransformBody`, `validateAndTransformQuery`).
- Rate limiting: Redis tabanlı; login, checkout, taksit sorgusu, webhook için ayrı limitler.
- CORS: sadece tenant'ın storefront ve admin origin'leri.
- Güvenlik header'ları: HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, CSP (admin).
- Hata yanıtları iç detay sızdırmaz (stack trace, SQL, sağlayıcı ham yanıtı).
- Toplu sorgularda sayfalama limiti zorunlu (max 100).

### Veri ve KVKK
- TCKN, telefon, adres: loglarda maskeli; admin listelerinde maskeli, detayda yetkiye bağlı açık.
- Hassas alanlar için DB seviyesinde şifreleme gerekirse (TCKN) uygulama katmanında AES-256-GCM.
- Saklama süreleri job'u: süresi dolan kişisel veriler anonimleştirilir (muhasebe kayıtları korunur).
- Veri işleme envanteri `docs/kvkk-envanter.md` (F9'da oluşturulur).

### Altyapı
- Container'lar non-root, salt-okunur dosya sistemi (mümkün olduğunca).
- DB kullanıcısı en az yetki; migration kullanıcısı ayrı.
- Tenant'lar arası ağ izolasyonu; DB'ler ayrı.
- Yedekler şifreli, farklı lokasyonda; geri yükleme düzenli test edilir.

### Bağımlılıklar ve supply chain
- `pnpm` lockfile zorunlu, `--frozen-lockfile` CI'da.
- Renovate: haftalık; güvenlik yamaları hemen.
- Yeni yayımlanmış paket sürümlerini (son 14 gün) otomatik alma; Renovate `minimumReleaseAge`.
- `pnpm audit` CI'da; kritik bulgu build'i kırar.

## Review süreci
Her faz sonunda `/guvenlik-review` çalıştırılır. Ödeme/kargo/fatura PR'larında `security-reviewer` ajanı zorunlu.
